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

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Auth validation
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
    
    // Use getUser which handles token validation gracefully
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user?.email) {
      // Session expired or invalid - return graceful fallback instead of 500
      console.log("Auth validation failed (possibly expired JWT):", userError?.message);
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;

    // Check DB plan override first
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check user-level plan override (solo premium)
    const { data: profileRow } = await adminClient
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    if (profileRow?.plan === 'premium') {
      return new Response(JSON.stringify({
        subscribed: true,
        plan_type: 'solo',
        subscription_end: null,
        customer_id: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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

      // If household plan is manually set to premium in DB, honor it
      if (household?.plan === 'premium' && household?.subscription_status === 'active') {
        return new Response(JSON.stringify({
          subscribed: true,
          plan_type: 'foyer',
          subscription_end: household.subscription_end_date,
          customer_id: null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false }), {
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
    let subscriptionId = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      if (subscription.current_period_end) {
        const endDate = new Date(subscription.current_period_end * 1000);
        if (!isNaN(endDate.getTime())) {
          subscriptionEnd = endDate.toISOString();
        }
      }
      subscriptionId = subscription.id;

      if (memberRow) {
        await adminClient
          .from('households')
          .update({
            plan: 'premium',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_end_date: subscriptionEnd,
          })
          .eq('id', memberRow.household_id);
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_end: subscriptionEnd,
      customer_id: customerId,
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
