import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { Navigate } from "react-router-dom";
import BackHeader from "@/components/BackHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Home, TrendingUp, CreditCard, PiggyBank, Target, CalendarDays, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ADMIN_EMAIL = "raphael@mybat.ch";

interface AdminStats {
  total_users: number;
  total_households: number;
  new_users_week: number;
  new_users_month: number;
  plan_distribution: { free: number; foyer: number; famille: number };
  total_transactions: number;
  total_debts: number;
  total_budgets: number;
  total_savings: number;
}

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  created_at: string;
  onboarding_done: boolean;
  role: string | null;
  household_id: string | null;
  household_name: string | null;
  household_plan: string;
  household_currency: string | null;
}

const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  foyer: "bg-primary/15 text-primary",
  famille: "bg-accent text-accent-foreground",
};

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const { session, loading: appLoading } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("admin-dashboard", {
      headers: { Authorization: `Bearer ${s?.access_token}` },
    });
    if (res.error) {
      toast.error("Erreur chargement admin");
    } else {
      setStats(res.data.stats);
      setUsers(res.data.users);
    }
    setLoading(false);
  };

  const handlePlanChange = async (householdId: string, newPlan: string) => {
    setUpdatingPlan(householdId);
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("admin-update-plan", {
      body: { household_id: householdId, plan: newPlan },
      headers: { Authorization: `Bearer ${s?.access_token}` },
    });
    if (res.error) {
      toast.error("Erreur mise à jour du plan");
    } else {
      toast.success(`Plan mis à jour → ${newPlan}`);
      setUsers(prev => prev.map(u => u.household_id === householdId ? { ...u, household_plan: newPlan } : u));
    }
    setUpdatingPlan(null);
  };

  if (appLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.first_name.toLowerCase().includes(q) || (u.last_name || "").toLowerCase().includes(q) || (u.household_name || "").toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto">
      <BackHeader title="Administration" fallback="/" />

      {loading || !stats ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Users} label="Utilisateurs" value={stats.total_users} sub={`+${stats.new_users_week} cette semaine · +${stats.new_users_month} ce mois`} />
            <StatCard icon={Home} label="Foyers" value={stats.total_households} />
            <StatCard icon={TrendingUp} label="Transactions" value={stats.total_transactions} />
            <StatCard icon={CreditCard} label="Dettes" value={stats.total_debts} />
            <StatCard icon={Target} label="Budgets" value={stats.total_budgets} />
            <StatCard icon={PiggyBank} label="Objectifs épargne" value={stats.total_savings} />
          </div>

          {/* Plan distribution */}
          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Répartition des plans</h3>
            <div className="flex gap-4 items-end">
              {(["free", "foyer", "famille"] as const).map(plan => {
                const count = stats.plan_distribution[plan];
                const pct = stats.total_households ? Math.round((count / stats.total_households) * 100) : 0;
                return (
                  <div key={plan} className="flex-1 text-center">
                    <div className="text-2xl font-bold text-foreground">{count}</div>
                    <div className="text-xs text-muted-foreground capitalize">{plan === "free" ? "Gratuit" : plan === "foyer" ? "Foyer" : "Famille"}</div>
                    <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${plan === "free" ? "bg-muted-foreground/40" : plan === "foyer" ? "bg-primary" : "bg-accent-foreground"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Users table */}
          <div className="rounded-xl border border-border bg-card">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <h3 className="text-sm font-medium text-foreground">Utilisateurs ({filtered.length})</h3>
              <div className="flex-1 max-w-xs relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Utilisateur</th>
                    <th className="p-3 font-medium hidden md:table-cell">Foyer</th>
                    <th className="p-3 font-medium">Plan</th>
                    <th className="p-3 font-medium hidden md:table-cell">Rôle</th>
                    <th className="p-3 font-medium hidden md:table-cell">Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="font-medium text-foreground">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">
                        {u.household_name || "—"}
                      </td>
                      <td className="p-3">
                        {u.household_id ? (
                          <Select
                            value={u.household_plan}
                            onValueChange={val => handlePlanChange(u.household_id!, val)}
                            disabled={updatingPlan === u.household_id}
                          >
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Gratuit</SelectItem>
                              <SelectItem value="foyer">Foyer</SelectItem>
                              <SelectItem value="famille">Famille</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary" className="text-xs">—</Badge>
                        )}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-xs capitalize">{u.role || "—"}</Badge>
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">
                        {format(new Date(u.created_at), "d MMM yyyy", { locale: fr })}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucun résultat</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
