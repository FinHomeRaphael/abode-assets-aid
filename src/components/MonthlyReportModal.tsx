import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatAmount, getBudgetStatus } from '@/utils/format';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import MonthSelector from './MonthSelector';

interface Props {
  open: boolean;
  onClose: () => void;
}

const COLORS = ['hsl(199, 89%, 48%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(280, 60%, 55%)', 'hsl(30, 70%, 50%)', 'hsl(190, 70%, 40%)', 'hsl(340, 70%, 50%)'];

const MonthlyReportModal = ({ open, onClose }: Props) => {
  const { getTransactionsForMonth, budgets, getBudgetSpent, getMemberById, getMonthSavings } = useApp();
  const [month, setMonth] = useState(new Date());

  const transactions = useMemo(() => getTransactionsForMonth(month), [month, getTransactionsForMonth]);
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = getMonthSavings(month);
  const net = income - expenses - savings;

  // Previous month
  const prevMonth = new Date(month);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevTransactions = useMemo(() => getTransactionsForMonth(prevMonth), [prevMonth, getTransactionsForMonth]);
  const prevExpenses = prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  // Expenses by category for pie chart
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Top 5 expenses
  const top5 = useMemo(() => {
    return [...transactions].filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [transactions]);

  // Budget status
  const monthlyBudgets = budgets.filter(b => b.period === 'monthly');

  const diffPct = (curr: number, prev: number) => {
    if (prev === 0) return null;
    const pct = ((curr - prev) / prev) * 100;
    return pct;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-2xl rounded-lg border border-border shadow-lg max-h-[85vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">📊 Rapport mensuel</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="mb-5">
              <MonthSelector currentMonth={month} onChange={setMonth} />
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Revenus</p>
                <p className="font-mono font-bold text-success text-sm">+{formatAmount(income)}</p>
                {diffPct(income, prevIncome) !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">{diffPct(income, prevIncome)! >= 0 ? '+' : ''}{diffPct(income, prevIncome)!.toFixed(0)}% vs mois préc.</p>
                )}
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Dépenses</p>
                <p className="font-mono font-bold text-destructive text-sm">-{formatAmount(expenses)}</p>
                {diffPct(expenses, prevExpenses) !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">{diffPct(expenses, prevExpenses)! >= 0 ? '+' : ''}{diffPct(expenses, prevExpenses)!.toFixed(0)}% vs mois préc.</p>
                )}
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Solde net</p>
                <p className={`font-mono font-bold text-sm ${net >= 0 ? 'text-success' : 'text-destructive'}`}>{net >= 0 ? '+' : ''}{formatAmount(net)}</p>
              </div>
            </div>

            {/* Pie chart */}
            {expensesByCategory.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-3">Répartition des dépenses</h3>
                <div className="flex items-center gap-4">
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
                  <div className="flex-1 space-y-1.5">
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

            {/* Top 5 */}
            {top5.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-3">Top 5 dépenses</h3>
                <div className="bg-secondary/30 rounded-lg divide-y divide-border">
                  {top5.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs font-mono w-5">{i + 1}.</span>
                        <span className="text-sm">{t.emoji} {t.label}</span>
                      </div>
                      <span className="font-mono text-sm">{formatAmount(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Budget status */}
            {monthlyBudgets.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">État des budgets</h3>
                <div className="space-y-2">
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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MonthlyReportModal;
