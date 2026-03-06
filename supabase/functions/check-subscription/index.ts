import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map price IDs to plan types
const FOYER_PRICE_IDS = [
  "price_1T7y2OIw2TO0HaPOo83XMPEP", // monthly
  "price_1T7y2iIw2TO0HaPODsF2b5RZ", // yearly
  "price_1T7y3XIw2TO0HaPO5RiFbGbI", // lifetime
];
const FAMILLE_PRICE_IDS = [
  "price_1T7y3pIw2TO0HaPOgN0KYjLa", // monthly
  "price_1T7y49Iw2TO0HaPOtNSRk9Lg", // yearly
  "price_1T7y4KIw2TO0HaPOu1OaQ0GA", // lifetime
];

function getPlanFromPriceId(priceId: string): string {
  if (FAMILLE_PRICE_IDS.includes(priceId)) return "famille";
  if (FOYER_PRICE_IDS.includes(priceId)) return "foyer";
  return "foyer"; // default for legacy
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user?.email) {
      console.log("Auth validation failed:", userError?.message);
      return new Response(JSON.stringify({ subscribed: false, plan_type: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: memberRow } = await adminClient
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (memberRow) {
      const { data: household } = await adminClient
        .from('households')
        .select('plan, subscription_status, subscription_end_date')
        .eq('id', memberRow.household_id)
        .single();

      // If household plan is set in DB and active, honor it
      if (household && (household.plan === 'foyer' || household.plan === 'famille')) {
        if (household.subscription_status === 'active' || household.subscription_status === 'lifetime') {
          return new Response(JSON.stringify({
            subscribed: true,
            plan_type: household.plan,
            subscription_end: household.subscription_end_date,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    // Check Stripe for active subscriptions
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false, plan_type: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionEnd = null;
    let planType = "free";

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      if (subscription.current_period_end) {
        const endDate = new Date(subscription.current_period_end * 1000);
        if (!isNaN(endDate.getTime())) {
          subscriptionEnd = endDate.toISOString();
        }
      }

      // Determine plan from price
      const priceId = subscription.items.data[0]?.price?.id;
      planType = priceId ? getPlanFromPriceId(priceId) : "foyer";

      // Sync to DB
      if (memberRow) {
        await adminClient
          .from('households')
          .update({
            plan: planType,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            subscription_status: 'active',
            subscription_end_date: subscriptionEnd,
          })
          .eq('id', memberRow.household_id);
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      plan_type: planType,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
