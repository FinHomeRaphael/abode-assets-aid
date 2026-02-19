import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { fileContent, fileType } = await req.json();

    if (!fileContent) throw new Error("No file content provided");

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
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      // Fallback: try to parse content as JSON
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
