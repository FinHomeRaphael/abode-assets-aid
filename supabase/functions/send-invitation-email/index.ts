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

    const logoUrl = 'https://ptcuiawjfhvgnubpathd.supabase.co/storage/v1/object/public/email-assets/logo.png';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 520px; margin: 0 auto; padding: 40px 24px;">
          <!-- Logo -->
          <div style="text-align: center; margin-bottom: 32px;">
            <img src="${logoUrl}" alt="FinHome" style="height: 48px; width: auto;" />
          </div>

          <!-- Main Card -->
          <div style="background: #f8fafb; border: 1px solid #e8eeef; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
            <h1 style="font-size: 22px; font-weight: 700; color: #1c2127; margin: 0 0 8px; text-align: center;">
              Vous êtes invité(e) ! 🎉
            </h1>
            <div style="width: 40px; height: 3px; background: hsl(168, 30%, 45%); margin: 16px auto 20px; border-radius: 2px;"></div>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px; text-align: center;">
              <strong>${safeInviterName}</strong> vous invite à rejoindre le foyer
            </p>
            <div style="background: #ffffff; border: 1px solid #e8eeef; border-radius: 8px; padding: 12px 16px; margin: 0 0 20px; text-align: center;">
              <span style="font-size: 16px; font-weight: 600; color: hsl(168, 30%, 45%);">🏠 ${safeHouseholdName}</span>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
              Gérez vos finances en famille : dépenses, budgets et objectifs d'épargne, ensemble sur FinHome.
            </p>
            <div style="text-align: center;">
              <a href="${escapeHtml(inviteUrl)}" style="display: inline-block; background: hsl(168, 30%, 45%); color: #f0faf5; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.01em;">
                Accepter l'invitation
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding-top: 8px;">
            <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
              Ce lien expire dans 7 jours.<br/>Si vous n'avez pas demandé cette invitation, ignorez cet email.
            </p>
            <p style="color: #d1d5db; font-size: 11px; margin: 16px 0 0;">
              © ${new Date().getFullYear()} FinHome · Gestion de finances familiales
            </p>
          </div>
        </div>
      </body>
      </html>
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
