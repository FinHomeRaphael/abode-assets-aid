import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      const subscriptionId = session.subscription as string;

      if (customerEmail) {
        // Find profile by email
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
            // Get subscription end date
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const endDate = new Date(subscription.current_period_end * 1000).toISOString();

            await supabaseClient
              .from('households')
              .update({
                plan: 'premium',
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                subscription_status: 'active',
                subscription_end_date: endDate,
              })
              .eq('id', memberRow.household_id);

            console.log(`[STRIPE-WEBHOOK] Household ${memberRow.household_id} upgraded to premium`);
          }
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Find household by stripe_customer_id
      const { data: household } = await supabaseClient
        .from('households')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (household) {
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
