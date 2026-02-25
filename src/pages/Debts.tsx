import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateLong } from '@/utils/format';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { Debt, DEBT_TYPES, getDebtEmoji, getPeriodsPerYear, calculateNextPaymentDate } from '@/types/debt';
import AddDebtModal from '@/components/AddDebtModal';
import DebtDetailModal from '@/components/DebtDetailModal';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumGate } from '@/components/PremiumPaywall';
import { CreditCard, Plus, ArrowLeft, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';

interface UpcomingPayment {
  id: string;
  debt_id: string;
  due_date: string;
  period_number: number;
  capital_before: number;
  capital_after: number;
  interest_amount: number;
  principal_amount: number;
  total_amount: number;
  status: string;
  debtName: string;
  debtEmoji: string;
  debtType: string;
}

const Debts = () => {
  const { householdId, session, household, financeScope } = useApp();
  const { formatAmount } = useCurrency();
  const { canAdd } = useSubscription(householdId, session?.user?.id);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const fetchDebts = useCallback(async () => {
    if (!householdId) return;
    const userId = session?.user?.id;
    let query = supabase.from('debts').select('*');
    if (financeScope === 'personal') {
      query = query.eq('scope', 'personal').eq('created_by', userId);
    } else {
      query = query.eq('household_id', householdId).eq('scope', 'household');
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (data) {
      setDebts(data.map((d: any) => ({
        id: d.id, householdId: d.household_id, type: d.type, name: d.name, lender: d.lender || undefined,
        initialAmount: Number(d.initial_amount), remainingAmount: Number(d.remaining_amount),
        currency: d.currency, interestRate: Number(d.interest_rate), durationYears: Number(d.duration_years),
        startDate: d.start_date, paymentFrequency: d.payment_frequency, paymentDay: d.payment_day,
        paymentAmount: Number(d.payment_amount), categoryId: d.category_id || undefined,
        nextPaymentDate: d.next_payment_date || undefined, lastPaymentDate: d.last_payment_date || undefined,
        createdAt: d.created_at, updatedAt: d.updated_at,
        scope: d.scope || 'household', createdBy: d.created_by || undefined,
        amortizationType: d.amortization_type || 'fixed_annuity',
        accountId: d.account_id || undefined,
      })));
    }
    if (error) console.error('Fetch debts error:', error);
    setLoading(false);
  }, [householdId, financeScope, session?.user?.id]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  // Fetch upcoming schedules for all debts (next 2 years)
  const fetchUpcomingPayments = useCallback(async () => {
    if (!householdId || debts.length === 0) { setUpcomingPayments([]); return; }
    const today = new Date().toISOString().split('T')[0];
    const twoYearsLater = new Date();
    twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
    const maxDate = twoYearsLater.toISOString().split('T')[0];

    const debtIds = debts.map(d => d.id);
    const { data, error } = await supabase
      .from('debt_schedules')
      .select('*')
      .in('debt_id', debtIds)
      .in('status', ['prevu', 'ajuste'])
      .gte('due_date', today)
      .lte('due_date', maxDate)
      .order('due_date', { ascending: true });

    if (data) {
      const debtMap = new Map(debts.map(d => [d.id, d]));
      setUpcomingPayments(data.map((r: any) => {
        const debt = debtMap.get(r.debt_id);
        return {
          id: r.id,
          debt_id: r.debt_id,
          due_date: r.due_date,
          period_number: r.period_number,
          capital_before: Number(r.capital_before),
          capital_after: Number(r.capital_after),
          interest_amount: Number(r.interest_amount),
          principal_amount: Number(r.principal_amount),
          total_amount: Number(r.total_amount),
          status: r.status,
          debtName: debt?.name || '',
          debtEmoji: debt ? getDebtEmoji(debt.type) : '💳',
          debtType: debt?.type || '',
        };
      }));
    }
    if (error) console.error('Fetch upcoming error:', error);
  }, [householdId, debts]);

  useEffect(() => { fetchUpcomingPayments(); }, [fetchUpcomingPayments]);

  // Compute real remaining per debt from upcoming payments (first upcoming = capital_before)
  const debtRemainingMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of debts) {
      // Find the first unpaid schedule row for this debt
      const firstUpcoming = upcomingPayments.find(p => p.debt_id === d.id);
      map.set(d.id, firstUpcoming ? firstUpcoming.capital_before : d.remainingAmount);
    }
    return map;
  }, [debts, upcomingPayments]);

  const getRealRemaining = (d: Debt) => debtRemainingMap.get(d.id) ?? d.remainingAmount;

  const totalRemaining = useMemo(() => debts.reduce((s, d) => s + getRealRemaining(d), 0), [debts, debtRemainingMap]);
  const totalInitial = useMemo(() => debts.reduce((s, d) => s + d.initialAmount, 0), [debts]);
  const totalPayment = useMemo(() => debts.reduce((s, d) => s + d.paymentAmount, 0), [debts]);
  const totalRepaid = useMemo(() => debts.reduce((s, d) => s + (d.initialAmount - getRealRemaining(d)), 0), [debts, debtRemainingMap]);

  const selectedDebt = useMemo(() => debts.find(d => d.id === selectedDebtId) || null, [debts, selectedDebtId]);

  const handleDebtAdded = () => { fetchDebts(); setShowAdd(false); toast.success('Dette ajoutée ✓'); };
  const handleDebtUpdated = () => { fetchDebts(); setSelectedDebtId(null); };

  const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><span className="text-2xl">⏳</span></div></Layout>;
  }

  // If a debt is selected, show detail view
  if (selectedDebt) {
    return (
      <Layout>
        <PremiumGate feature="les dettes & crédits" description="Gérez tous vos crédits, prêts et dettes avec un suivi détaillé des remboursements.">
          <DebtDetailModal
            debt={selectedDebt}
            onClose={() => setSelectedDebtId(null)}
            onUpdated={handleDebtUpdated}
          />
        </PremiumGate>
      </Layout>
    );
  }

  return (
    <Layout>
      <PremiumGate feature="les dettes & crédits" description="Gérez tous vos crédits, prêts et dettes avec un suivi détaillé des remboursements.">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 via-transparent to-transparent h-64" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="relative space-y-5">
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Dettes & Crédits</h1>
          <button onClick={() => setShowAdd(true)} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </motion.div>

        {/* Summary */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Capital emprunté</p>
            <p className="font-mono-amount font-semibold text-sm">{formatAmount(totalInitial)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Capital restant dû</p>
            <p className="font-mono-amount font-semibold text-destructive text-sm">{formatAmount(totalRemaining)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Échéance moy.</p>
            <p className="font-mono-amount font-semibold text-sm">{formatAmount(debts.length > 0 ? totalPayment / debts.length : 0)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Total remboursé</p>
            <p className="font-mono-amount font-semibold text-success text-sm">{formatAmount(totalRepaid)}</p>
          </div>
        </motion.div>

        {/* Debt list */}
        {debts.length === 0 ? (
          <motion.div variants={fadeUp} className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
            Aucune dette enregistrée. Ajoutez votre premier crédit !
          </motion.div>
        ) : (
          <motion.div variants={fadeUp} className="space-y-2">
            {debts.map(d => {
              const remaining = getRealRemaining(d);
              const repaidPct = d.initialAmount > 0 ? Math.min(((d.initialAmount - remaining) / d.initialAmount) * 100, 100) : 0;
              const nextDate = d.nextPaymentDate || calculateNextPaymentDate(d);
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDebtId(d.id)}
                  className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getDebtEmoji(d.type)}</span>
                      <div>
                        <p className="font-semibold text-sm">{d.name}</p>
                        {d.lender && <p className="text-[10px] text-muted-foreground">{d.lender}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-amount text-sm font-semibold">{formatAmount(d.paymentAmount)}/mois</p>
                      <p className="text-[10px] text-muted-foreground">{d.interestRate}%</p>
                    </div>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full transition-all ${repaidPct >= 100 ? 'bg-success' : repaidPct >= 50 ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${repaidPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-mono-amount">{formatAmount(remaining)} restant / {formatAmount(d.initialAmount)}</span>
                    <span className="font-mono-amount">{Math.round(repaidPct)}%</span>
                  </div>
                  {nextDate && (
                    <div className="mt-1.5 text-[10px] text-muted-foreground">
                      Prochaine échéance : {formatDateLong(nextDate)}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Upcoming payments - next 2 years */}
        {upcomingPayments.length > 0 && (
          <motion.div variants={fadeUp} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <div>
                  <h2 className="text-sm font-semibold">Prochaines échéances</h2>
                  <p className="text-[10px] text-muted-foreground">{upcomingPayments.length} échéances sur 2 ans</p>
                </div>
              </div>
              {upcomingPayments.length > 12 && (
                <button
                  onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                  className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                >
                  {showAllUpcoming ? 'Réduire' : 'Tout voir'}
                  {showAllUpcoming ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <div className="divide-y divide-border">
              {(showAllUpcoming ? upcomingPayments : upcomingPayments.slice(0, 12)).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedDebtId(p.debt_id)}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="text-base shrink-0">{p.debtEmoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{formatDateLong(p.due_date)}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {p.debtName} · Int. {formatAmount(p.interest_amount)} · Cap. {formatAmount(p.principal_amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 font-mono-amount">
                        {formatAmount(p.capital_before)} → {formatAmount(p.capital_after)}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-amount text-sm font-semibold text-destructive shrink-0">
                    -{formatAmount(p.total_amount)}
                  </span>
                </div>
              ))}
            </div>
            {!showAllUpcoming && upcomingPayments.length > 12 && (
              <div className="p-3 text-center border-t border-border">
                <button onClick={() => setShowAllUpcoming(true)} className="text-xs text-primary hover:text-primary/80 font-medium">
                  Voir les {upcomingPayments.length - 12} échéances restantes
                </button>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      <AddDebtModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={handleDebtAdded} />
      </PremiumGate>
    </Layout>
  );
};

export default Debts;
