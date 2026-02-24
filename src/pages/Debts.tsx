import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDate, formatDateLong } from '@/utils/format';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { Debt, DEBT_TYPES, getDebtEmoji, estimateEndDate, getPeriodsPerYear, calculateNextPaymentDate } from '@/types/debt';
import AddDebtModal from '@/components/AddDebtModal';
import DebtDetailModal from '@/components/DebtDetailModal';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumGate } from '@/components/PremiumPaywall';
import { CreditCard, TrendingDown, TrendingUp, Calendar, Plus, Wallet } from 'lucide-react';

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-2">
    <Icon className="w-4 h-4 text-muted-foreground" />
    <h2 className="font-semibold text-sm">{title}</h2>
  </div>
);

const Debts = () => {
  const { householdId, scopedTransactions: transactions, currentUser, financeScope, session, household } = useApp();
  const { formatAmount } = useCurrency();
  const { canAdd } = useSubscription(householdId, currentUser?.id);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  const generatePastDueTransactions = useCallback(async (debtsList: Debt[]) => {
    if (!householdId || !session?.user?.id) return debtsList;
    const userId = session.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Fetch existing auto-generated debt transactions
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('debt_id, date')
      .eq('household_id', householdId)
      .eq('is_auto_generated', true)
      .not('debt_id', 'is', null);

    const existingSet = new Set(
      (existingTx || []).map((t: any) => `${t.debt_id}_${t.date}`)
    );

    const baseCurrency = household.currency;
    const newTransactions: any[] = [];
    const debtUpdates: { id: string; remaining: number; nextDate: string | null; lastDate: string }[] = [];

    for (const d of debtsList) {
      if (d.remainingAmount <= 0) continue;
      const periodsYear = getPeriodsPerYear(d.paymentFrequency);
      const monthsIncrement = 12 / periodsYear;
      const rate = d.interestRate / 100 / periodsYear;

      const firstDate = d.nextPaymentDate || calculateNextPaymentDate(d);
      if (!firstDate) continue;

      const startDate = new Date(firstDate + 'T00:00:00');
      const targetDay = startDate.getDate();
      let periodIndex = 0;
      let remaining = d.remainingAmount;
      let lastPaidDate: string | null = null;
      let nextPayDate: string | null = null;

      const getDateForPeriod = (idx: number) => {
        const base = new Date(startDate.getFullYear(), startDate.getMonth() + idx * monthsIncrement, 1);
        const lastDayOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
        base.setDate(Math.min(targetDay, lastDayOfMonth));
        return base;
      };

      let currentDate = getDateForPeriod(0);
      while (remaining > 0) {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${dd}`;

        if (dateStr > todayStr) {
          // Future date — this is the next payment
          nextPayDate = dateStr;
          break;
        }

        // Past or today — auto-generate if not existing
        const interest = remaining * rate;
        const actualPayment = Math.min(d.paymentAmount, remaining + interest);
        const capital = Math.max(actualPayment - interest, 0);
        const key = `${d.id}_${dateStr}`;

        if (!existingSet.has(key)) {
          newTransactions.push({
            id: crypto.randomUUID(),
            household_id: householdId,
            type: 'expense',
            amount: actualPayment,
            currency: d.currency,
            base_currency: baseCurrency,
            exchange_rate: d.currency === baseCurrency ? 1 : 1,
            converted_amount: actualPayment,
            category: 'Crédit',
            emoji: getDebtEmoji(d.type),
            label: `${d.name} — Échéance`,
            date: dateStr,
            member_id: userId,
            account_id: (d as any).accountId || null,
            is_auto_generated: true,
            debt_id: d.id,
            debt_payment_type: null,
            notes: `Amortissement ${capital.toFixed(2)} + Intérêts ${interest.toFixed(2)}`,
            scope: d.scope || 'household',
            created_by: userId,
          });
        }

        remaining -= capital;
        lastPaidDate = dateStr;
        periodIndex++;
        currentDate = getDateForPeriod(periodIndex);
      }

      // Track updates if anything changed
      if (lastPaidDate && remaining !== d.remainingAmount) {
        debtUpdates.push({
          id: d.id,
          remaining: Math.max(remaining, 0),
          nextDate: nextPayDate,
          lastDate: lastPaidDate,
        });
      }
    }

    // Batch insert new transactions
    if (newTransactions.length > 0) {
      const { error } = await supabase.from('transactions').insert(newTransactions);
      if (error) console.error('Auto-generate tx error:', error);
    }

    // Update debts remaining amounts
    for (const u of debtUpdates) {
      await supabase.from('debts').update({
        remaining_amount: u.remaining,
        next_payment_date: u.nextDate,
        last_payment_date: u.lastDate,
      }).eq('id', u.id);
    }

    // Return updated debts
    if (debtUpdates.length > 0) {
      return debtsList.map(d => {
        const upd = debtUpdates.find(u => u.id === d.id);
        if (upd) return { ...d, remainingAmount: upd.remaining, nextPaymentDate: upd.nextDate || undefined, lastPaymentDate: upd.lastDate };
        return d;
      });
    }
    return debtsList;
  }, [householdId, session?.user?.id, household.currency]);

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
      const mapped = data.map((d: any) => ({
        id: d.id, householdId: d.household_id, type: d.type, name: d.name, lender: d.lender || undefined,
        initialAmount: Number(d.initial_amount), remainingAmount: Number(d.remaining_amount),
        currency: d.currency, interestRate: Number(d.interest_rate), durationYears: Number(d.duration_years),
        startDate: d.start_date, paymentFrequency: d.payment_frequency, paymentDay: d.payment_day,
        paymentAmount: Number(d.payment_amount), categoryId: d.category_id || undefined,
        nextPaymentDate: d.next_payment_date || undefined, lastPaymentDate: d.last_payment_date || undefined,
        createdAt: d.created_at, updatedAt: d.updated_at,
        scope: d.scope || 'household', createdBy: d.created_by || undefined,
        accountId: d.account_id || undefined,
      }));
      const updated = await generatePastDueTransactions(mapped);
      setDebts(updated);
    }
    if (error) console.error('Fetch debts error:', error);
    setLoading(false);
  }, [householdId, financeScope, session?.user?.id, generatePastDueTransactions]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const totalRemaining = useMemo(() => debts.reduce((s, d) => s + d.remainingAmount, 0), [debts]);
  const totalPayment = useMemo(() => debts.reduce((s, d) => s + d.paymentAmount, 0), [debts]);
  const totalRepaid = useMemo(() => debts.reduce((s, d) => s + (d.initialAmount - d.remainingAmount), 0), [debts]);

  const upcomingPayments = useMemo(() => {
    const payments: { date: string; name: string; amount: number; emoji: string; detail?: string }[] = [];
    const now = new Date();
    const limitDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

    for (const d of debts) {
      if (d.remainingAmount <= 0) continue;
      const periodsYear = getPeriodsPerYear(d.paymentFrequency);
      const monthsIncrement = 12 / periodsYear;
      const rate = d.interestRate / 100 / periodsYear;

      // Find first payment date
      let firstDate = d.nextPaymentDate || calculateNextPaymentDate(d);
      if (!firstDate) continue;

      const startDate = new Date(firstDate + 'T00:00:00');
      const targetDay = startDate.getDate(); // original day (e.g. 31)
      let periodIndex = 0;
      let remaining = d.remainingAmount;

      const getDateForPeriod = (idx: number) => {
        const base = new Date(startDate.getFullYear(), startDate.getMonth() + idx * monthsIncrement, 1);
        const lastDayOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
        base.setDate(Math.min(targetDay, lastDayOfMonth));
        return base;
      };

      let currentDate = getDateForPeriod(0);
      while (currentDate <= limitDate && remaining > 0) {
        const interest = remaining * rate;
        const actualPayment = Math.min(d.paymentAmount, remaining + interest);
        const capital = Math.max(actualPayment - interest, 0);

        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${dd}`;

        payments.push({
          date: dateStr,
          name: d.name,
          amount: actualPayment,
          emoji: getDebtEmoji(d.type),
          detail: `Amortissement ${formatAmount(capital)} + Intérêts ${formatAmount(interest)}`,
        });

        remaining -= capital;
        periodIndex++;
        currentDate = getDateForPeriod(periodIndex);
      }
    }
    return payments.sort((a, b) => a.date.localeCompare(b.date));
  }, [debts]);

  const handleDebtAdded = () => { fetchDebts(); setShowAdd(false); toast.success('Dette ajoutée ✓'); };
  const handleDebtUpdated = () => { fetchDebts(); setSelectedDebt(null); };

  const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><span className="text-2xl">⏳</span></div></Layout>;
  }

  return (
    <Layout>
      <PremiumGate feature="les dettes & crédits" description="Gérez tous vos crédits, prêts et dettes avec un suivi détaillé des remboursements.">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 via-transparent to-transparent h-64" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="relative space-y-5">
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Dettes</h1>
          <button onClick={() => setShowAdd(true)} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </motion.div>

        {/* Summary */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Total dû</p>
            <p className="font-mono-amount font-semibold text-destructive text-sm">{formatAmount(totalRemaining)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Mensualités</p>
            <p className="font-mono-amount font-semibold text-sm">{formatAmount(totalPayment)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Remboursé</p>
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
              const repaidPct = d.initialAmount > 0 ? Math.min(((d.initialAmount - d.remainingAmount) / d.initialAmount) * 100, 100) : 0;
              const endDate = estimateEndDate(d);
              const nextDate = d.nextPaymentDate || calculateNextPaymentDate(d);
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDebt(d)}
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
                    <span className="font-mono-amount">{formatAmount(d.remainingAmount)} restant / {formatAmount(d.initialAmount)}</span>
                    <span className="font-mono-amount">{Math.round(repaidPct)}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                    {nextDate && <span>Prochaine : {formatDateLong(nextDate)}</span>}
                    {endDate && <span>Fin : {formatDateLong(endDate)}</span>}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Upcoming payments */}
        {upcomingPayments.length > 0 && (
          <motion.div variants={fadeUp}>
            <SectionTitle icon={Calendar} title="Échéances à venir" />
            <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
              {upcomingPayments.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base">{p.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDateLong(p.date)}</p>
                      {p.detail && <p className="text-[9px] text-muted-foreground/70">{p.detail}</p>}
                    </div>
                  </div>
                  <p className="font-mono-amount text-sm font-semibold text-destructive">-{formatAmount(p.amount)}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      <AddDebtModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={handleDebtAdded} />
      <DebtDetailModal debt={selectedDebt} onClose={() => setSelectedDebt(null)} onUpdated={handleDebtUpdated} />
      </PremiumGate>
    </Layout>
  );
};

export default Debts;
