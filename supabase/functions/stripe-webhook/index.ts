import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Price to plan mapping
const FOYER_PRICE_IDS = [
  "price_1T7y2OIw2TO0HaPOo83XMPEP",
  "price_1T7y2iIw2TO0HaPODsF2b5RZ",
  "price_1T7y3XIw2TO0HaPO5RiFbGbI",
];
const FAMILLE_PRICE_IDS = [
  "price_1T7y3pIw2TO0HaPOgN0KYjLa",
  "price_1T7y49Iw2TO0HaPOtNSRk9Lg",
  "price_1T7y4KIw2TO0HaPOu1OaQ0GA",
];
const LIFETIME_PRICE_IDS = [
  "price_1T7y3XIw2TO0HaPO5RiFbGbI",
  "price_1T7y4KIw2TO0HaPOu1OaQ0GA",
];

function getPlanFromPriceId(priceId: string): string {
  if (FAMILLE_PRICE_IDS.includes(priceId)) return "famille";
  if (FOYER_PRICE_IDS.includes(priceId)) return "foyer";
  return "foyer";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response("STRIPE_SECRET_KEY not set", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const event = JSON.parse(body) as Stripe.Event;
    
    console.log(`[STRIPE-WEBHOOK] Event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string | null;
      const planType = session.metadata?.plan_type || 'foyer';
      const isLifetime = session.metadata?.is_lifetime === 'true';

      if (customerEmail) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('email', customerEmail)
          .single();

        if (profile) {
          const { data: memberRow } = await supabaseClient
            .from('household_members')
            .select('household_id')
            .eq('user_id', profile.id)
            .single();

          if (memberRow) {
            if (isLifetime) {
              // Lifetime: no subscription, set permanently
              await supabaseClient
                .from('households')
                .update({
                  plan: planType,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: null,
                  subscription_status: 'lifetime',
                  subscription_end_date: null,
                  coach_ia_conversations_count: 0,
                  coach_ia_reset_date: new Date().toISOString().slice(0, 10),
                })
                .eq('id', memberRow.household_id);
              console.log(`[STRIPE-WEBHOOK] Household ${memberRow.household_id} upgraded to ${planType} (lifetime)`);
            } else if (subscriptionId) {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const endDate = new Date(subscription.current_period_end * 1000).toISOString();

              await supabaseClient
                .from('households')
                .update({
                  plan: planType,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  subscription_status: 'active',
                  subscription_end_date: endDate,
                  coach_ia_conversations_count: 0,
                  coach_ia_reset_date: new Date().toISOString().slice(0, 10),
                })
                .eq('id', memberRow.household_id);
              console.log(`[STRIPE-WEBHOOK] Household ${memberRow.household_id} upgraded to ${planType}`);
            }
          }
        }
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price?.id;
      const planType = priceId ? getPlanFromPriceId(priceId) : "foyer";
      const endDate = new Date(subscription.current_period_end * 1000).toISOString();

      const { data: household } = await supabaseClient
        .from('households')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (household) {
        await supabaseClient
          .from('households')
          .update({
            plan: planType,
            subscription_status: subscription.status === 'active' ? 'active' : subscription.status,
            subscription_end_date: endDate,
            stripe_subscription_id: subscription.id,
          })
          .eq('id', household.id);
        console.log(`[STRIPE-WEBHOOK] Household ${household.id} updated to ${planType}`);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: household } = await supabaseClient
        .from('households')
        .select('id, subscription_status')
        .eq('stripe_customer_id', customerId)
        .single();

      if (household && household.subscription_status !== 'lifetime') {
        await supabaseClient
          .from('households')
          .update({
            plan: 'free',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
          })
          .eq('id', household.id);
        console.log(`[STRIPE-WEBHOOK] Household ${household.id} downgraded to free`);
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: household } = await supabaseClient
        .from('households')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (household) {
        await supabaseClient
          .from('households')
          .update({ subscription_status: 'past_due' })
          .eq('id', household.id);
        console.log(`[STRIPE-WEBHOOK] Household ${household.id} payment failed`);
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: household } = await supabaseClient
        .from('households')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (household) {
        // Reset coach IA counter on renewal
        await supabaseClient
          .from('households')
          .update({
            subscription_status: 'active',
            coach_ia_conversations_count: 0,
            coach_ia_reset_date: new Date().toISOString().slice(0, 10),
          })
          .eq('id', household.id);
        console.log(`[STRIPE-WEBHOOK] Household ${household.id} invoice paid, coach IA counter reset`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[STRIPE-WEBHOOK] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
