import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook authorization (RevenueCat sends a shared secret)
    const authHeader = req.headers.get("Authorization");
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");

    if (webhookSecret && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== webhookSecret) {
        console.error("Invalid webhook secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const event = body.event;

    if (!event) {
      return new Response(JSON.stringify({ error: "No event in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = event.type;
    const appUserId = event.app_user_id; // This is the Supabase user ID
    const entitlements = event.entitlements || [];
    const hasProAccess = entitlements.some(
      (e: any) => e === "pro_access" || e?.identifier === "pro_access"
    );

    console.log(`RevenueCat event: ${eventType}, user: ${appUserId}, pro: ${hasProAccess}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the user's household
    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from("household_members")
      .select("household_id")
      .eq("user_id", appUserId)
      .single();

    if (memberError || !memberRow) {
      console.error("User not found in household_members:", appUserId, memberError);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const householdId = memberRow.household_id;

    // Determine plan based on event type
    let plan: string | null = null;
    let subscriptionStatus: string | null = null;
    let subscriptionEndDate: string | null = null;

    // Extract expiration date from event
    if (event.expiration_at_ms) {
      subscriptionEndDate = new Date(event.expiration_at_ms).toISOString();
    }

    switch (eventType) {
      // Initial purchase
      case "INITIAL_PURCHASE":
      case "NON_RENEWING_PURCHASE":
        if (hasProAccess) {
          plan = "premium";
          subscriptionStatus = "active";
        }
        break;

      // Renewal
      case "RENEWAL":
        if (hasProAccess) {
          plan = "premium";
          subscriptionStatus = "active";
        }
        break;

      // Cancellation (still active until period end)
      case "CANCELLATION":
        plan = hasProAccess ? "premium" : "free";
        subscriptionStatus = "canceled";
        break;

      // Expiration (access revoked)
      case "EXPIRATION":
        plan = "free";
        subscriptionStatus = "expired";
        break;

      // Billing issue
      case "BILLING_ISSUE":
        subscriptionStatus = "past_due";
        break;

      // Product change (upgrade/downgrade)
      case "PRODUCT_CHANGE":
        if (hasProAccess) {
          plan = "premium";
          subscriptionStatus = "active";
        } else {
          plan = "free";
          subscriptionStatus = "active";
        }
        break;

      // Uncancellation (user resubscribed before period end)
      case "UNCANCELLATION":
        if (hasProAccess) {
          plan = "premium";
          subscriptionStatus = "active";
        }
        break;

      // Subscriber alias
      case "SUBSCRIBER_ALIAS":
        // No action needed
        break;

      default:
        console.log(`Unhandled RevenueCat event type: ${eventType}`);
        break;
    }

    // Update household if we have changes
    const updates: Record<string, any> = {};
    if (plan !== null) updates.plan = plan;
    if (subscriptionStatus !== null) updates.subscription_status = subscriptionStatus;
    if (subscriptionEndDate !== null) updates.subscription_end_date = subscriptionEndDate;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("households")
        .update(updates)
        .eq("id", householdId);

      if (updateError) {
        console.error("Failed to update household:", updateError);
        return new Response(JSON.stringify({ error: "Database update failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Household ${householdId} updated:`, updates);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
