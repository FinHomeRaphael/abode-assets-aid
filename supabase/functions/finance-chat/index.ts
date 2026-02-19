import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CONTENT_LENGTH = 10000;
const MAX_FINANCIAL_CONTEXT_LENGTH = 100000;

function validateRequest(body: unknown): { messages: { role: string; content: string }[]; financialContext: string } {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const { messages, financialContext } = body as Record<string, unknown>;

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    throw new Error("Invalid messages: must be a non-empty array with at most " + MAX_MESSAGES + " items");
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") throw new Error("Invalid message format");
    const { role, content } = msg as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") throw new Error("Invalid message role");
    if (typeof content !== "string" || content.length === 0 || content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      throw new Error("Invalid message content");
    }
  }

  if (typeof financialContext !== "string" || financialContext.length > MAX_FINANCIAL_CONTEXT_LENGTH) {
    throw new Error("Invalid financialContext");
  }

  return {
    messages: messages.map((m: any) => ({ role: m.role as string, content: m.content as string })),
    financialContext: financialContext as string,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, financialContext } = validateRequest(rawBody);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Tu es un conseiller financier personnel intelligent et bienveillant intégré à l'application FineHome. Tu parles en français de manière naturelle et chaleureuse.

Tu as accès aux données financières personnelles de l'utilisateur ci-dessous. Utilise-les pour donner des conseils personnalisés, concrets et actionnables.

DONNÉES FINANCIÈRES DE L'UTILISATEUR :
${financialContext}

RÈGLES :
- Réponds toujours en français
- Sois concis mais utile (pas de pavés)
- Donne des conseils personnalisés basés sur les vrais chiffres
- Utilise des emojis avec parcimonie pour rendre la conversation agréable
- Si on te pose une question hors finances personnelles, réponds brièvement puis recentre sur les finances
- Tu peux faire des calculs, projections, et suggestions d'optimisation
- Mentionne les catégories, montants et objectifs par leur nom quand c'est pertinent
- Formate tes réponses en markdown quand c'est utile (listes, gras, etc.)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés. Ajoutez des crédits dans les paramètres." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("finance-chat error:", e);
    return new Response(JSON.stringify({ error: "Erreur de traitement de la requête" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
