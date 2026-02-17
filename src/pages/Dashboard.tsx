import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { formatAmount, formatDate, getBudgetStatus, getInitials } from '@/utils/format';
import Layout from '@/components/Layout';
import ScanTicketModal from '@/components/ScanTicketModal';
import MonthlyReportModal from '@/components/MonthlyReportModal';

function generateAIAdvice(
  budgets: { category: string; emoji: string; spent: number; limit: number }[],
  totalExpense: number,
  prevTotalExpense: number,
  monthSavings: number,
  totalSavings: number,
  savingsGoals: { name: string; emoji: string; target: number; saved: number }[],
) {
  // 1) Budget dépassé
  const overBudgets = budgets.filter(b => b.spent > b.limit);
  if (overBudgets.length > 0) {
    const b = overBudgets[0];
    const over = b.spent - b.limit;
    return `Votre budget ${b.emoji} ${b.category} est dépassé de ${formatAmount(over)}. En réduisant cette catégorie, vous pourriez épargner ${formatAmount(over * 12)} par an.`;
  }

  // 2) Budget >80%
  const warningBudgets = budgets.filter(b => b.spent / b.limit > 0.8 && b.spent <= b.limit);
  if (warningBudgets.length > 0) {
    const b = warningBudgets[0];
    const pct = Math.round((b.spent / b.limit) * 100);
    return `Attention, votre budget ${b.emoji} ${b.category} est à ${pct}% (${formatAmount(b.spent)} / ${formatAmount(b.limit)}). Surveillez vos dépenses cette fin de mois.`;
  }

  // 3) Objectif épargne proche
  const closeGoals = savingsGoals.filter(g => g.saved / g.target >= 0.8 && g.saved < g.target);
  if (closeGoals.length > 0) {
    const g = closeGoals[0];
    const remaining = g.target - g.saved;
    return `${g.emoji} Votre objectif "${g.name}" est presque atteint ! Plus que ${formatAmount(remaining)} pour atteindre votre cible de ${formatAmount(g.target)}.`;
  }

  // 4) Hausse dépenses vs mois dernier
  if (prevTotalExpense > 0 && totalExpense > prevTotalExpense) {
    const pct = Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100);
    if (pct > 5) {
      return `Vos dépenses ont augmenté de ${pct}% par rapport au mois dernier (${formatAmount(totalExpense)} vs ${formatAmount(prevTotalExpense)}). Revoyez vos catégories les plus coûteuses.`;
    }
  }

  // 5) Message positif
  if (monthSavings > 0) {
    return `Bravo ! 🎉 Vous avez épargné ${formatAmount(monthSavings)} ce mois-ci, pour un total cumulé de ${formatAmount(totalSavings)}. Continuez sur cette lancée !`;
  }

  return `Vos finances sont en bonne santé ce mois-ci. Pensez à mettre de côté pour vos objectifs d'épargne ! 💪`;
}

