import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatAmount as rawFormatAmount, formatDate, getBudgetStatus, getInitials } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { useNavigate } from 'react-router-dom';
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
  currency: string,
) {
  const fmt = (amount: number) => rawFormatAmount(amount, currency);
  const overBudgets = budgets.filter(b => b.spent > b.limit);
  if (overBudgets.length > 0) {
    const b = overBudgets[0];
    const over = b.spent - b.limit;
    return `Votre budget ${b.emoji} ${b.category} est dépassé de ${fmt(over)}. En réduisant cette catégorie, vous pourriez épargner ${fmt(over * 12)} par an.`;
  }
  const warningBudgets = budgets.filter(b => b.spent / b.limit > 0.8 && b.spent <= b.limit);
  if (warningBudgets.length > 0) {
    const b = warningBudgets[0];
    const pct = Math.round((b.spent / b.limit) * 100);
    return `Attention, votre budget ${b.emoji} ${b.category} est à ${pct}% (${fmt(b.spent)} / ${fmt(b.limit)}). Surveillez vos dépenses cette fin de mois.`;
  }
  const closeGoals = savingsGoals.filter(g => g.saved / g.target >= 0.8 && g.saved < g.target);
  if (closeGoals.length > 0) {
    const g = closeGoals[0];
    const remaining = g.target - g.saved;
    return `${g.emoji} Votre objectif "${g.name}" est presque atteint ! Plus que ${fmt(remaining)} pour atteindre votre cible de ${fmt(g.target)}.`;
  }
  if (prevTotalExpense > 0 && totalExpense > prevTotalExpense) {
    const pct = Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100);
    if (pct > 5) {
      return `Vos dépenses ont augmenté de ${pct}% par rapport au mois dernier (${fmt(totalExpense)} vs ${fmt(prevTotalExpense)}). Revoyez vos catégories les plus coûteuses.`;
    }
  }
  if (monthSavings > 0) {
    return `Bravo ! 🎉 Vous avez épargné ${fmt(monthSavings)} ce mois-ci, pour un total cumulé de ${fmt(totalSavings)}. Continuez sur cette lancée !`;
  }
  return `Vos finances sont en bonne santé ce mois-ci. Pensez à mettre de côté pour vos objectifs d'épargne ! 💪`;
}

