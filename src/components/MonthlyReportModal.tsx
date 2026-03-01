import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { getBudgetStatus, formatAmount as rawFormatAmount } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Tooltip as UiTooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import MonthSelector from './MonthSelector';
import { supabase } from '@/integrations/supabase/client';
import { ACCOUNT_TYPES, DEFAULT_EXCHANGE_RATES } from '@/types/finance';
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

const CalculDetail = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-dashed border-primary/20 pt-2 mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors w-full"
      >
        <span>{label}</span>
        <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FlowRow = ({ icon, label, count, amount, sign, colorClass, diff, accounts, transactions: txs, formatAmount: fmt, customDetail }: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  amount: number;
  sign: string;
  colorClass: string;
  diff: number | null;
  accounts: { id: string; name: string; currency: string; type: string }[];
  transactions: { accountId?: string; convertedAmount: number; amount: number; type: string }[];
  formatAmount: (amount: number, currency?: string) => string;
  customDetail?: React.ReactNode;
}) => {
  const [expanded, setExpanded] = useState(false);
  // Group by account
  const byAccount = useMemo(() => {
    const map: Record<string, number> = {};
    txs.forEach(t => {
      const accId = t.accountId || '__none__';
      map[accId] = (map[accId] || 0) + t.convertedAmount;
    });
    return Object.entries(map).map(([accId, total]) => {
      const acc = accounts.find(a => a.id === accId);
      return { accId, name: acc?.name || 'Sans compte', total };
    }).sort((a, b) => b.total - a.total);
  }, [txs, accounts]);

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
          {count !== undefined && <span className="text-[9px] text-muted-foreground/60">({count})</span>}
          <ChevronDown className={`w-3 h-3 text-muted-foreground/40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
        <div className="flex items-center gap-2">
          <DiffBadge value={diff} suffix="%" />
          <span className={`font-mono-amount text-xs font-bold ${colorClass}`}>{sign}{fmt(amount)}</span>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2.5">
              {customDetail || (
                <div className="space-y-1">
                  {byAccount.map(({ accId, name, total }) => (
                    <div key={accId} className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground italic truncate flex-1">{name}</span>
                      <span className={`font-mono-amount text-[10px] font-medium italic ${colorClass}`}>
                        {sign}{fmt(total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AccountGroup = ({ label, total, accounts: accs, getBalance, getPrevBalance, formatAmount: fmt }: {
  label: string;
  total: number;
  accounts: { id: string; name: string; currency: string }[];
  getBalance: (id: string) => number;
  getPrevBalance: (id: string) => number;
  formatAmount: (amount: number, currency?: string) => string;
}) => {
  const [expanded, setExpanded] = useState(false);
  if (accs.length === 0) return null;
  return (
    <div className="bg-card/70 backdrop-blur-sm rounded-lg border border-border/30 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors">
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <div className="flex items-center gap-2">
          <p className={`font-mono-amount font-bold text-sm ${total >= 0 ? 'text-foreground' : 'text-destructive'}`}>{fmt(total)}</p>
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 space-y-1 border-t border-border/20 pt-2">
              {accs.map(acc => {
                const bal = getBalance(acc.id);
                const diff = bal - getPrevBalance(acc.id);
                return (
                  <div key={acc.id} className="flex items-center justify-between py-1">
                    <span className="text-xs text-muted-foreground italic">{acc.name}</span>
                    <div className="flex items-center gap-1.5 italic">
                      <span className={`font-mono-amount text-[9px] ${diff >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {diff >= 0 ? '+' : '-'}{fmt(Math.abs(diff), acc.currency)}
                      </span>
                      <span className={`font-mono-amount text-xs font-semibold ${bal >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                        {fmt(bal, acc.currency)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
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

  // Fetch debts + schedules
  interface DebtRow {
    id: string; name: string; type: string; initial_amount: number;
    remaining_amount: number; payment_amount: number; interest_rate: number;
    currency: string; start_date: string; duration_years: number; payment_frequency: string;
    scope: string; created_by: string | null;
    mortgage_system: string | null; property_value: number | null;
  }
  interface ScheduleRow {
    debt_id: string; due_date: string; capital_before: number; capital_after: number;
    principal_amount: number; interest_amount: number; total_amount: number; period_number: number;
  }
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [debtSchedules, setDebtSchedules] = useState<ScheduleRow[]>([]);
  const fetchDebts = useCallback(async () => {
    if (!householdId) return;
    const userId = session?.user?.id;
    // Fetch both scopes like the main debts page
    const { data } = await supabase.from('debts').select('*')
      .or(`and(household_id.eq.${householdId},scope.eq.household),and(created_by.eq.${userId},scope.eq.personal)`);
    if (data) setDebts(data as DebtRow[]);
    // Fetch schedules
    const { data: schedData } = await supabase.from('debt_schedules').select('*')
      .eq('household_id', householdId);
    if (schedData) setDebtSchedules(schedData as ScheduleRow[]);
  }, [householdId, financeScope, session?.user?.id]);
  useEffect(() => { if (open) fetchDebts(); }, [open, fetchDebts]);

  // Helper: get remaining amount for a debt using schedules (source of truth)
  // Uses the selected report month instead of today's date
  const getDebtRemaining = useCallback((debt: DebtRow) => {
    const schedules = debtSchedules.filter(s => s.debt_id === debt.id);
    if (schedules.length === 0) return debt.remaining_amount;
    const sorted = [...schedules].sort((a, b) => a.period_number - b.period_number);
    // Use end of selected month as reference date
    const my = month.getFullYear();
    const mm = month.getMonth() + 1;
    const endOfMonth = new Date(my, mm, 0); // last day of selected month
    const refStr = `${my}-${String(mm).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
    // Find the last schedule row whose due_date is <= end of selected month
    const pastRows = sorted.filter(s => s.due_date <= refStr);
    if (pastRows.length > 0) return pastRows[pastRows.length - 1].capital_after;
    // No payments yet in or before this month: return initial remaining
    return sorted[0].capital_before;
  }, [debtSchedules, month]);

  // Helper: get monthly equivalent payment using schedule total (interest + principal)
  const getDebtMonthlyPayment = useCallback((debt: DebtRow) => {
    const freq = debt.payment_frequency;
    const divisor = freq === 'quarterly' ? 3 : freq === 'semi-annual' ? 6 : freq === 'annual' ? 12 : 1;
    // Use the schedule's total_amount (interest + principal) for the closest period
    const schedules = debtSchedules.filter(s => s.debt_id === debt.id);
    if (schedules.length > 0) {
      const sorted = [...schedules].sort((a, b) => a.period_number - b.period_number);
      const my = month.getFullYear();
      const mm = month.getMonth() + 1;
      const endOfMonth = new Date(my, mm, 0);
      const refStr = `${my}-${String(mm).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
      // Find the schedule row closest to the selected month
      const pastRows = sorted.filter(s => s.due_date <= refStr);
      const row = pastRows.length > 0 ? pastRows[pastRows.length - 1] : sorted[0];
      return row.total_amount / divisor;
    }
    // Fallback: use payment_amount from debt record
    return debt.payment_amount / divisor;
  }, [debtSchedules, month]);

  const transactions = useMemo(() => getTransactionsForMonth(month), [month, getTransactionsForMonth]);

  // Savings accounts logic
  const epargneAccountIds = new Set(accounts.filter(a => a.type === 'epargne' || a.type === 'pilier3a').map(a => a.id));
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


  // Transfer count & total
  const transfers = useMemo(() => {
    return transactions.filter(t => t.category === 'Transfert' && t.type === 'expense');
  }, [transactions]);
  const transferTotal = transfers.reduce((s, t) => s + t.convertedAmount, 0);

  // Transaction count
  const txCount = transactions.length;
  const incomeCount = transactions.filter(t => t.type === 'income' && t.category !== 'Transfert' && !isAnySavingsTx(t)).length;
  const expenseCount = transactions.filter(t => t.type === 'expense' && !isAnySavingsTx(t) && t.category !== 'Transfert').length;

  // Average expenses over the last 3 months (M, M-1, M-2)
  const avgExpense3m = useMemo(() => {
    const months: number[] = [expenses];
    for (let offset = 1; offset <= 2; offset++) {
      const m = new Date(month);
      m.setMonth(m.getMonth() - offset);
      const mTxs = getTransactionsForMonth(m);
      // Replicate savings transfer exclusion logic for that month
      const mEpargneIds = new Set<string>();
      mTxs.forEach(t => {
        if (isEpargneTx(t) && t.category === 'Transfert' && t.notes) {
          const match = t.notes.match(transferIdRegex);
          if (match) mEpargneIds.add(match[1]);
        }
      });
      const isMSavingsTx = (t: typeof transactions[0]) => {
        if (isEpargneTx(t)) return true;
        if (t.category !== 'Transfert' || !t.notes) return false;
        const match = t.notes.match(transferIdRegex);
        return match ? mEpargneIds.has(match[1]) : false;
      };
      const mExp = mTxs.filter(t => t.type === 'expense' && !isMSavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
      months.push(mExp);
    }
    const total = months.reduce((s, v) => s + v, 0);
    return total / months.length;
  }, [expenses, month, getTransactionsForMonth, epargneAccountIds]);

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

  // Group accounts by type
  const accountsByType = useMemo(() => {
    const groups: Record<string, typeof activeAccounts> = {};
    activeAccounts.forEach(a => {
      if (!groups[a.type]) groups[a.type] = [];
      groups[a.type].push(a);
    });
    return groups;
  }, [activeAccounts]);

  // Import ACCOUNT_TYPES for labels
  const accountTypeGroups = useMemo(() => {
    return Object.entries(accountsByType).map(([type, accs]) => {
      const typeDef = ACCOUNT_TYPES.find(t => t.value === type);
      const label = typeDef ? `${typeDef.emoji} ${typeDef.label}` : type;
      const total = accs.reduce((s, a) => s + getAccountBalanceAtMonth(a.id), 0);
      return { type, label, total, accounts: accs };
    });
  }, [accountsByType, getAccountBalanceAtMonth]);

  // Keep totals for legacy usage
  const savingsAccounts = activeAccounts.filter(a => a.type === 'epargne' || a.type === 'pilier3a');
  const currentAccounts = activeAccounts.filter(a => a.type !== 'epargne' && a.type !== 'pilier3a');
  const totalSavingsBalance = savingsAccounts.reduce((s, a) => s + getAccountBalanceAtMonth(a.id), 0);
  const totalCurrentBalance = currentAccounts.reduce((s, a) => s + getAccountBalanceAtMonth(a.id), 0);

  // Comparison bar chart data
  const comparisonData = useMemo(() => [
    { name: 'Revenus', current: income, previous: prevIncome, color: 'hsl(var(--success))' },
    { name: 'Dépenses', current: expenses, previous: prevExpenses, color: 'hsl(var(--destructive))' },
    { name: 'Épargne', current: Math.max(monthSavingsNet, 0), previous: Math.max(prevSavingsNet, 0), color: 'hsl(var(--primary))' },
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

                  {/* Collapsible account groups */}
                  <div className="grid grid-cols-1 gap-2 mt-4">
                    {accountTypeGroups.map(group => (
                      <AccountGroup
                        key={group.type}
                        label={group.label}
                        total={group.total}
                        accounts={group.accounts}
                        getBalance={getAccountBalanceAtMonth}
                        getPrevBalance={getAccountBalanceAtPrevMonth}
                        formatAmount={formatAmount}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== 2. FLUX DU MOIS ===== */}
            <div>
              <SectionTitle icon={Wallet} title="Flux du mois" subtitle={`${txCount} transactions`} />

              {/* Solde principal en hero */}
              <div className={`rounded-2xl p-4 text-center mb-3 border ${balance >= 0 ? 'bg-success/5 border-success/15' : 'bg-destructive/5 border-destructive/15'}`}>
                <p className="text-[10px] text-muted-foreground mb-0.5">Solde du mois</p>
                <p className={`font-mono-amount font-bold text-xl ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {balance >= 0 ? '+' : ''}{formatAmount(balance)}
                </p>
                {monthSavingsNet > 0 && (
                  <p className="text-[9px] text-muted-foreground italic mt-1">
                    Épargne (+{formatAmount(monthSavingsNet)}) non déduite
                  </p>
                )}
              </div>

              {/* Lignes détaillées compactes avec détail par compte */}
              <div className="bg-secondary/20 rounded-xl divide-y divide-border/30 overflow-hidden">
                {/* Revenus */}
                <FlowRow
                  icon={<TrendingUp className="w-3.5 h-3.5 text-success" />}
                  label="Revenus"
                  count={incomeCount}
                  amount={income}
                  sign="+"
                  colorClass="text-success"
                  diff={diffPct(income, prevIncome)}
                  accounts={accounts}
                  transactions={transactions.filter(t => t.type === 'income' && t.category !== 'Transfert' && !isAnySavingsTx(t))}
                  formatAmount={formatAmount}
                />
                {/* Dépenses */}
                <FlowRow
                  icon={<TrendingDown className="w-3.5 h-3.5 text-destructive" />}
                  label="Dépenses"
                  count={expenseCount}
                  amount={expenses}
                  sign="-"
                  colorClass="text-destructive"
                  diff={diffPct(expenses, prevExpenses)}
                  accounts={accounts}
                  transactions={transactions.filter(t => t.type === 'expense' && !isAnySavingsTx(t) && t.category !== 'Transfert')}
                  formatAmount={formatAmount}
                />
                {/* Épargne nette */}
                {(() => {
                  // Build savings breakdown by account (income vs expense)
                  const savingsTxs = transactions.filter(t => isAnySavingsTx(t));
                  const savingsIncByAcc: Record<string, number> = {};
                  const savingsExpByAcc: Record<string, number> = {};
                  savingsTxs.forEach(t => {
                    const key = t.accountId || '__none__';
                    if (t.type === 'income') savingsIncByAcc[key] = (savingsIncByAcc[key] || 0) + t.convertedAmount;
                    else savingsExpByAcc[key] = (savingsExpByAcc[key] || 0) + t.convertedAmount;
                  });
                  const toList = (map: Record<string, number>) =>
                    Object.entries(map).map(([id, amount]) => {
                      const acc = accounts.find(a => a.id === id);
                      return { id, name: acc?.name || 'Sans compte', amount };
                    }).sort((a, b) => b.amount - a.amount);
                  const savingsIncList = toList(savingsIncByAcc);
                  const savingsExpList = toList(savingsExpByAcc);

                  return (
                    <FlowRow
                      icon={<PiggyBank className={`w-3.5 h-3.5 ${monthSavingsNet >= 0 ? 'text-primary' : 'text-destructive'}`} />}
                      label="Épargne nette"
                      amount={Math.abs(monthSavingsNet)}
                      sign={monthSavingsNet >= 0 ? '+' : '-'}
                      colorClass={monthSavingsNet >= 0 ? 'text-primary' : 'text-destructive'}
                      diff={diffPct(monthSavingsNet, prevSavingsNet)}
                      accounts={accounts}
                      transactions={savingsTxs}
                      formatAmount={formatAmount}
                      customDetail={
                        <div className="space-y-2">
                          {/* Revenus épargne par compte */}
                          <div>
                            <p className="text-[10px] font-semibold mb-1">💰 Revenus épargne</p>
                            {savingsIncList.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground italic">Aucun</p>
                            ) : savingsIncList.map(item => (
                              <div key={item.id} className="flex items-center justify-between py-0.5">
                                <span className="text-[10px] text-muted-foreground italic truncate flex-1">{item.name}</span>
                                <span className="font-mono-amount text-[10px] font-medium text-success">+{formatAmount(item.amount)}</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between mt-1 px-2 py-1 rounded bg-success/10">
                              <span className="text-[9px] text-success">Sous-total</span>
                              <span className="font-mono-amount text-[10px] text-success font-semibold">+{formatAmount(epargneIn)}</span>
                            </div>
                          </div>
                          {/* Dépenses épargne par compte */}
                          <div>
                            <p className="text-[10px] font-semibold mb-1">💸 Dépenses épargne</p>
                            {savingsExpList.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground italic">Aucune</p>
                            ) : savingsExpList.map(item => (
                              <div key={`exp-${item.id}`} className="flex items-center justify-between py-0.5">
                                <span className="text-[10px] text-muted-foreground italic truncate flex-1">{item.name}</span>
                                <span className="font-mono-amount text-[10px] font-medium text-destructive">-{formatAmount(item.amount)}</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between mt-1 px-2 py-1 rounded bg-destructive/10">
                              <span className="text-[9px] text-destructive">Sous-total</span>
                              <span className="font-mono-amount text-[10px] text-destructive font-semibold">-{formatAmount(epargneOut)}</span>
                            </div>
                          </div>
                          {/* Total net */}
                          <div className="flex items-center justify-between pt-1.5 border-t-2 border-border/50">
                            <span className="text-[10px] font-bold">Épargne nette</span>
                            <span className={`font-mono-amount text-[10px] font-bold ${monthSavingsNet >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {monthSavingsNet >= 0 ? '+' : ''}{formatAmount(monthSavingsNet)}
                            </span>
                          </div>
                        </div>
                      }
                    />
                  );
                })()}
                {/* Stats compactes */}
                <div className="flex items-center divide-x divide-border/30">
                  <TooltipProvider>
                    <UiTooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <div className="flex-1 px-3 py-2 text-center cursor-help">
                          <p className="text-[9px] text-muted-foreground">Dép. moy. (3 mois)</p>
                          <div className="flex items-center justify-center gap-1">
                            <p className="font-mono-amount text-[10px] font-semibold">{formatAmount(avgExpense3m)}</p>
                            <DiffBadge value={avgExpense3m > 0 ? ((expenses - avgExpense3m) / avgExpense3m) * 100 : null} suffix="%" />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px] text-center">
                        <p className="text-xs">Moyenne mensuelle de vos dépenses sur les 3 derniers mois (mois en cours + 2 mois précédents).</p>
                      </TooltipContent>
                    </UiTooltip>
                  </TooltipProvider>
                  <div className="flex-1 px-3 py-2 text-center">
                    <p className="text-[9px] text-muted-foreground">Tx épargne</p>
                    <p className="font-mono-amount text-[10px] font-semibold">{income > 0 ? (monthSavingsNet / income * 100).toFixed(0) : 0}%</p>
                  </div>
                  <div className="flex-1 px-3 py-2 text-center">
                    <p className="text-[9px] text-muted-foreground">Transferts</p>
                    <p className="font-mono-amount text-[10px] font-semibold">{transfers.length} ({formatAmount(transferTotal)})</p>
                  </div>
                </div>
              </div>
            </div>

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
              <CollapsibleSection title="Dépenses par catégorie" icon={TrendingDown}>
                <div className="bg-secondary/30 rounded-2xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-28 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expensesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={25} strokeWidth={2} stroke="hsl(var(--card))">
                            {expensesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip formatter={(val: number) => formatAmount(val)} />
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

            {/* ===== COMPARAISON M-1 ===== */}
            <CollapsibleSection title="Comparaison vs mois précédent" icon={BarChart3}>
              <div className="bg-secondary/30 rounded-2xl p-4">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={50} tickFormatter={v => formatAmount(v)} />
                      <RechartsTooltip formatter={(val: number) => formatAmount(val)} />
                      <Bar dataKey="previous" name="Mois précédent" radius={[4, 4, 0, 0]} opacity={0.3}>
                        {comparisonData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                      <Bar dataKey="current" name="Ce mois" radius={[4, 4, 0, 0]}>
                        {comparisonData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CollapsibleSection>


            {/* ===== 7. BUDGETS ===== */}
            {monthlyBudgets.length > 0 && (
              <CollapsibleSection title={`Budgets${budgetUtilization !== null ? ` (${budgetUtilization.toFixed(0)}% utilisé)` : ''}`} icon={Target}>
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
            {(() => {
              const userId = session?.user?.id;
              const scopedDebts = debts.filter(d => {
                if (financeScope === 'personal') return d.scope === 'personal' && d.created_by === userId;
                return d.scope === 'household';
              });
              return scopedDebts.length > 0 ? (
              <CollapsibleSection title="Suivi des dettes" icon={CreditCard}>
                <div className="space-y-2">
                  {scopedDebts.map(d => {
                    const remaining = getDebtRemaining(d);
                    const isSwissWithProperty = d.mortgage_system === 'swiss' && d.property_value;
                    const refAmount = isSwissWithProperty ? d.property_value! : d.initial_amount;
                    const pct = refAmount > 0 ? Math.min(((refAmount - remaining) / refAmount) * 100, 100) : 0;
                    const totalPaid = d.initial_amount - remaining;
                    const monthlyPayment = getDebtMonthlyPayment(d);
                    return (
                      <div key={d.id} className="bg-secondary/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">🏦 {d.name}</span>
                          <span className="font-mono-amount text-xs font-bold text-primary">
                            {isSwissWithProperty ? `LTV ${Math.round((remaining / d.property_value!) * 100)}%` : `${Math.round(pct)}%`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                          {isSwissWithProperty ? (
                            <div className={`h-full rounded-full transition-all ${
                              (remaining / d.property_value!) <= 0.65 ? 'bg-success' : (remaining / d.property_value!) <= 0.80 ? 'bg-primary' : 'bg-warning'
                            }`} style={{ width: `${pct}%` }} />
                          ) : (
                            <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${pct}%` }} />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono-amount text-muted-foreground">
                            {isSwissWithProperty
                              ? `${formatAmount(remaining, d.currency)} / ${formatAmount(d.property_value!, d.currency)}`
                              : `Payé : ${formatAmount(totalPaid, d.currency)}`}
                          </span>
                          <span className="font-mono-amount text-muted-foreground">Restant : {formatAmount(remaining, d.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] mt-0.5">
                          <span className="text-muted-foreground">Mensualité : {formatAmount(monthlyPayment, d.currency)}</span>
                          {d.interest_rate > 0 && <span className="text-muted-foreground">Taux : {d.interest_rate}%</span>}
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const convertToMain = (amount: number, fromCurrency: string) => {
                      if (fromCurrency === currency) return amount;
                      const fromToEur = DEFAULT_EXCHANGE_RATES[fromCurrency] || 1;
                      const mainToEur = DEFAULT_EXCHANGE_RATES[currency] || 1;
                      return amount * (fromToEur / mainToEur);
                    };
                    const totalRemaining = scopedDebts.reduce((s, d) => s + convertToMain(getDebtRemaining(d), d.currency), 0);
                    const totalMonthly = scopedDebts.reduce((s, d) => s + convertToMain(getDebtMonthlyPayment(d), d.currency), 0);
                    const debtRatio = income > 0 ? (totalMonthly / income * 100) : 0;
                    const ltvDebts = scopedDebts.filter(d => d.mortgage_system === 'swiss' && d.property_value);
                    return (
                      <div className="bg-primary/8 border border-primary/15 rounded-xl p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold">Total restant dû</span>
                          <span className="font-mono-amount font-bold text-sm text-primary">{formatAmount(totalRemaining)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-muted-foreground">Mensualités totales</span>
                          <span className="font-mono-amount text-[11px] text-muted-foreground">{formatAmount(totalMonthly)}/mois</span>
                        </div>
                        {income > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Taux d'endettement</span>
                            <span className={`font-mono-amount text-[11px] font-semibold ${debtRatio > 33 ? 'text-destructive' : 'text-success'}`}>
                              {debtRatio.toFixed(1)}%
                            </span>
                          </div>
                        )}

                        {/* Détail taux d'endettement - dépliable */}
                        {income > 0 && (
                          <CalculDetail label="📐 Voir le détail du taux d'endettement">
                            <div className="space-y-1 mb-2">
                              {scopedDebts.map(d => {
                                const monthly = getDebtMonthlyPayment(d);
                                const converted = convertToMain(monthly, d.currency);
                                const debtEmoji = d.type === 'mortgage' ? '🏠' : d.type === 'auto' ? '🚗' : d.type === 'consumer' ? '💳' : d.type === 'student' ? '🎓' : '📦';
                                return (
                                  <div key={d.id} className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground truncate flex-1">{debtEmoji} {d.name}</span>
                                    <span className="font-mono-amount text-[10px] text-foreground ml-2">
                                      {formatAmount(converted)}/mois
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="bg-secondary/40 rounded-lg p-2 space-y-0.5">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-muted-foreground">Σ Mensualités</span>
                                <span className="font-mono-amount text-[10px] font-semibold">{formatAmount(totalMonthly)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-muted-foreground">÷ Revenus du mois</span>
                                <span className="font-mono-amount text-[10px] font-semibold">{formatAmount(income)}</span>
                              </div>
                              <div className="flex justify-between items-center border-t border-border/30 pt-1">
                                <span className="text-[10px] font-semibold">= Taux d'endettement</span>
                                <span className={`font-mono-amount text-[10px] font-bold ${debtRatio > 33 ? 'text-destructive' : 'text-success'}`}>
                                  {debtRatio.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <p className="text-[9px] text-muted-foreground italic mt-1">
                              {debtRatio <= 33 ? '✅ En dessous du seuil recommandé de 33%' : '⚠️ Au-dessus du seuil recommandé de 33%'}
                            </p>
                          </CalculDetail>
                        )}

                        {/* Détail LTV - dépliable */}
                        {ltvDebts.length > 0 && (
                          <CalculDetail label="🏠 Voir le détail LTV (Loan-to-Value)">
                            <div className="space-y-2">
                              {ltvDebts.map(d => {
                                const remaining = getDebtRemaining(d);
                                const ltv = d.property_value! > 0 ? (remaining / d.property_value!) * 100 : 0;
                                return (
                                  <div key={d.id} className="bg-secondary/40 rounded-lg p-2">
                                    <p className="text-[10px] font-medium mb-1">🏠 {d.name}</p>
                                    <div className="space-y-0.5">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-muted-foreground">Solde restant</span>
                                        <span className="font-mono-amount text-[10px]">{formatAmount(remaining, d.currency)}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-muted-foreground">÷ Valeur du bien</span>
                                        <span className="font-mono-amount text-[10px]">{formatAmount(d.property_value!, d.currency)}</span>
                                      </div>
                                      <div className="flex justify-between items-center border-t border-border/30 pt-1">
                                        <span className="text-[10px] font-semibold">= LTV</span>
                                        <span className={`font-mono-amount text-[10px] font-bold ${ltv <= 65 ? 'text-success' : ltv <= 80 ? 'text-primary' : 'text-destructive'}`}>
                                          {ltv.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground italic mt-1">
                                      {ltv <= 65 ? '✅ LTV ≤ 65% — Seuil optimal atteint' : ltv <= 80 ? '👍 LTV ≤ 80% — Bon niveau' : '⚠️ LTV > 80% — Amortissement recommandé'}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </CalculDetail>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </CollapsibleSection>
              ) : null;
            })()}

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
