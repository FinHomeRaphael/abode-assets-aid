import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_EMAIL_LENGTH = 255;
const MAX_NAME_LENGTH = 200;
const MAX_URL_LENGTH = 2000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRequest(body: unknown): { email: string; inviterName: string; householdName: string; inviteUrl: string } {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const { email, inviterName, householdName, inviteUrl } = body as Record<string, unknown>;

  if (typeof email !== "string" || !EMAIL_REGEX.test(email) || email.length > MAX_EMAIL_LENGTH) {
    throw new Error("Invalid email address");
  }
  if (typeof inviteUrl !== "string" || inviteUrl.length === 0 || inviteUrl.length > MAX_URL_LENGTH) {
    throw new Error("Invalid invite URL");
  }

  return {
    email: email.trim(),
    inviterName: typeof inviterName === "string" ? inviterName.slice(0, MAX_NAME_LENGTH) : "Quelqu'un",
    householdName: typeof householdName === "string" ? householdName.slice(0, MAX_NAME_LENGTH) : "un foyer",
    inviteUrl: inviteUrl.trim(),
  };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, inviterName, householdName, inviteUrl } = validateRequest(rawBody);

    const safeInviterName = escapeHtml(inviterName);
    const safeHouseholdName = escapeHtml(householdName);

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">🏠</span>
          <h1 style="font-size: 24px; font-weight: 700; margin: 8px 0 0;">FineHome</h1>
        </div>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <h2 style="font-size: 18px; margin: 0 0 8px;">Vous avez été invité(e) !</h2>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">
            <strong>${safeInviterName}</strong> vous invite à rejoindre le foyer <strong>"${safeHouseholdName}"</strong> sur FineHome.
          </p>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px;">
            FineHome est une application de gestion de finances familiales. En rejoignant ce foyer, vous pourrez suivre les dépenses, budgets et objectifs d'épargne ensemble.
          </p>
          <a href="${escapeHtml(inviteUrl)}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Accepter l'invitation
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Ce lien expire dans 7 jours. Si vous n'avez pas demandé cette invitation, ignorez cet email.
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FineHome <noreply@fin-home.io>',
        to: email,
        subject: `${inviterName} vous invite à rejoindre son foyer sur FineHome`,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', data);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error sending invitation email:', error);
    return new Response(JSON.stringify({ error: "Erreur lors de l'envoi de l'email" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
