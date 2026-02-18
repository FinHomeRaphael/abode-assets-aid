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
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const Debts = () => {
  const { householdId, transactions } = useApp();
  const { formatAmount } = useCurrency();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  const fetchDebts = useCallback(async () => {
    if (!householdId) return;
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (data) {
      setDebts(data.map((d: any) => ({
        id: d.id,
        householdId: d.household_id,
        type: d.type,
        name: d.name,
        lender: d.lender || undefined,
        initialAmount: Number(d.initial_amount),
        remainingAmount: Number(d.remaining_amount),
        currency: d.currency,
        interestRate: Number(d.interest_rate),
        durationYears: Number(d.duration_years),
        startDate: d.start_date,
        paymentFrequency: d.payment_frequency,
        paymentDay: d.payment_day,
        paymentAmount: Number(d.payment_amount),
        categoryId: d.category_id || undefined,
        nextPaymentDate: d.next_payment_date || undefined,
        lastPaymentDate: d.last_payment_date || undefined,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })));
    }
    if (error) console.error('Fetch debts error:', error);
    setLoading(false);
  }, [householdId]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const totalRemaining = useMemo(() => debts.reduce((s, d) => s + d.remainingAmount, 0), [debts]);
  const totalPayment = useMemo(() => debts.reduce((s, d) => s + d.paymentAmount, 0), [debts]);
  const totalRepaid = useMemo(() => debts.reduce((s, d) => s + (d.initialAmount - d.remainingAmount), 0), [debts]);

  // Next 5 upcoming payments across all debts
  const upcomingPayments = useMemo(() => {
    const payments: { date: string; name: string; amount: number; emoji: string; detail?: string }[] = [];
    for (const d of debts) {
      if (d.remainingAmount <= 0) continue;
      const nextDate = d.nextPaymentDate || calculateNextPaymentDate(d);
      if (nextDate) {
        const periodsYear = getPeriodsPerYear(d.paymentFrequency);
        const interest = d.remainingAmount * (d.interestRate / 100 / periodsYear);
        const total = d.paymentAmount + interest;
        const detail = `Capital ${formatAmount(d.paymentAmount)} + Intérêts ${formatAmount(interest)}`;
        payments.push({ date: nextDate, name: d.name, amount: total, emoji: getDebtEmoji(d.type), detail });
      }
    }
    return payments.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [debts]);

  const handleDebtAdded = () => {
    fetchDebts();
    setShowAdd(false);
    toast.success('Dette ajoutée ✓');
  };

  const handleDebtUpdated = () => {
    fetchDebts();
    setSelectedDebt(null);
  };

  const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><span className="text-2xl">⏳</span></div></Layout>;
  }

  return (
    <Layout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <h1 className="text-xl font-bold">💳 Dettes</h1>
          <button onClick={() => setShowAdd(true)} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            + Ajouter
          </button>
        </motion.div>

        {/* Summary cards */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
          <div className="card-elevated p-3.5 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Total dû</p>
            <p className="font-mono-amount font-bold text-destructive text-sm">{formatAmount(totalRemaining)}</p>
          </div>
          <div className="card-elevated p-3.5 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Mensualités</p>
            <p className="font-mono-amount font-bold text-sm">{formatAmount(totalPayment)}</p>
          </div>
          <div className="card-elevated p-3.5 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Remboursé</p>
            <p className="font-mono-amount font-bold text-success text-sm">{formatAmount(totalRepaid)}</p>
          </div>
        </motion.div>

        {/* Debt list */}
        {debts.length === 0 ? (
          <motion.div variants={fadeUp} className="card-elevated p-8 text-center text-muted-foreground text-sm">
            Aucune dette enregistrée. Ajoutez votre premier crédit !
          </motion.div>
        ) : (
          <motion.div variants={fadeUp} className="space-y-3">
            {debts.map(d => {
              const repaidPct = d.initialAmount > 0 ? Math.min(((d.initialAmount - d.remainingAmount) / d.initialAmount) * 100, 100) : 0;
              const endDate = estimateEndDate(d);
              const nextDate = d.nextPaymentDate || calculateNextPaymentDate(d);
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDebt(d)}
                  className="card-elevated p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getDebtEmoji(d.type)}</span>
                      <div>
                        <p className="font-semibold text-sm">{d.name}</p>
                        {d.lender && <p className="text-xs text-muted-foreground">{d.lender}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-amount text-sm font-semibold">{formatAmount(d.paymentAmount)}/mois</p>
                      <p className="text-xs text-muted-foreground">{d.interestRate}%</p>
                    </div>
                  </div>
                  <Progress value={repaidPct} className="h-2 mb-1.5" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatAmount(d.remainingAmount)} restant / {formatAmount(d.initialAmount)}</span>
                    <span>{Math.round(repaidPct)}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    {nextDate && <span>Prochaine : {formatDateLong(nextDate)}</span>}
                    {endDate && <span>Fin estimée : {formatDateLong(endDate)}</span>}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Upcoming payments */}
        {upcomingPayments.length > 0 && (
          <motion.div variants={fadeUp}>
            <h2 className="font-semibold text-base mb-3">📅 Échéances à venir</h2>
            <div className="card-elevated divide-y divide-border/50 overflow-hidden">
              {upcomingPayments.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{p.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDateLong(p.date)}</p>
                      {p.detail && <p className="text-xs text-muted-foreground/70">{p.detail}</p>}
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