const Dashboard = () => {
  const { transactions, budgets, household, getMemberById, getBudgetSpent, getMonthSavings, getTotalSavings, savingsGoals, getGoalSaved, getTransactionsForMonth, currentUser } = useApp();
  const { formatAmount, currency } = useCurrency();
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

  const prevMonth = new Date(now);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevTx = useMemo(() => getTransactionsForMonth(prevMonth), [getTransactionsForMonth]);
  const prevExpense = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const budgetData = budgets.filter(b => b.period === 'monthly').map(b => ({
    ...b,
    spent: getBudgetSpent(b),
  }));

  const goalsData = savingsGoals.map(g => ({ ...g, saved: getGoalSaved(g.id) }));

  const aiAdvice = useMemo(() => generateAIAdvice(budgetData, totalExpense, prevExpense, monthSavings, totalSavings, goalsData, currency), [budgetData, totalExpense, prevExpense, monthSavings, totalSavings, goalsData, currency]);

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

  return (
    <Layout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        {/* Welcome */}
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">Bonjour,</p>
            <h1 className="text-2xl font-bold">{currentUser?.name || 'Utilisateur'} 👋</h1>
          </div>
          <button onClick={() => navigate('/profile')} className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
            {currentUser ? getInitials(currentUser.name) : '?'}
          </button>
        </motion.div>

        {/* Balance card */}
        <motion.div variants={fadeUp} className="bg-primary rounded-3xl p-6 text-primary-foreground shadow-card-lg">
          <p className="text-primary-foreground/70 text-sm font-medium mb-1">Solde disponible</p>
          <p className="text-3xl font-bold font-mono-amount tracking-tight">{formatAmount(balance)}</p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1 bg-primary-foreground/10 rounded-2xl p-3 text-center">
              <p className="text-primary-foreground/60 text-xs mb-0.5">Revenus</p>
              <p className="font-semibold font-mono-amount text-sm">+{formatAmount(totalIncome)}</p>
            </div>
            <div className="flex-1 bg-primary-foreground/10 rounded-2xl p-3 text-center">
              <p className="text-primary-foreground/60 text-xs mb-0.5">Dépenses</p>
              <p className="font-semibold font-mono-amount text-sm">-{formatAmount(totalExpense)}</p>
            </div>
            <div className="flex-1 bg-primary-foreground/10 rounded-2xl p-3 text-center">
              <p className="text-primary-foreground/60 text-xs mb-0.5">Épargne</p>
              <p className="font-semibold font-mono-amount text-sm">{formatAmount(monthSavings)}</p>
            </div>
          </div>
        </motion.div>

        {/* AI Insight */}
        <motion.div variants={fadeUp} className="card-elevated p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">✨</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-0.5">Conseil IA</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{aiAdvice}</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={fadeUp}>
          <h2 className="font-semibold text-base mb-3">Actions rapides</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowScan(true)} className="card-elevated p-4 flex items-center gap-3 card-hover text-left">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="text-xl">📸</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Scanner ticket</p>
                <p className="text-xs text-muted-foreground">Ajouter via photo</p>
              </div>
            </button>
            <button onClick={() => setShowReport(true)} className="card-elevated p-4 flex items-center gap-3 card-hover text-left">
              <div className="w-11 h-11 rounded-2xl bg-success/10 flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Rapport mensuel</p>
                <p className="text-xs text-muted-foreground">Analyser le mois</p>
              </div>
            </button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Transactions */}
          <motion.div variants={fadeUp} className="lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">Transactions récentes</h2>
              <button onClick={() => navigate('/transactions')} className="text-sm text-primary font-medium hover:underline">Voir tout</button>
            </div>
            <div className="card-elevated divide-y divide-border/50 overflow-hidden">
              {transactions.slice(0, 5).map(t => {
                const member = getMemberById(t.memberId);
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-lg">{t.emoji}</div>
                      <div>
                        <p className="text-sm font-semibold">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.category} · {formatDate(t.date)}</p>
                      </div>
                    </div>
                    <span className={`font-mono-amount text-sm font-bold ${t.type === 'income' ? 'text-success' : ''}`}>
                      {t.type === 'income' ? '+' : '-'}{formatAmount(t.amount, t.currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Right sidebar */}
          <motion.div variants={fadeUp} className="lg:col-span-2 space-y-6">
            {/* Budgets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-base">Budgets</h2>
                <button onClick={() => navigate('/budgets')} className="text-sm text-primary font-medium hover:underline">Voir</button>
              </div>
              <div className="card-elevated p-4 space-y-4">
                {budgetData.slice(0, 4).map(b => {
                  const status = getBudgetStatus(b.spent, b.limit);
                  const pct = Math.min((b.spent / b.limit) * 100, 100);
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">{b.emoji} {b.category}</span>
                        <span className="font-mono-amount text-xs text-muted-foreground">{formatAmount(b.spent)} / {formatAmount(b.limit)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${status === 'ok' ? 'bg-primary' : status === 'warning' ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Savings */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-base">Épargne</h2>
                <button onClick={() => navigate('/savings')} className="text-sm text-primary font-medium hover:underline">Voir</button>
              </div>
              <div className="card-elevated p-4 space-y-3">
                {goalsData.slice(0, 3).map(g => {
                  const pct = Math.min((g.saved / g.target) * 100, 100);
                  return (
                    <div key={g.id}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium">{g.emoji} {g.name}</span>
                        <span className="font-mono-amount text-xs font-semibold text-primary">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
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

export default Dashboard;
