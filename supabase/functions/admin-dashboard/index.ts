import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "raphael@mybat.ch";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all stats in parallel
    const [profilesRes, householdsRes, transactionsCountRes, debtsCountRes, budgetsCountRes, savingsCountRes] = await Promise.all([
      supabase.from("profiles").select("id, email, first_name, last_name, created_at, onboarding_done, plan"),
      supabase.from("households").select("id, name, default_currency, plan, created_at, stripe_subscription_id, subscription_status"),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("debts").select("id", { count: "exact", head: true }),
      supabase.from("budgets").select("id", { count: "exact", head: true }),
      supabase.from("savings_goals").select("id", { count: "exact", head: true }),
    ]);

    // Get household members to map users to households
    const { data: members } = await supabase.from("household_members").select("user_id, household_id, role");

    const profiles = profilesRes.data || [];
    const households = householdsRes.data || [];
    const membersMap: Record<string, { household_id: string; role: string }> = {};
    (members || []).forEach((m: any) => {
      membersMap[m.user_id] = { household_id: m.household_id, role: m.role };
    });

    const householdsMap: Record<string, any> = {};
    households.forEach((h: any) => {
      householdsMap[h.id] = h;
    });

    // Build user list with household info
    const users = profiles.map((p: any) => {
      const membership = membersMap[p.id];
      const household = membership ? householdsMap[membership.household_id] : null;
      return {
        id: p.id,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        created_at: p.created_at,
        onboarding_done: p.onboarding_done,
        role: membership?.role || null,
        household_id: household?.id || null,
        household_name: household?.name || null,
        household_plan: household?.plan || "free",
        household_currency: household?.default_currency || null,
      };
    });

    // Stats
    const planCounts = { free: 0, foyer: 0, famille: 0 };
    households.forEach((h: any) => {
      if (h.plan === "famille") planCounts.famille++;
      else if (h.plan === "foyer") planCounts.foyer++;
      else planCounts.free++;
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const newUsersThisWeek = profiles.filter((p: any) => new Date(p.created_at) >= weekAgo).length;
    const newUsersThisMonth = profiles.filter((p: any) => new Date(p.created_at) >= monthAgo).length;

    const stats = {
      total_users: profiles.length,
      total_households: households.length,
      new_users_week: newUsersThisWeek,
      new_users_month: newUsersThisMonth,
      plan_distribution: planCounts,
      total_transactions: transactionsCountRes.count || 0,
      total_debts: debtsCountRes.count || 0,
      total_budgets: budgetsCountRes.count || 0,
      total_savings: savingsCountRes.count || 0,
    };

    return new Response(JSON.stringify({ stats, users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
