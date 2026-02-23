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
import { CreditCard, TrendingDown, TrendingUp, Calendar, Plus, Wallet } from 'lucide-react';

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="w-3.5 h-3.5 text-primary" />
    </div>
    <h2 className="font-semibold text-sm">{title}</h2>
  </div>
);

const Debts = () => {
  const { householdId, scopedTransactions: transactions, currentUser, financeScope, session } = useApp();
  const { formatAmount } = useCurrency();
  const { canAdd } = useSubscription(householdId, currentUser?.id);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

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
      })));
    }
    if (error) console.error('Fetch debts error:', error);
    setLoading(false);
  }, [householdId, financeScope, session?.user?.id]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const totalRemaining = useMemo(() => debts.reduce((s, d) => s + d.remainingAmount, 0), [debts]);
  const totalPayment = useMemo(() => debts.reduce((s, d) => s + d.paymentAmount, 0), [debts]);
  const totalRepaid = useMemo(() => debts.reduce((s, d) => s + (d.initialAmount - d.remainingAmount), 0), [debts]);

  const upcomingPayments = useMemo(() => {
    const payments: { date: string; name: string; amount: number; emoji: string; detail?: string }[] = [];
    for (const d of debts) {
      if (d.remainingAmount <= 0) continue;
      const nextDate = d.nextPaymentDate || calculateNextPaymentDate(d);
      if (nextDate) {
        const periodsYear = getPeriodsPerYear(d.paymentFrequency);
        const interest = d.remainingAmount * (d.interestRate / 100 / periodsYear);
        const capital = Math.max(d.paymentAmount - interest, 0);
        payments.push({ date: nextDate, name: d.name, amount: d.paymentAmount, emoji: getDebtEmoji(d.type), detail: `Capital ${formatAmount(capital)} + Intérêts ${formatAmount(interest)}` });
      }
    }
    return payments.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
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
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={fadeUp} className="space-y-3">
          <h1 className="text-xl font-bold">Dettes</h1>
          <button onClick={() => setShowAdd(true)} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </motion.div>

        {/* Summary */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2">
          <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-3 text-center">
            <TrendingDown className="w-3.5 h-3.5 text-destructive mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground mb-0.5">Total dû</p>
            <p className="font-mono-amount font-bold text-destructive text-sm">{formatAmount(totalRemaining)}</p>
          </div>
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-center">
            <Wallet className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground mb-0.5">Mensualités</p>
            <p className="font-mono-amount font-bold text-sm">{formatAmount(totalPayment)}</p>
          </div>
          <div className="bg-success/5 border border-success/15 rounded-xl p-3 text-center">
            <TrendingUp className="w-3.5 h-3.5 text-success mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground mb-0.5">Remboursé</p>
            <p className="font-mono-amount font-bold text-success text-sm">{formatAmount(totalRepaid)}</p>
          </div>
        </motion.div>

        {/* Debt list */}
        {debts.length === 0 ? (
          <motion.div variants={fadeUp} className="bg-secondary/20 border border-border/30 rounded-2xl p-8 text-center text-muted-foreground text-sm">
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
                  className="bg-secondary/20 border border-border/30 rounded-2xl p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
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
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
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
            <div className="bg-secondary/20 border border-border/30 rounded-2xl divide-y divide-border/30 overflow-hidden">
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
    </Layout>
  );
};

export default Debts;