const Dashboard = () => {
  const { transactions, budgets, household, getMemberById, getBudgetSpent, getMonthSavings, getTotalSavings, savingsGoals, getGoalSaved, getTransactionsForMonth } = useApp();
  const navigate = useNavigate();
  const [showScan, setShowScan] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const now = new Date();
  const monthTx = useMemo(() => getTransactionsForMonth(now), [getTransactionsForMonth]);
  const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthSavings = getMonthSavings(now);
  const totalSavings = getTotalSavings();
  const balance = totalIncome - totalExpense - monthSavings;

  // Previous month for comparison
  const prevMonth = new Date(now);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevTx = useMemo(() => getTransactionsForMonth(prevMonth), [getTransactionsForMonth]);
  const prevIncome = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevExpense = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const incomeDiff = prevIncome > 0 ? Math.round(((totalIncome - prevIncome) / prevIncome) * 100) : 0;
  const expenseDiff = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : 0;

  const budgetData = budgets.filter(b => b.period === 'monthly').map(b => ({
    ...b,
    spent: getBudgetSpent(b),
  }));

  const goalsData = savingsGoals.map(g => ({ ...g, saved: getGoalSaved(g.id) }));

  const aiAdvice = useMemo(() => generateAIAdvice(budgetData, totalExpense, prevExpense, monthSavings, totalSavings, goalsData), [budgetData, totalExpense, prevExpense, monthSavings, totalSavings, goalsData]);

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <Layout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        {/* Stats */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Solde total" value={formatAmount(balance)} emoji="💰" className="bg-card" />
          <StatCard title="Revenus du mois" value={`+${formatAmount(totalIncome)}`} subtitle={`${incomeDiff >= 0 ? '+' : ''}${incomeDiff}% vs mois dernier`} className="text-success" />
          <StatCard title="Dépenses du mois" value={`-${formatAmount(totalExpense)}`} subtitle={`${expenseDiff >= 0 ? '+' : ''}${expenseDiff}% vs mois dernier`} className="text-destructive" />
          <StatCard title="Épargne du mois" value={formatAmount(monthSavings)} subtitle={`Total: ${formatAmount(totalSavings)}`} className="text-primary" />
        </motion.div>

        {/* AI Tip */}
        <motion.div variants={fadeUp} className="bg-primary/5 border-l-4 border-primary rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">✨</span>
            <div>
              <p className="font-medium text-sm mb-1">Conseil IA</p>
              <p className="text-sm text-muted-foreground">{aiAdvice}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: Transactions */}
          <motion.div variants={fadeUp} className="lg:col-span-3 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Dernières transactions</h2>
                <button onClick={() => navigate('/transactions')} className="text-sm text-primary hover:underline">Voir tout →</button>
              </div>
              <div className="bg-card rounded-lg border border-border divide-y divide-border">
                {transactions.slice(0, 5).map(t => {
                  const member = getMemberById(t.memberId);
                  return (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{t.emoji}</span>
                        <div>
                          <p className="text-sm font-medium">{t.label}</p>
                          <p className="text-xs text-muted-foreground">{t.category} · {member?.name} · {formatDate(t.date)}</p>
                        </div>
                      </div>
                      <span className={`font-mono text-sm font-medium ${t.type === 'income' ? 'text-success' : ''}`}>
                        {t.type === 'income' ? '+' : '-'}{formatAmount(t.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="font-semibold mb-3">Actions rapides</h2>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowScan(true)} className="bg-card border border-border rounded-lg p-3 text-center hover:bg-secondary/50 transition-colors card-hover">
                  <span className="text-2xl block mb-1">📸</span>
                  <span className="text-xs font-medium">Scanner ticket</span>
                </button>
                <button onClick={() => setShowReport(true)} className="bg-card border border-border rounded-lg p-3 text-center hover:bg-secondary/50 transition-colors card-hover">
                  <span className="text-2xl block mb-1">📊</span>
                  <span className="text-xs font-medium">Rapport mensuel</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right: Budgets */}
          <motion.div variants={fadeUp} className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Budgets du mois</h2>
                <button onClick={() => navigate('/budgets')} className="text-sm text-primary hover:underline">Voir →</button>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 space-y-4">
                {budgetData.slice(0, 4).map(b => {
                  const status = getBudgetStatus(b.spent, b.limit);
                  const pct = Math.min((b.spent / b.limit) * 100, 100);
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span>{b.emoji} {b.category}</span>
                        <span className="font-mono text-xs">{formatAmount(b.spent)} / {formatAmount(b.limit)}</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${status === 'ok' ? 'bg-success' : status === 'warning' ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Savings summary */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Objectifs d'épargne</h2>
                <button onClick={() => navigate('/savings')} className="text-sm text-primary hover:underline">Voir →</button>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 space-y-3">
                {goalsData.slice(0, 3).map(g => {
                  const pct = Math.min((g.saved / g.target) * 100, 100);
                  return (
                    <div key={g.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{g.emoji} {g.name}</span>
                        <span className="font-mono text-xs">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <ScanTicketModal open={showScan} onClose={() => setShowScan(false)} />
      <MonthlyReportModal open={showReport} onClose={() => setShowReport(false)} />
    </Layout>
  );
};

function StatCard({ title, value, subtitle, emoji, className = '' }: { title: string; value: string; subtitle?: string; emoji?: string; className?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 card-hover">
      <p className="text-xs text-muted-foreground mb-1">{emoji && <span className="mr-1">{emoji}</span>}{title}</p>
      <p className={`text-lg font-bold font-mono ${className}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export default Dashboard;
