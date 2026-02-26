import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { getBudgetStatus, formatAmount as rawFormatAmount } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import MonthSelector from './MonthSelector';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Target, Wallet, PiggyBank, CreditCard, Sparkles, X, ArrowUpRight, ArrowDownRight, ChevronDown, Receipt, ArrowLeftRight, BarChart3 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const COLORS = ['hsl(174, 30%, 45%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(280, 60%, 55%)', 'hsl(30, 70%, 50%)', 'hsl(190, 70%, 40%)', 'hsl(340, 70%, 50%)', 'hsl(220, 60%, 50%)', 'hsl(50, 80%, 45%)'];

function generateReportAdvice(
  income: number,
  expenses: number,
  savings: number,
  savingsGoals: { name: string; emoji: string; target: number; saved: number; targetDate?: string }[],
  overBudgets: { category: string; emoji: string }[],
  currency: string,
  prevIncome: number,
  prevExpenses: number,
): string {
  const fmt = (n: number) => rawFormatAmount(n, currency);
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  const parts: string[] = [];

  // Budget alerts
  if (overBudgets.length > 0) {
    parts.push(`⚠️ ${overBudgets.length} budget(s) dépassé(s) : ${overBudgets.map(b => `${b.emoji} ${b.category}`).join(', ')}.`);
  } else {
    parts.push(`✅ Tous vos budgets sont respectés ce mois-ci.`);
  }

  // Expense trend
  if (prevExpenses > 0) {
    const diff = ((expenses - prevExpenses) / prevExpenses) * 100;
    if (diff > 5) {
      parts.push(`📈 Vos dépenses ont augmenté de ${diff.toFixed(0)}% vs le mois dernier.`);
    } else if (diff < -5) {
      parts.push(`📉 Vos dépenses ont baissé de ${Math.abs(diff).toFixed(0)}% vs le mois dernier. Bravo !`);
    }
  }

  // Savings rate
  if (income > 0) {
    if (savingsRate >= 20) {
      parts.push(`🌟 Taux d'épargne excellent : ${savingsRate.toFixed(0)}% (objectif recommandé : 20%).`);
    } else if (savingsRate >= 10) {
      parts.push(`👍 Taux d'épargne correct : ${savingsRate.toFixed(0)}%. Visez 20% pour optimiser.`);
    } else if (savingsRate > 0) {
      parts.push(`💡 Taux d'épargne de ${savingsRate.toFixed(0)}%. Essayez d'atteindre au moins 10%.`);
    }
  }

  // Goal projection
  const goalsWithDate = savingsGoals.filter(g => g.targetDate && g.saved < g.target);
  if (goalsWithDate.length > 0 && savings > 0) {
    const g = goalsWithDate[0];
    const remaining = g.target - g.saved;
    const monthsToGoal = Math.ceil(remaining / savings);
    parts.push(`🎯 À ce rythme, ${g.emoji} "${g.name}" sera atteint dans ~${monthsToGoal} mois.`);
  }

  return parts.join(' ');
}

