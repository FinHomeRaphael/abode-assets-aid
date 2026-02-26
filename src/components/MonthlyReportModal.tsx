import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { getBudgetStatus, formatAmount as rawFormatAmount } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import MonthSelector from './MonthSelector';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Target, Wallet, PiggyBank, CreditCard, Sparkles, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const COLORS = ['hsl(174, 30%, 45%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(280, 60%, 55%)', 'hsl(30, 70%, 50%)', 'hsl(190, 70%, 40%)', 'hsl(340, 70%, 50%)'];

function generateReportAdvice(
  income: number,
  savings: number,
  savingsGoals: { name: string; emoji: string; target: number; saved: number; targetDate?: string }[],
  overBudgets: { category: string; emoji: string }[],
  currency: string,
): string {
  const fmt = (n: number) => rawFormatAmount(n, currency);
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  if (overBudgets.length > 0) {
    return `⚠️ ${overBudgets.length} budget(s) dépassé(s) ce mois : ${overBudgets.map(b => `${b.emoji} ${b.category}`).join(', ')}. Revoyez ces catégories pour le mois prochain.`;
  }

  const goalsWithDate = savingsGoals.filter(g => g.targetDate && g.saved < g.target);
  if (goalsWithDate.length > 0) {
    const g = goalsWithDate[0];
    const remaining = g.target - g.saved;
    const targetDate = new Date(g.targetDate!);
    const now = new Date();
    const monthsLeft = Math.max(1, (targetDate.getFullYear() - now.getFullYear()) * 12 + targetDate.getMonth() - now.getMonth());
    const monthlyNeeded = remaining / monthsLeft;
    if (savings > 0 && savings >= monthlyNeeded) {
      return `🎯 À ce rythme, vous atteindrez ${g.emoji} "${g.name}" dans environ ${Math.ceil(remaining / savings)} mois. Continuez !`;
    }
    return `📈 Augmentez vos versements de ${fmt(monthlyNeeded - savings)}/mois pour atteindre ${g.emoji} "${g.name}" à temps (${monthsLeft} mois restants).`;
  }

  if (savingsRate >= 20) {
    return `🌟 Excellent mois ! Vous avez épargné ${savingsRate.toFixed(0)}% de vos revenus. C'est au-dessus de la recommandation de 20%.`;
  }
  if (savingsRate >= 10) {
    return `👍 Bon mois ! Vous avez mis de côté ${savingsRate.toFixed(0)}% de vos revenus. Visez 20% pour optimiser !`;
  }
  if (income > 0 && savingsRate < 10) {
    return `💡 Ce mois vous avez mis de côté ${savingsRate.toFixed(0)}% de vos revenus. Essayez au moins 10% pour sécuriser votre avenir.`;
  }
  return `💪 Vos finances sont en bonne santé. Pensez à définir des objectifs pour structurer votre stratégie !`;
}

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="w-3.5 h-3.5 text-primary" />
    </div>
    <h3 className="font-semibold text-sm">{title}</h3>
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

