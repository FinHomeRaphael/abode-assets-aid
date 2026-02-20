import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { getBudgetStatus, formatAmount as rawFormatAmount } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import MonthSelector from './MonthSelector';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onClose: () => void;
}

const COLORS = ['hsl(199, 89%, 48%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(280, 60%, 55%)', 'hsl(30, 70%, 50%)', 'hsl(190, 70%, 40%)', 'hsl(340, 70%, 50%)'];

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

  // Check savings goals with target dates
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

const MonthlyReportModal = ({ open, onClose }: Props) => {
  const { getTransactionsForMonth, getBudgetsForMonth, getBudgetSpent, getMonthSavings, savingsGoals, getGoalSaved, getActiveAccounts, getAccountBalance, householdId, accounts, transactions: allTransactions } = useApp();
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
    const { data } = await supabase.from('debts').select('*').eq('household_id', householdId);
    if (data) setDebts(data as DebtRow[]);
  }, [householdId]);
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
    if (months === 1) return 'Objectif dans 1 mois';
    return `Objectif dans ${months} mois`;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-lg max-h-[85vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">📊 Rapport mensuel</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="mb-5 flex justify-center">
              <MonthSelector currentMonth={month} onChange={setMonth} />
            </div>

            {/* Financial summary */}
            {(() => {
              const activeAccounts = getActiveAccounts();
              // Calculer le solde de chaque compte à la fin du mois sélectionné
              const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0); // dernier jour du mois
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
              return (
                <>
                  {/* Solde des comptes à fin de mois */}
                  {activeAccounts.length > 0 && (
                    <div className="mb-4">
                      <div className="bg-primary/10 rounded-xl p-4 text-center mb-2">
                        <p className="text-xs text-muted-foreground mb-1">Solde total des comptes (fin de mois)</p>
                        <p className={`text-xl font-bold font-mono ${totalAccountsBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatAmount(totalAccountsBalance)}</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {activeAccounts.map(acc => {
                          const bal = getAccountBalanceAtMonth(acc.id);
                          return (
                            <div key={acc.id} className="bg-secondary/50 rounded-lg p-2.5 text-center">
                              <p className="text-[10px] text-muted-foreground truncate">{acc.name}</p>
                              <p className={`font-mono font-semibold text-xs ${bal >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatAmount(bal, acc.currency)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mois en cours */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    <div className="bg-secondary/50 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Revenus</p>
                      <p className="font-mono font-bold text-success text-sm">+{formatAmount(income)}</p>
                      {diffPct(income, prevIncome) !== null && (
                        <p className="text-xs text-muted-foreground mt-0.5">{diffPct(income, prevIncome)! >= 0 ? '+' : ''}{diffPct(income, prevIncome)!.toFixed(0)}%</p>
                      )}
                    </div>
                    <div className="bg-secondary/50 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Dépenses</p>
                      <p className="font-mono font-bold text-destructive text-sm">-{formatAmount(expenses)}</p>
                      {diffPct(expenses, prevExpenses) !== null && (
                        <p className="text-xs text-muted-foreground mt-0.5">{diffPct(expenses, prevExpenses)! >= 0 ? '+' : ''}{diffPct(expenses, prevExpenses)!.toFixed(0)}%</p>
                      )}
                    </div>
                    <div className="bg-secondary/50 rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Enveloppes</p>
                      <p className="font-mono font-bold text-primary text-sm">-{formatAmount(savings)}</p>
                    </div>
                  </div>
                  {/* Épargne */}
                  {(epargneIn > 0 || epargneOut > 0) && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">🐖 Épargne versée</p>
                        <p className="font-mono font-bold text-primary text-sm">+{formatAmount(epargneIn)}</p>
                      </div>
                      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">🐖 Dép. épargne</p>
                        <p className="font-mono font-bold text-destructive text-sm">-{formatAmount(epargneOut)}</p>
                      </div>
                    </div>
                  )}
                  {/* Disponible */}
                  <div className="bg-secondary/50 rounded-xl p-3 text-center mb-6">
                    <p className="text-xs text-muted-foreground mb-1">Disponible</p>
                    <p className={`font-mono font-bold text-sm ${available >= 0 ? 'text-success' : 'text-destructive'}`}>{available >= 0 ? '+' : ''}{formatAmount(available)}</p>
                  </div>
                </>
              );
            })()}

            {/* Expense breakdown */}
            {expensesByCategory.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-3 text-center">Répartition des dépenses</h3>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-40 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expensesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                          {expensesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(val: number) => formatAmount(val)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full max-w-sm space-y-1.5">
                    {expensesByCategory.map((cat, i) => (
                      <div key={cat.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span>{cat.name}</span>
                        </div>
                        <span className="font-mono text-xs">{formatAmount(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Budget status */}
            {monthlyBudgets.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-3 text-center">État des budgets</h3>
                <div className="space-y-2 max-w-md mx-auto">
                  {monthlyBudgets.map(b => {
                    const spent = getBudgetSpent(b, month);
                    const status = getBudgetStatus(spent, b.limit);
                    return (
                      <div key={b.id} className="flex items-center justify-between text-sm">
                        <span>{b.emoji} {b.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{formatAmount(spent)} / {formatAmount(b.limit)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            status === 'ok' ? 'bg-success/10 text-success' : status === 'warning' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {status === 'ok' ? '✓' : status === 'warning' ? '⚠️' : '❌'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Savings goals */}
            {goalsData.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-3 text-center">Objectifs d'enveloppe</h3>
                <div className="space-y-3 max-w-md mx-auto">
                  {goalsData.map(g => {
                    const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
                    const timeRemaining = getTimeRemaining(g.targetDate);
                    return (
                      <div key={g.id} className="bg-secondary/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">{g.emoji} {g.name}</span>
                          <span className="text-xs font-mono font-bold text-primary">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : pct >= 60 ? 'bg-primary' : 'bg-warning'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">{formatAmount(g.saved, g.currency)} / {formatAmount(g.target, g.currency)}</span>
                          <span className="text-xs text-muted-foreground">
                            {timeRemaining || 'Pas de date cible définie'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Debts */}
            {debts.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-3 text-center">Suivi des dettes</h3>
                <div className="space-y-3 max-w-md mx-auto">
                  {debts.map(d => {
                    const pct = d.initial_amount > 0 ? Math.min(((d.initial_amount - d.remaining_amount) / d.initial_amount) * 100, 100) : 0;
                    const totalDebt = debts.reduce((s, x) => s + x.remaining_amount, 0);
                    const monthlyTotal = debts.reduce((s, x) => s + x.payment_amount, 0);
                    return (
                      <div key={d.id} className="bg-secondary/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">🏦 {d.name}</span>
                          <span className="text-xs font-mono font-bold text-primary">{Math.round(pct)}% remboursé</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">Restant : {formatAmount(d.remaining_amount, d.currency)}</span>
                          <span className="font-mono text-xs text-muted-foreground">Mensualité : {formatAmount(d.payment_amount, d.currency)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="bg-primary/10 rounded-xl p-3 flex justify-between items-center">
                    <span className="text-sm font-semibold">Total restant dû</span>
                    <span className="font-mono font-bold text-sm text-primary">{formatAmount(debts.reduce((s, d) => s + d.remaining_amount, 0))}</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Advice */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">✨</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">Conseil IA</p>
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