const SectionTitle = ({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="w-3.5 h-3.5 text-primary" />
    </div>
    <div>
      <h3 className="font-semibold text-sm">{title}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

const DiffBadge = ({ value, suffix = '' }: { value: number | null; suffix?: string }) => {
  if (value === null) return null;
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
      isPositive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
    }`}>
      {isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {Math.abs(value).toFixed(0)}{suffix}
    </span>
  );
};

const CollapsibleSection = ({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between mb-2">
        <SectionTitle icon={icon} title={title} />
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MonthlyReportModal = ({ open, onClose }: Props) => {
  const { getTransactionsForMonth, getBudgetsForMonth, getBudgetSpent, getMonthSavings, scopedSavingsGoals: savingsGoals, getGoalSaved, getActiveAccounts, scopedAccounts: accounts, scopedTransactions: allTransactions, householdId, financeScope, session } = useApp();
  const { formatAmount, currency } = useCurrency();
  const [month, setMonth] = useState(new Date());

  // Fetch debts
  interface DebtRow {
    id: string; name: string; type: string; initial_amount: number;
    remaining_amount: number; payment_amount: number; interest_rate: number;
    currency: string; start_date: string; duration_years: number; payment_frequency: string;
  }
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const fetchDebts = useCallback(async () => {
    if (!householdId) return;
    const userId = session?.user?.id;
    let query = supabase.from('debts').select('*');
    if (financeScope === 'personal') {
      query = query.eq('created_by', userId).eq('scope', 'personal');
    } else {
      query = query.eq('household_id', householdId).eq('scope', 'household');
    }
    const { data } = await query;
    if (data) setDebts(data as DebtRow[]);
  }, [householdId, financeScope, session?.user?.id]);
  useEffect(() => { if (open) fetchDebts(); }, [open, fetchDebts]);

  const transactions = useMemo(() => getTransactionsForMonth(month), [month, getTransactionsForMonth]);

  // Savings accounts logic
  const epargneAccountIds = new Set(accounts.filter(a => a.type === 'epargne').map(a => a.id));
  const isEpargneTx = (t: typeof transactions[0]) => !!(t.accountId && epargneAccountIds.has(t.accountId));

  const transferIdRegex = /\[?Transfert\s+#([^\]\s]+)\]?/i;
  const savingsTransferIds = new Set<string>();
  transactions.forEach(t => {
    if (isEpargneTx(t) && t.category === 'Transfert' && t.notes) {
      const match = t.notes.match(transferIdRegex);
      if (match) savingsTransferIds.add(match[1]);
    }
  });
  const isSavingsTransferCounterpart = (t: typeof transactions[0]) => {
    if (t.category !== 'Transfert' || !t.notes) return false;
    const match = t.notes.match(transferIdRegex);
    return match ? savingsTransferIds.has(match[1]) : false;
  };
  const isAnySavingsTx = (t: typeof transactions[0]) => isEpargneTx(t) || isSavingsTransferCounterpart(t);

  // Savings breakdown
  const epargneTransferIn = transactions.filter(t => t.type === 'income' && isEpargneTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneTransferOut = transactions.filter(t => t.type === 'expense' && isEpargneTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneDirectIn = transactions.filter(t => t.type === 'income' && isEpargneTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneDirectOut = transactions.filter(t => t.type === 'expense' && isEpargneTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneIn = epargneTransferIn + epargneDirectIn;
  const epargneOut = epargneTransferOut + epargneDirectOut;
  const monthSavingsNet = epargneIn - epargneOut;

  // Income & Expenses (excluding transfers and savings)
  const income = transactions.filter(t => t.type === 'income' && t.category !== 'Transfert' && !isAnySavingsTx(t)).reduce((s, t) => s + t.convertedAmount, 0);
  const expenses = transactions.filter(t => t.type === 'expense' && !isAnySavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const balance = income - expenses + Math.min(monthSavingsNet, 0);

  // Previous month
  const prevMonth = new Date(month);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevTransactions = useMemo(() => getTransactionsForMonth(prevMonth), [prevMonth, getTransactionsForMonth]);

  // Previous month savings logic
  const prevSavingsTransferIds = new Set<string>();
  prevTransactions.forEach(t => {
    if (isEpargneTx(t) && t.category === 'Transfert' && t.notes) {
      const match = t.notes.match(transferIdRegex);
      if (match) prevSavingsTransferIds.add(match[1]);
    }
  });
  const isPrevAnySavingsTx = (t: typeof transactions[0]) => {
    if (isEpargneTx(t)) return true;
    if (t.category !== 'Transfert' || !t.notes) return false;
    const match = t.notes.match(transferIdRegex);
    return match ? prevSavingsTransferIds.has(match[1]) : false;
  };

  const prevIncome = prevTransactions.filter(t => t.type === 'income' && t.category !== 'Transfert' && !isPrevAnySavingsTx(t)).reduce((s, t) => s + t.convertedAmount, 0);
  const prevExpenses = prevTransactions.filter(t => t.type === 'expense' && !isPrevAnySavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const prevEpargneIn = prevTransactions.filter(t => t.type === 'income' && isEpargneTx(t)).reduce((s, t) => s + t.convertedAmount, 0);
  const prevEpargneOut = prevTransactions.filter(t => t.type === 'expense' && isEpargneTx(t)).reduce((s, t) => s + t.convertedAmount, 0);
  const prevSavingsNet = prevEpargneIn - prevEpargneOut;

  // Income by category
  const incomeByCategory = useMemo(() => {
    const map: Record<string, { amount: number; emoji: string }> = {};
    transactions.filter(t => t.type === 'income' && t.category !== 'Transfert' && !isAnySavingsTx(t)).forEach(t => {
      if (!map[t.category]) map[t.category] = { amount: 0, emoji: t.emoji };
      map[t.category].amount += t.convertedAmount;
    });
    return Object.entries(map).map(([name, { amount, emoji }]) => ({ name, value: amount, emoji })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Expense by category
  const expensesByCategory = useMemo(() => {
    const map: Record<string, { amount: number; emoji: string }> = {};
    transactions.filter(t => t.type === 'expense' && !isAnySavingsTx(t) && t.category !== 'Transfert').forEach(t => {
      if (!map[t.category]) map[t.category] = { amount: 0, emoji: t.emoji };
      map[t.category].amount += t.convertedAmount;
    });
    return Object.entries(map).map(([name, { amount, emoji }]) => ({ name, value: amount, emoji })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Top 5 biggest expenses
  const topExpenses = useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense' && !isAnySavingsTx(t) && t.category !== 'Transfert')
      .sort((a, b) => b.convertedAmount - a.convertedAmount)
      .slice(0, 5);
  }, [transactions]);

  // Top 5 biggest incomes
  const topIncomes = useMemo(() => {
    return transactions
      .filter(t => t.type === 'income' && t.category !== 'Transfert' && !isAnySavingsTx(t))
      .sort((a, b) => b.convertedAmount - a.convertedAmount)
      .slice(0, 5);
  }, [transactions]);

  // Transfer count & total
  const transfers = useMemo(() => {
    return transactions.filter(t => t.category === 'Transfert' && t.type === 'expense');
  }, [transactions]);
  const transferTotal = transfers.reduce((s, t) => s + t.convertedAmount, 0);

  // Transaction count
  const txCount = transactions.length;
  const incomeCount = transactions.filter(t => t.type === 'income' && t.category !== 'Transfert' && !isAnySavingsTx(t)).length;
  const expenseCount = transactions.filter(t => t.type === 'expense' && !isAnySavingsTx(t) && t.category !== 'Transfert').length;
  const avgExpense = expenseCount > 0 ? expenses / expenseCount : 0;

  // Budgets
  const monthlyBudgets = useMemo(() => getBudgetsForMonth(month).filter(b => b.period === 'monthly'), [getBudgetsForMonth, month]);
  const overBudgets = useMemo(() => monthlyBudgets.filter(b => getBudgetSpent(b, month) > b.limit), [monthlyBudgets, getBudgetSpent, month]);
  const budgetUtilization = useMemo(() => {
    if (monthlyBudgets.length === 0) return null;
    const totalSpent = monthlyBudgets.reduce((s, b) => s + getBudgetSpent(b, month), 0);
    const totalLimit = monthlyBudgets.reduce((s, b) => s + b.limit, 0);
    return totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  }, [monthlyBudgets, getBudgetSpent, month]);

  // Goals
  const goalsData = useMemo(() => savingsGoals.map(g => ({ ...g, saved: getGoalSaved(g.id) })), [savingsGoals, getGoalSaved]);

  // AI advice
  const aiAdvice = useMemo(() => generateReportAdvice(income, expenses, monthSavingsNet, goalsData, overBudgets, currency, prevIncome, prevExpenses), [income, expenses, monthSavingsNet, goalsData, overBudgets, currency, prevIncome, prevExpenses]);

  const diffPct = (curr: number, prev: number) => prev === 0 ? null : ((curr - prev) / prev) * 100;

  // Account balances at end of month
  const activeAccounts = getActiveAccounts();
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const endDateStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

  const getAccountBalanceAtMonth = (accId: string) => {
    const account = accounts.find(a => a.id === accId);
    if (!account) return 0;
    const txs = allTransactions.filter(t => t.accountId === accId && t.date <= endDateStr);
    const incomeSum = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenseSum = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return account.startingBalance + incomeSum - expenseSum;
  };

  const prevEndOfMonth = new Date(month.getFullYear(), month.getMonth(), 0);
  const prevEndDateStr = `${prevEndOfMonth.getFullYear()}-${String(prevEndOfMonth.getMonth() + 1).padStart(2, '0')}-${String(prevEndOfMonth.getDate()).padStart(2, '0')}`;
  const getAccountBalanceAtPrevMonth = (accId: string) => {
    const account = accounts.find(a => a.id === accId);
    if (!account) return 0;
    const txs = allTransactions.filter(t => t.accountId === accId && t.date <= prevEndDateStr);
    const incomeSum = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenseSum = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return account.startingBalance + incomeSum - expenseSum;
  };

  const totalAccountsBalance = activeAccounts.reduce((sum, acc) => sum + getAccountBalanceAtMonth(acc.id), 0);
  const prevTotalAccountsBalance = activeAccounts.reduce((sum, acc) => sum + getAccountBalanceAtPrevMonth(acc.id), 0);
  const balanceDiff = totalAccountsBalance - prevTotalAccountsBalance;
  const balanceDiffPct = prevTotalAccountsBalance !== 0 ? (balanceDiff / Math.abs(prevTotalAccountsBalance)) * 100 : null;

  // Separate savings and non-savings accounts
  const savingsAccounts = activeAccounts.filter(a => a.type === 'epargne');
  const currentAccounts = activeAccounts.filter(a => a.type !== 'epargne');
  const totalSavingsBalance = savingsAccounts.reduce((s, a) => s + getAccountBalanceAtMonth(a.id), 0);
  const totalCurrentBalance = currentAccounts.reduce((s, a) => s + getAccountBalanceAtMonth(a.id), 0);

  // Comparison bar chart data
  const comparisonData = useMemo(() => [
    { name: 'Revenus', current: income, previous: prevIncome },
    { name: 'Dépenses', current: expenses, previous: prevExpenses },
    { name: 'Épargne', current: Math.max(monthSavingsNet, 0), previous: Math.max(prevSavingsNet, 0) },
  ], [income, prevIncome, expenses, prevExpenses, monthSavingsNet, prevSavingsNet]);

  const getTimeRemaining = (targetDate?: string) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const now = new Date();
    const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
    if (months <= 0) return 'Échéance passée';
    return `${months} mois restant${months > 1 ? 's' : ''}`;
  };

  if (!open) return null;

  const monthLabel = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-center justify-center p-3"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="bg-card w-full max-w-lg rounded-2xl border border-border/50 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-base">📊</span>
                </div>
                <div>
                  <h2 className="text-base font-bold capitalize">{monthLabel}</h2>
                  <p className="text-[10px] text-muted-foreground">Rapport mensuel détaillé</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex justify-center">
              <MonthSelector currentMonth={month} onChange={setMonth} />
            </div>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

            {/* ===== 1. PATRIMOINE ===== */}
            {activeAccounts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-5 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_70%)]" />
                <div className="relative">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium text-center">Patrimoine total fin de mois</p>
                  <p className={`text-2xl font-bold font-mono-amount tracking-tight text-center ${totalAccountsBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                    {formatAmount(totalAccountsBalance)}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`text-xs font-mono-amount font-semibold ${balanceDiff >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {balanceDiff >= 0 ? '+' : ''}{formatAmount(balanceDiff)}
                    </span>
                    {balanceDiffPct !== null && <DiffBadge value={balanceDiffPct} suffix="%" />}
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-card/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/30 text-center">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Comptes courants</p>
                      <p className={`font-mono-amount font-bold text-sm ${totalCurrentBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>{formatAmount(totalCurrentBalance)}</p>
                    </div>
                    <div className="bg-card/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/30 text-center">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Comptes épargne</p>
                      <p className={`font-mono-amount font-bold text-sm ${totalSavingsBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>{formatAmount(totalSavingsBalance)}</p>
                    </div>
                  </div>

                  {/* All accounts */}
                  <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                    {activeAccounts.map(acc => {
                      const bal = getAccountBalanceAtMonth(acc.id);
                      const prevBal = getAccountBalanceAtPrevMonth(acc.id);
                      const diff = bal - prevBal;
                      return (
                        <div key={acc.id} className="bg-card/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-border/20">
                          <p className="text-[9px] text-muted-foreground leading-none mb-0.5">{acc.name}</p>
                          <p className={`font-mono-amount font-semibold text-[11px] leading-none ${bal >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                            {formatAmount(bal, acc.currency)}
                          </p>
                          <p className={`font-mono-amount text-[9px] ${diff >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {diff >= 0 ? '+' : ''}{formatAmount(diff, acc.currency)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== 2. FLUX DU MOIS ===== */}
            <div>
              <SectionTitle icon={Wallet} title="Flux du mois" subtitle={`${txCount} transactions`} />
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-success/5 border border-success/15 rounded-xl p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-success mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground mb-0.5">Revenus</p>
                  <p className="font-mono-amount font-bold text-success text-sm">+{formatAmount(income)}</p>
                  <DiffBadge value={diffPct(income, prevIncome)} suffix="%" />
                  <p className="text-[9px] text-muted-foreground mt-0.5">{incomeCount} opérations</p>
                </div>
                <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-3 text-center">
                  <TrendingDown className="w-4 h-4 text-destructive mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground mb-0.5">Dépenses</p>
                  <p className="font-mono-amount font-bold text-destructive text-sm">-{formatAmount(expenses)}</p>
                  <DiffBadge value={diffPct(expenses, prevExpenses)} suffix="%" />
                  <p className="text-[9px] text-muted-foreground mt-0.5">{expenseCount} opérations</p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${monthSavingsNet >= 0 ? 'bg-primary/5 border-primary/15' : 'bg-destructive/5 border-destructive/15'}`}>
                  <PiggyBank className={`w-4 h-4 mx-auto mb-1 ${monthSavingsNet >= 0 ? 'text-primary' : 'text-destructive'}`} />
                  <p className="text-[10px] text-muted-foreground mb-0.5">Épargne</p>
                  <p className={`font-mono-amount font-bold text-sm ${monthSavingsNet >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {monthSavingsNet >= 0 ? '+' : '-'}{formatAmount(Math.abs(monthSavingsNet))}
                  </p>
                  <DiffBadge value={diffPct(monthSavingsNet, prevSavingsNet)} suffix="%" />
                </div>
              </div>

              {/* Épargne detail */}
              {(epargneIn > 0 || epargneOut > 0) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">🐖 Versements épargne</p>
                    <p className="font-mono-amount font-bold text-primary text-sm">+{formatAmount(epargneIn)}</p>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">🐖 Retraits épargne</p>
                    <p className="font-mono-amount font-bold text-destructive text-sm">-{formatAmount(epargneOut)}</p>
                  </div>
                </div>
              )}

              {/* Balance */}
              <div className={`mt-2 rounded-xl p-3 text-center border ${balance >= 0 ? 'bg-success/5 border-success/15' : 'bg-destructive/5 border-destructive/15'}`}>
                <p className="text-[10px] text-muted-foreground mb-0.5">Solde du mois</p>
                <p className={`font-mono-amount font-bold text-base ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {balance >= 0 ? '+' : ''}{formatAmount(balance)}
                </p>
                {monthSavingsNet > 0 && (
                  <p className="text-[9px] text-muted-foreground italic mt-1">
                    Épargne positive (+{formatAmount(monthSavingsNet)}) non déduite du solde
                  </p>
                )}
              </div>

              {/* Average & stats */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-secondary/30 rounded-lg p-2 text-center">
                  <p className="text-[9px] text-muted-foreground">Dépense moy.</p>
                  <p className="font-mono-amount text-xs font-semibold">{formatAmount(avgExpense)}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-2 text-center">
                  <p className="text-[9px] text-muted-foreground">Taux d'épargne</p>
                  <p className="font-mono-amount text-xs font-semibold">{income > 0 ? (monthSavingsNet / income * 100).toFixed(0) : 0}%</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-2 text-center">
                  <p className="text-[9px] text-muted-foreground">Transferts</p>
                  <p className="font-mono-amount text-xs font-semibold">{transfers.length} ({formatAmount(transferTotal)})</p>
                </div>
              </div>
            </div>

            {/* ===== 3. COMPARAISON M-1 ===== */}
            <CollapsibleSection title="Comparaison vs mois précédent" icon={BarChart3} defaultOpen>
              <div className="bg-secondary/30 rounded-2xl p-4">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={50} tickFormatter={v => formatAmount(v)} />
                      <Tooltip formatter={(val: number) => formatAmount(val)} />
                      <Bar dataKey="previous" name="Mois précédent" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
                      <Bar dataKey="current" name="Ce mois" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CollapsibleSection>

            {/* ===== 4. REVENUS PAR CATÉGORIE ===== */}
            {incomeByCategory.length > 0 && (
              <CollapsibleSection title="Revenus par catégorie" icon={TrendingUp}>
                <div className="space-y-1.5">
                  {incomeByCategory.map((cat, i) => {
                    const pct = income > 0 ? (cat.value / income * 100) : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-2 bg-secondary/20 rounded-lg px-3 py-2">
                        <span className="text-sm">{cat.emoji}</span>
                        <span className="text-xs flex-1 truncate">{cat.name}</span>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono-amount text-[10px] text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                        <span className="font-mono-amount text-xs font-semibold text-success w-20 text-right">+{formatAmount(cat.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            {/* ===== 5. DÉPENSES PAR CATÉGORIE ===== */}
            {expensesByCategory.length > 0 && (
              <CollapsibleSection title="Dépenses par catégorie" icon={TrendingDown} defaultOpen>
                <div className="bg-secondary/30 rounded-2xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-28 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expensesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={25} strokeWidth={2} stroke="hsl(var(--card))">
                            {expensesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(val: number) => formatAmount(val)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {expensesByCategory.map((cat, i) => {
                        const pct = expenses > 0 ? (cat.value / expenses * 100) : 0;
                        return (
                          <div key={cat.name} className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="text-sm">{cat.emoji}</span>
                            <span className="truncate flex-1">{cat.name}</span>
                            <span className="font-mono-amount text-muted-foreground whitespace-nowrap">{pct.toFixed(0)}%</span>
                            <span className="font-mono-amount font-medium whitespace-nowrap">{formatAmount(cat.value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* ===== 6. TOP TRANSACTIONS ===== */}
            {(topExpenses.length > 0 || topIncomes.length > 0) && (
              <CollapsibleSection title="Top transactions" icon={Receipt}>
                {topIncomes.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">💰 Plus gros revenus</p>
                    <div className="space-y-1">
                      {topIncomes.map(t => (
                        <div key={t.id} className="flex items-center gap-2 bg-success/5 rounded-lg px-3 py-1.5">
                          <span className="text-sm">{t.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate font-medium">{t.label}</p>
                            <p className="text-[9px] text-muted-foreground">{new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                          </div>
                          <span className="font-mono-amount text-xs font-semibold text-success">+{formatAmount(t.convertedAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {topExpenses.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">💸 Plus grosses dépenses</p>
                    <div className="space-y-1">
                      {topExpenses.map(t => (
                        <div key={t.id} className="flex items-center gap-2 bg-destructive/5 rounded-lg px-3 py-1.5">
                          <span className="text-sm">{t.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate font-medium">{t.label}</p>
                            <p className="text-[9px] text-muted-foreground">{new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                          </div>
                          <span className="font-mono-amount text-xs font-semibold text-destructive">-{formatAmount(t.convertedAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleSection>
            )}

            {/* ===== 7. BUDGETS ===== */}
            {monthlyBudgets.length > 0 && (
              <CollapsibleSection title={`Budgets${budgetUtilization !== null ? ` (${budgetUtilization.toFixed(0)}% utilisé)` : ''}`} icon={Target} defaultOpen>
                <div className="space-y-2">
                  {monthlyBudgets.map(b => {
                    const spent = getBudgetSpent(b, month);
                    const status = getBudgetStatus(spent, b.limit);
                    const pct = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
                    const remaining = b.limit - spent;
                    return (
                      <div key={b.id} className="bg-secondary/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{b.emoji} {b.category}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            status === 'ok' ? 'bg-success/10 text-success' : status === 'warning' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {status === 'ok' ? '✓ OK' : status === 'warning' ? '⚠️ Attention' : '❌ Dépassé'}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                          <div
                            className={`h-full rounded-full transition-all ${status === 'ok' ? 'bg-success' : status === 'warning' ? 'bg-warning' : 'bg-destructive'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono-amount text-[11px] text-muted-foreground">{formatAmount(spent)} / {formatAmount(b.limit)}</span>
                          <span className={`font-mono-amount text-[11px] ${remaining >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {remaining >= 0 ? `${formatAmount(remaining)} restant` : `${formatAmount(Math.abs(remaining))} dépassé`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            {/* ===== 8. OBJECTIFS D'ÉPARGNE ===== */}
            {goalsData.length > 0 && (
              <CollapsibleSection title="Objectifs d'épargne" icon={PiggyBank}>
                <div className="space-y-2">
                  {goalsData.map(g => {
                    const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
                    const remaining = g.target - g.saved;
                    const timeRemaining = getTimeRemaining(g.targetDate);
                    return (
                      <div key={g.id} className="bg-secondary/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{g.emoji} {g.name}</span>
                          <span className={`font-mono-amount text-xs font-bold ${pct >= 100 ? 'text-success' : 'text-primary'}`}>{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : pct >= 60 ? 'bg-primary' : 'bg-warning'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono-amount text-[11px] text-muted-foreground">{formatAmount(g.saved, g.currency)} / {formatAmount(g.target, g.currency)}</span>
                          <span className="text-[10px] text-muted-foreground">{timeRemaining || 'Pas de date cible'}</span>
                        </div>
                        {remaining > 0 && monthSavingsNet > 0 && (
                          <p className="text-[9px] text-muted-foreground mt-1">
                            ~{Math.ceil(remaining / monthSavingsNet)} mois au rythme actuel
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            {/* ===== 9. DETTES ===== */}
            {debts.length > 0 && (
              <CollapsibleSection title="Suivi des dettes" icon={CreditCard}>
                <div className="space-y-2">
                  {debts.map(d => {
                    const pct = d.initial_amount > 0 ? Math.min(((d.initial_amount - d.remaining_amount) / d.initial_amount) * 100, 100) : 0;
                    const totalPaid = d.initial_amount - d.remaining_amount;
                    return (
                      <div key={d.id} className="bg-secondary/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">🏦 {d.name}</span>
                          <span className="font-mono-amount text-xs font-bold text-primary">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                          <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono-amount text-muted-foreground">Payé : {formatAmount(totalPaid, d.currency)}</span>
                          <span className="font-mono-amount text-muted-foreground">Restant : {formatAmount(d.remaining_amount, d.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] mt-0.5">
                          <span className="text-muted-foreground">Mensualité : {formatAmount(d.payment_amount, d.currency)}</span>
                          {d.interest_rate > 0 && <span className="text-muted-foreground">Taux : {d.interest_rate}%</span>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="bg-primary/8 border border-primary/15 rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">Total restant dû</span>
                      <span className="font-mono-amount font-bold text-sm text-primary">{formatAmount(debts.reduce((s, d) => s + d.remaining_amount, 0))}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-muted-foreground">Mensualités totales</span>
                      <span className="font-mono-amount text-[11px] text-muted-foreground">{formatAmount(debts.reduce((s, d) => s + d.payment_amount, 0))}/mois</span>
                    </div>
                    {income > 0 && (
                      <div className="flex justify-between items-center mt-0.5">
                        <span className="text-[10px] text-muted-foreground">Taux d'endettement</span>
                        <span className={`font-mono-amount text-[11px] font-semibold ${(debts.reduce((s, d) => s + d.payment_amount, 0) / income * 100) > 33 ? 'text-destructive' : 'text-success'}`}>
                          {(debts.reduce((s, d) => s + d.payment_amount, 0) / income * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* ===== 10. CONSEIL IA ===== */}
            <div className="bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/15 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs mb-1 text-primary">Analyse IA</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{aiAdvice}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MonthlyReportModal;
