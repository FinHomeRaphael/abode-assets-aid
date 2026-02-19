import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FILE_CONTENT_LENGTH = 5_000_000; // 5MB
const VALID_FILE_TYPES = ["pdf", "csv", "text"];

function validateRequest(body: unknown): { fileContent: string; fileType: string } {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const { fileContent, fileType } = body as Record<string, unknown>;

  if (typeof fileContent !== "string" || fileContent.length === 0 || fileContent.length > MAX_FILE_CONTENT_LENGTH) {
    throw new Error("Invalid or too large file content");
  }

  const ft = typeof fileType === "string" ? fileType.toLowerCase() : "text";
  if (!VALID_FILE_TYPES.includes(ft)) {
    throw new Error("Invalid file type. Must be one of: " + VALID_FILE_TYPES.join(", "));
  }

  return { fileContent: fileContent as string, fileType: ft };
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileContent, fileType } = validateRequest(rawBody);

    const systemPrompt = `Tu es un expert en extraction de données bancaires. L'utilisateur te fournit le contenu d'un relevé bancaire (PDF converti en texte ou image base64).

Tu dois extraire TOUTES les transactions et les retourner au format JSON.

RÈGLES CRITIQUES :
- Les DÉPENSES (achats, prélèvements, virements sortants, CB, etc.) doivent avoir un montant NÉGATIF
- Les REVENUS (salaire, virements entrants, remboursements, etc.) doivent avoir un montant POSITIF
- Utilise le signe tel qu'il apparaît dans le relevé. Si un montant est dans la colonne "Débit", il est négatif. Si dans "Crédit", il est positif.
- Si le relevé montre des montants sans signe mais avec des colonnes séparées débit/crédit, mets un signe négatif pour les débits.
- Les dates doivent être au format YYYY-MM-DD
- Catégorise automatiquement chaque transaction parmi : Alimentation, Logement, Transport, Santé, Loisirs, Shopping, Abonnements, Éducation, Voyages, Restaurants, Services, Impôts, Salaire, Freelance, Investissement, Allocation, Autre`;

    const userContent = fileType === "pdf" 
      ? [
          { type: "text", text: "Voici un relevé bancaire. Extrais toutes les transactions en JSON. Retourne UNIQUEMENT un tableau JSON, sans markdown ni explication." },
          { type: "image_url", image_url: { url: fileContent } }
        ]
      : [
          { type: "text", text: `Voici le contenu d'un relevé bancaire CSV/texte. Extrais toutes les transactions en JSON. Retourne UNIQUEMENT un tableau JSON, sans markdown ni explication.\n\nContenu:\n${fileContent}` }
        ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_transactions",
            description: "Extract all transactions from a bank statement",
            parameters: {
              type: "object",
              properties: {
                transactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string", description: "Date au format YYYY-MM-DD" },
                      label: { type: "string", description: "Libellé de la transaction" },
                      amount: { type: "number", description: "Montant signé (négatif = dépense, positif = revenu)" },
                      category: { type: "string", description: "Catégorie parmi: Alimentation, Logement, Transport, Santé, Loisirs, Shopping, Abonnements, Éducation, Voyages, Restaurants, Services, Impôts, Salaire, Freelance, Investissement, Allocation, Autre" },
                    },
                    required: ["date", "label", "amount", "category"],
                  },
                },
              },
              required: ["transactions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_transactions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans quelques secondes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const transactions = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify({ transactions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Could not extract transactions from AI response");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ transactions: parsed.transactions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-bank-statement error:", e);
    return new Response(JSON.stringify({ error: "Erreur lors de l'analyse du relevé" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