const MonthlyReportModal = ({ open, onClose }: Props) => {
  const { getTransactionsForMonth, getBudgetsForMonth, getBudgetSpent, getMonthSavings, scopedSavingsGoals: savingsGoals, getGoalSaved, getActiveAccounts, getAccountBalance, householdId, scopedAccounts: accounts, scopedTransactions: allTransactions, financeScope, session } = useApp();
  const { formatAmount, currency } = useCurrency();
  const [month, setMonth] = useState(new Date());

  // Fetch debts
  interface DebtRow {
    id: string;
    name: string;
    type: string;
    initial_amount: number;
    remaining_amount: number;
    payment_amount: number;
    interest_rate: number;
    currency: string;
    start_date: string;
    duration_years: number;
    payment_frequency: string;
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
  
  // Identifier les comptes épargne
  const epargneAccountIds = new Set(accounts.filter(a => a.type === 'epargne').map(a => a.id));
  
  // Épargne entrante = tout revenu sur un compte épargne
  const epargneIn = transactions
    .filter(t => t.type === 'income' && t.accountId && epargneAccountIds.has(t.accountId))
    .reduce((s, t) => s + t.convertedAmount, 0);
  // Épargne sortante = toute dépense sur un compte épargne
  const epargneOut = transactions
    .filter(t => t.type === 'expense' && t.accountId && epargneAccountIds.has(t.accountId))
    .reduce((s, t) => s + t.convertedAmount, 0);
  const totalEpargneComptes = epargneIn - epargneOut;

  // Revenus = hors transferts ET hors revenus directs sur comptes épargne
  const income = transactions.filter(t => t.type === 'income' && t.category !== 'Transfert' && !(t.accountId && epargneAccountIds.has(t.accountId))).reduce((s, t) => s + t.convertedAmount, 0);
  // Dépenses = hors transferts ET hors dépenses sur comptes épargne (déjà comptées dans épargne)
  const expenses = transactions.filter(t => t.type === 'expense' && t.category !== 'Transfert' && !(t.accountId && epargneAccountIds.has(t.accountId))).reduce((s, t) => s + t.convertedAmount, 0);
  const savings = getMonthSavings(month);

  const available = income - expenses - savings;

  const prevMonth = new Date(month);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevTransactions = useMemo(() => getTransactionsForMonth(prevMonth), [prevMonth, getTransactionsForMonth]);
  const prevExpenses = prevTransactions.filter(t => t.type === 'expense' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const prevIncome = prevTransactions.filter(t => t.type === 'income' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense' && t.category !== 'Transfert').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.convertedAmount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const monthlyBudgets = useMemo(() => getBudgetsForMonth(month).filter(b => b.period === 'monthly'), [getBudgetsForMonth, month]);

  const goalsData = useMemo(() => savingsGoals.map(g => ({
    ...g,
    saved: getGoalSaved(g.id),
  })), [savingsGoals, getGoalSaved]);

  const overBudgets = useMemo(() => monthlyBudgets.filter(b => {
    const spent = getBudgetSpent(b, month);
    return spent > b.limit;
  }), [monthlyBudgets, getBudgetSpent, month]);

  const aiAdvice = useMemo(() => generateReportAdvice(
    income, savings, goalsData, overBudgets, currency,
  ), [income, savings, goalsData, overBudgets, currency]);

  const diffPct = (curr: number, prev: number) => {
    if (prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  };

  const getTimeRemaining = (targetDate?: string) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const now = new Date();
    const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
    if (months <= 0) return 'Échéance passée';
    if (months === 1) return '1 mois restant';
    return `${months} mois restants`;
  };

  if (!open) return null;

  // Account balances computation
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

  const totalAccountsBalance = activeAccounts.reduce((sum, acc) => sum + getAccountBalanceAtMonth(acc.id), 0);

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
  const prevTotalAccountsBalance = activeAccounts.reduce((sum, acc) => sum + getAccountBalanceAtPrevMonth(acc.id), 0);
  const balanceDiff = totalAccountsBalance - prevTotalAccountsBalance;
  const balanceDiffPct = prevTotalAccountsBalance !== 0 ? ((balanceDiff) / Math.abs(prevTotalAccountsBalance)) * 100 : null;

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
          className="bg-card w-full max-w-lg rounded-2xl border border-border/50 shadow-2xl max-h-[88vh] overflow-hidden flex flex-col"
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
                  <p className="text-[10px] text-muted-foreground">Rapport mensuel</p>
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

            {/* Hero: Total balance */}
            {activeAccounts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-5 text-center relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_70%)]" />
                <div className="relative">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">Solde total fin de mois</p>
                  <p className={`text-2xl font-bold font-mono-amount tracking-tight ${totalAccountsBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                    {formatAmount(totalAccountsBalance)}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`text-xs font-mono-amount font-semibold ${balanceDiff >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {balanceDiff >= 0 ? '+' : ''}{formatAmount(balanceDiff)}
                    </span>
                    {balanceDiffPct !== null && (
                      <DiffBadge value={balanceDiffPct} suffix="%" />
                    )}
                  </div>
                </div>

                {/* Account chips */}
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {activeAccounts.map(acc => {
                    const bal = getAccountBalanceAtMonth(acc.id);
                    return (
                      <div key={acc.id} className="bg-card/70 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-border/30">
                        <p className="text-[9px] text-muted-foreground leading-none mb-0.5">{acc.name}</p>
                        <p className={`font-mono-amount font-semibold text-[11px] leading-none ${bal >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                          {formatAmount(bal, acc.currency)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Flux summary cards */}
            <div>
              <SectionTitle icon={Wallet} title="Flux du mois" />
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-success/5 border border-success/15 rounded-xl p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-success mx-auto mb-1.5" />
                  <p className="text-[10px] text-muted-foreground mb-0.5">Revenus</p>
                  <p className="font-mono-amount font-bold text-success text-sm">+{formatAmount(income)}</p>
                  <DiffBadge value={diffPct(income, prevIncome)} suffix="%" />
                </div>
                <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-3 text-center">
                  <TrendingDown className="w-4 h-4 text-destructive mx-auto mb-1.5" />
                  <p className="text-[10px] text-muted-foreground mb-0.5">Dépenses</p>
                  <p className="font-mono-amount font-bold text-destructive text-sm">-{formatAmount(expenses)}</p>
                  <DiffBadge value={diffPct(expenses, prevExpenses)} suffix="%" />
                </div>
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-center">
                  <Target className="w-4 h-4 text-primary mx-auto mb-1.5" />
                  <p className="text-[10px] text-muted-foreground mb-0.5">Épargne</p>
                  <p className="font-mono-amount font-bold text-primary text-sm">-{formatAmount(savings)}</p>
                </div>
              </div>

              {/* Épargne */}
              {(epargneIn > 0 || epargneOut > 0) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">🐖 Épargne versée</p>
                    <p className="font-mono-amount font-bold text-primary text-sm">+{formatAmount(epargneIn)}</p>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">🐖 Dép. épargne</p>
                    <p className="font-mono-amount font-bold text-destructive text-sm">-{formatAmount(epargneOut)}</p>
                  </div>
                </div>
              )}

              {/* Available */}
              <div className={`mt-2 rounded-xl p-3 text-center border ${available >= 0 ? 'bg-success/5 border-success/15' : 'bg-destructive/5 border-destructive/15'}`}>
                <p className="text-[10px] text-muted-foreground mb-0.5">Disponible</p>
                <p className={`font-mono-amount font-bold text-base ${available >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {available >= 0 ? '+' : ''}{formatAmount(available)}
                </p>
              </div>
            </div>

            {/* Expense breakdown */}
            {expensesByCategory.length > 0 && (
              <div>
                <SectionTitle icon={PiggyBank} title="Répartition des dépenses" />
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
                      {expensesByCategory.slice(0, 6).map((cat, i) => {
                        const pct = expenses > 0 ? (cat.value / expenses * 100) : 0;
                        return (
                          <div key={cat.name} className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="truncate flex-1">{cat.name}</span>
                            <span className="font-mono-amount text-muted-foreground whitespace-nowrap">{pct.toFixed(0)}%</span>
                            <span className="font-mono-amount font-medium whitespace-nowrap">{formatAmount(cat.value)}</span>
                          </div>
                        );
                      })}
                      {expensesByCategory.length > 6 && (
                        <p className="text-[10px] text-muted-foreground">+{expensesByCategory.length - 6} autres</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Budget status */}
            {monthlyBudgets.length > 0 && (
              <div>
                <SectionTitle icon={Target} title="Budgets" />
                <div className="space-y-2">
                  {monthlyBudgets.map(b => {
                    const spent = getBudgetSpent(b, month);
                    const status = getBudgetStatus(spent, b.limit);
                    const pct = b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0;
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
                          <span className="font-mono-amount text-[11px] text-muted-foreground">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Savings goals */}
            {goalsData.length > 0 && (
              <div>
                <SectionTitle icon={PiggyBank} title="Objectifs d'épargne" />
                <div className="space-y-2">
                  {goalsData.map(g => {
                    const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Debts */}
            {debts.length > 0 && (
              <div>
                <SectionTitle icon={CreditCard} title="Suivi des dettes" />
                <div className="space-y-2">
                  {debts.map(d => {
                    const pct = d.initial_amount > 0 ? Math.min(((d.initial_amount - d.remaining_amount) / d.initial_amount) * 100, 100) : 0;
                    return (
                      <div key={d.id} className="bg-secondary/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">🏦 {d.name}</span>
                          <span className="font-mono-amount text-xs font-bold text-primary">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono-amount text-[11px] text-muted-foreground">Restant : {formatAmount(d.remaining_amount, d.currency)}</span>
                          <span className="font-mono-amount text-[11px] text-muted-foreground">{formatAmount(d.payment_amount, d.currency)}/mois</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="bg-primary/8 border border-primary/15 rounded-xl p-3 flex justify-between items-center">
                    <span className="text-sm font-semibold">Total restant dû</span>
                    <span className="font-mono-amount font-bold text-sm text-primary">{formatAmount(debts.reduce((s, d) => s + d.remaining_amount, 0))}</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Advice */}
            <div className="bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/15 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs mb-1 text-primary">Conseil IA</p>
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
