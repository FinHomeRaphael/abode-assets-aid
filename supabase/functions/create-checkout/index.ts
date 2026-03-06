import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_ID_REGEX = /^price_[a-zA-Z0-9]{8,}$/;

// Lifetime price IDs for one-time payment mode
const LIFETIME_PRICE_IDS = [
  "price_1T7y3XIw2TO0HaPO5RiFbGbI",  // Foyer lifetime
  "price_1T7y4KIw2TO0HaPOu1OaQ0GA",  // Famille lifetime
];

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

function getPlanType(priceId: string): string {
  if (FAMILLE_PRICE_IDS.includes(priceId)) return "famille";
  return "foyer";
}

function validateRequest(body: unknown): { priceId: string } {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const { priceId } = body as Record<string, unknown>;

  if (typeof priceId !== "string" || !PRICE_ID_REGEX.test(priceId)) {
    throw new Error("Invalid priceId format");
  }

  return { priceId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { priceId } = validateRequest(rawBody);
    const isLifetime = LIFETIME_PRICE_IDS.includes(priceId);
    const planType = getPlanType(priceId);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://abode-assets-aid.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isLifetime ? "payment" : "subscription",
      success_url: `${origin}/profile?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      metadata: { user_id: user.id, plan_type: planType, is_lifetime: isLifetime ? 'true' : 'false' },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("create-checkout error:", error);
    return new Response(JSON.stringify({ error: "Erreur lors de la création du paiement" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
