import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import BackHeader from '@/components/BackHeader';
import { CategoryIcon, DebtIcon } from '@/utils/categoryIcons';
import { Debt, getDebtEmoji } from '@/types/debt';
import { supabase } from '@/integrations/supabase/client';
import { getBudgetStatus } from '@/utils/format';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, CreditCard, BarChart3, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StartOfMonth = () => {
  const {
    scopedTransactions: transactions, household, currentUser, session,
    scopedSavingsGoals: savingsGoals, getGoalSaved,
    scopedBudgets: budgets, getBudgetSpent, getTransactionsForMonth,
    scopedAccounts: accounts, getMonthSavings, getTotalSavings,
    householdId, financeScope, getMemberById,
  } = useApp();
  const { formatAmount, currency } = useCurrency();
  const navigate = useNavigate();

  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now);

  // Debts
  const [debts, setDebts] = useState<Debt[]>([]);
  const fetchDebts = useCallback(async () => {
    if (!householdId) return;
    const userId = session?.user?.id;
    let query = supabase.from('debts').select('*');
    if (financeScope === 'personal') {
      query = query.eq('scope', 'personal').eq('created_by', userId);
    } else {
      query = query.eq('household_id', householdId).eq('scope', 'household');
    }
    const { data } = await query;
    if (data) {
      setDebts(data.map((d: any) => ({
        id: d.id, householdId: d.household_id, type: d.type, name: d.name, lender: d.lender,
        initialAmount: Number(d.initial_amount), remainingAmount: Number(d.remaining_amount),
        currency: d.currency, interestRate: Number(d.interest_rate), durationYears: Number(d.duration_years),
        startDate: d.start_date, paymentFrequency: d.payment_frequency, paymentDay: d.payment_day,
        paymentAmount: Number(d.payment_amount), categoryId: d.category_id,
        nextPaymentDate: d.next_payment_date, lastPaymentDate: d.last_payment_date,
        createdAt: d.created_at, updatedAt: d.updated_at,
        scope: d.scope || 'household', createdBy: d.created_by || undefined,
        amortizationType: d.amortization_type || 'fixed_annuity',
      })));
    }
  }, [householdId, financeScope, session?.user?.id]);
  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  // Month transactions
  const monthTx = useMemo(() => getTransactionsForMonth(now), [getTransactionsForMonth]);

  // Savings account IDs
  const epargneAccountIds = new Set(accounts.filter(a => (a.type === 'epargne' || a.type === 'pilier3a') && !a.isArchived).map(a => a.id));
  const isEpargneTx = (t: typeof monthTx[0]) => !!(t.accountId && epargneAccountIds.has(t.accountId));
  const transferIdRegex = /\[?Transfert\s+#([^\]\s]+)\]?/i;
  const savingsTransferIds = new Set<string>();
  monthTx.forEach(t => {
    if (isEpargneTx(t) && t.category === 'Transfert' && t.notes) {
      const match = t.notes.match(transferIdRegex);
      if (match) savingsTransferIds.add(match[1]);
    }
  });
  const isSavingsTransferCounterpart = (t: typeof monthTx[0]) => {
    if (t.category !== 'Transfert' || !t.notes) return false;
    const match = t.notes.match(transferIdRegex);
    return match ? savingsTransferIds.has(match[1]) : false;
  };
  const isAnySavingsTx = (t: typeof monthTx[0]) => isEpargneTx(t) || isSavingsTransferCounterpart(t);

  // Totals
  const totalIncome = monthTx.filter(t => t.type === 'income' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense' && !isAnySavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);

  const epargneTransferIn = monthTx.filter(t => t.type === 'income' && isEpargneTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneTransferOut = monthTx.filter(t => t.type === 'expense' && isEpargneTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneDirectIn = monthTx.filter(t => t.type === 'income' && isEpargneTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneDirectOut = monthTx.filter(t => t.type === 'expense' && isEpargneTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const monthSavingsNet = (epargneTransferIn + epargneDirectIn) - (epargneTransferOut + epargneDirectOut);

  const balance = totalIncome - totalExpense - Math.abs(monthSavingsNet);

  // Previous month comparison
  const prevMonth = new Date(now);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevTx = useMemo(() => getTransactionsForMonth(prevMonth), [getTransactionsForMonth]);
  const prevExpense = prevTx.filter(t => t.type === 'expense' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const prevIncome = prevTx.filter(t => t.type === 'income' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const expenseVariation = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : 0;

  // Recurring incomes & expenses
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const recurringIncomes = transactions.filter(t => t.isRecurring && !t.recurringSourceId && t.type === 'income' && (!t.recurringEndMonth || t.recurringEndMonth > monthYear));
  const recurringExpenses = transactions.filter(t => t.isRecurring && !t.recurringSourceId && t.type === 'expense' && (!t.recurringEndMonth || t.recurringEndMonth > monthYear));
  const totalRecurringIncome = recurringIncomes.reduce((s, t) => s + t.convertedAmount, 0);
  const totalRecurringExpense = recurringExpenses.reduce((s, t) => s + t.convertedAmount, 0);

  // Budgets
  const budgetData = budgets.filter(b => b.period === 'monthly').map(b => ({ ...b, spent: getBudgetSpent(b) }));
  const totalBudgetLimit = budgetData.reduce((s, b) => s + b.limit, 0);
  const totalBudgetSpent = budgetData.reduce((s, b) => s + b.spent, 0);
  const budgetUsagePct = totalBudgetLimit > 0 ? Math.round((totalBudgetSpent / totalBudgetLimit) * 100) : 0;
  const overBudgets = budgetData.filter(b => b.spent > b.limit);
  const warningBudgets = budgetData.filter(b => b.spent / b.limit > 0.7 && b.spent <= b.limit);

  // Savings goals
  const goalsData = savingsGoals.map(g => ({ ...g, saved: getGoalSaved(g.id) }));
  const totalSavings = getTotalSavings();

  // Debt totals for the month
  const totalDebtPayments = debts.reduce((s, d) => s + d.paymentAmount, 0);
  const totalDebtRemaining = debts.reduce((s, d) => s + d.remainingAmount, 0);

  const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

  const SectionCard = ({ title, icon: Icon, children, action, onAction }: { title: string; icon: any; children: React.ReactNode; action?: string; onAction?: () => void }) => (
    <motion.div variants={fade} className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {action && onAction && (
          <button onClick={onAction} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
            {action} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );

  return (
    <Layout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-2xl mx-auto space-y-4 pb-6">
        {/* Header */}
        <motion.div variants={fade}>
          <BackHeader title="🗓️ Résumé du mois" />
          <p className="text-sm text-muted-foreground capitalize -mt-2">{monthLabel}</p>
        </motion.div>

        {/* Hero: Solde disponible */}
        <motion.div variants={fade} className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="text-xs font-medium opacity-80 mb-1">Reste à vivre ce mois</p>
          <p className={`text-3xl font-bold font-mono-amount ${balance < 0 ? 'text-destructive-foreground' : ''}`}>
            {balance >= 0 ? '+' : ''}{formatAmount(balance)}
          </p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-primary-foreground/10 rounded-xl p-2.5 text-center">
              <p className="text-[10px] opacity-70">Revenus</p>
              <p className="text-sm font-semibold font-mono-amount">+{formatAmount(totalIncome)}</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-xl p-2.5 text-center">
              <p className="text-[10px] opacity-70">Dépenses</p>
              <p className="text-sm font-semibold font-mono-amount">-{formatAmount(totalExpense)}</p>
            </div>
            <div className="bg-primary-foreground/10 rounded-xl p-2.5 text-center">
              <p className="text-[10px] opacity-70">Épargne</p>
              <p className="text-sm font-semibold font-mono-amount">{monthSavingsNet >= 0 ? '+' : ''}{formatAmount(monthSavingsNet)}</p>
            </div>
          </div>
          {expenseVariation !== 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs opacity-80">
              {expenseVariation > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>Dépenses {expenseVariation > 0 ? '+' : ''}{expenseVariation}% vs mois dernier</span>
            </div>
          )}
        </motion.div>

        {/* Revenus récurrents */}
        <SectionCard title="Revenus récurrents" icon={TrendingUp} action="Transactions" onAction={() => navigate('/transactions')}>
          {recurringIncomes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Aucun revenu récurrent</p>
          ) : (
            <div className="space-y-2">
              {recurringIncomes.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CategoryIcon category={t.category} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground">Le {t.recurrenceDay || parseInt(t.date.split('-')[2])} · {t.category}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-success font-mono-amount">+{formatAmount(t.convertedAmount)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border/50 flex justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total récurrent</span>
                <span className="text-sm font-bold text-success font-mono-amount">+{formatAmount(totalRecurringIncome)}</span>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Charges fixes */}
        <SectionCard title="Charges fixes" icon={TrendingDown} action="Transactions" onAction={() => navigate('/transactions')}>
          {recurringExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Aucune charge récurrente</p>
          ) : (
            <div className="space-y-2">
              {recurringExpenses.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CategoryIcon category={t.category} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground">Le {t.recurrenceDay || parseInt(t.date.split('-')[2])} · {t.category}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-destructive font-mono-amount">-{formatAmount(t.convertedAmount)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border/50 flex justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total charges fixes</span>
                <span className="text-sm font-bold text-destructive font-mono-amount">-{formatAmount(totalRecurringExpense)}</span>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Budgets */}
        {budgetData.length > 0 && (
          <SectionCard title="Budgets du mois" icon={BarChart3} action="Gérer" onAction={() => navigate('/budgets')}>
            <div className="space-y-3">
              {budgetData.slice(0, 5).map(b => {
                const pct = Math.min(Math.round((b.spent / b.limit) * 100), 100);
                const status = getBudgetStatus(b.spent, b.limit);
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{b.emoji} {b.category}</span>
                      <span className="text-xs text-muted-foreground font-mono-amount">{formatAmount(b.spent)} / {formatAmount(b.limit)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${status === 'over' ? 'bg-destructive' : status === 'warning' ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-border/50">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">Utilisation globale</span>
                  <span className={`text-sm font-bold font-mono-amount ${budgetUsagePct > 100 ? 'text-destructive' : budgetUsagePct > 80 ? 'text-warning' : 'text-primary'}`}>
                    {budgetUsagePct}%
                  </span>
                </div>
                {overBudgets.length > 0 && (
                  <p className="text-xs text-destructive mt-1">⚠️ {overBudgets.length} budget{overBudgets.length > 1 ? 's' : ''} dépassé{overBudgets.length > 1 ? 's' : ''}</p>
                )}
                {warningBudgets.length > 0 && overBudgets.length === 0 && (
                  <p className="text-xs text-warning mt-1">👀 {warningBudgets.length} budget{warningBudgets.length > 1 ? 's' : ''} à surveiller</p>
                )}
              </div>
            </div>
          </SectionCard>
        )}

        {/* Dettes */}
        {debts.length > 0 && (
          <SectionCard title="Échéances dettes" icon={CreditCard} action="Détails" onAction={() => navigate('/debts')}>
            <div className="space-y-2.5">
              {debts.map(d => {
                const pctPaid = d.initialAmount > 0 ? Math.round(((d.initialAmount - d.remainingAmount) / d.initialAmount) * 100) : 0;
                return (
                  <div key={d.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{getDebtEmoji(d.type)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{d.name}</p>
                          <p className="text-[11px] text-muted-foreground">Le {d.paymentDay} · Reste {formatAmount(d.remainingAmount, d.currency)}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-destructive font-mono-amount shrink-0">-{formatAmount(d.paymentAmount, d.currency)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pctPaid}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-border/50 flex justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total échéances</span>
                <span className="text-sm font-bold text-destructive font-mono-amount">-{formatAmount(totalDebtPayments)}</span>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Épargne */}
        {goalsData.length > 0 && (
          <SectionCard title="Objectifs d'épargne" icon={PiggyBank} action="Voir" onAction={() => navigate('/savings')}>
            <div className="space-y-3">
              {goalsData.map(g => {
                const pct = g.target > 0 ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{g.emoji} {g.name}</span>
                      <span className="text-xs text-muted-foreground font-mono-amount">{formatAmount(g.saved, g.currency)} / {formatAmount(g.target, g.currency)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-border/50 flex justify-between">
                <span className="text-xs font-medium text-muted-foreground">Épargne totale</span>
                <span className="text-sm font-bold text-success font-mono-amount">{formatAmount(totalSavings)}</span>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Quick summary card */}
        <motion.div variants={fade} className="rounded-2xl bg-muted/50 border border-border p-4">
          <p className="text-sm font-semibold mb-3">📊 En résumé</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revenus récurrents</span>
              <span className="font-medium text-success font-mono-amount">+{formatAmount(totalRecurringIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Charges fixes</span>
              <span className="font-medium text-destructive font-mono-amount">-{formatAmount(totalRecurringExpense)}</span>
            </div>
            {debts.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Échéances dettes</span>
                <span className="font-medium text-destructive font-mono-amount">-{formatAmount(totalDebtPayments)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Budgets variables</span>
              <span className="font-medium font-mono-amount">-{formatAmount(totalBudgetLimit)}</span>
            </div>
            <div className="pt-2 border-t border-border/50 flex justify-between">
              <span className="font-semibold">Disponible estimé</span>
              <span className={`font-bold font-mono-amount ${(totalRecurringIncome - totalRecurringExpense - totalDebtPayments - totalBudgetLimit) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatAmount(totalRecurringIncome - totalRecurringExpense - totalDebtPayments - totalBudgetLimit)}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default StartOfMonth;
