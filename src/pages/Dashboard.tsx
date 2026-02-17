import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { formatAmount, formatDate, getBudgetStatus, getInitials } from '@/utils/format';
import Layout from '@/components/Layout';

const Dashboard = () => {
  const { transactions, budgets, investments, household, getMemberById, getBudgetSpent } = useApp();
  const navigate = useNavigate();

  const monthTransactions = transactions; // demo: all are current month
  const totalIncome = monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalInvestments = investments.reduce((s, i) => s + i.value, 0);
  const balance = totalIncome - totalExpense;

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <Layout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        {/* Stats */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Solde total" value={formatAmount(balance)} emoji="💰" className="bg-card" />
          <StatCard title="Revenus du mois" value={`+${formatAmount(totalIncome)}`} subtitle="+12% vs mois dernier" className="text-success" />
          <StatCard title="Dépenses du mois" value={`-${formatAmount(totalExpense)}`} subtitle="+5% vs mois dernier" className="text-destructive" />
          <StatCard title="Investissements" value={formatAmount(totalInvestments)} subtitle="+1.8% ce mois" className="text-primary" />
        </motion.div>

        {/* AI Tip */}
        <motion.div variants={fadeUp} className="bg-primary/5 border-l-4 border-primary rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">✨</span>
            <div>
              <p className="font-medium text-sm mb-1">Conseil IA</p>
              <p className="text-sm text-muted-foreground">
                Votre budget Loisirs est dépassé de 20%. En réduisant de 30€/mois, vous pourriez épargner 360€ cette année.
              </p>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { emoji: '📸', label: 'Scanner ticket' },
                  { emoji: '📊', label: 'Rapport mensuel' },
                  { emoji: '🎯', label: 'Nouvel objectif' },
                  { emoji: '💱', label: 'Convertir devise' },
                ].map(a => (
                  <button key={a.label} className="bg-card border border-border rounded-lg p-3 text-center hover:bg-secondary/50 transition-colors card-hover">
                    <span className="text-2xl block mb-1">{a.emoji}</span>
                    <span className="text-xs font-medium">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: Budgets + Investments */}
          <motion.div variants={fadeUp} className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Budgets du mois</h2>
                <button onClick={() => navigate('/budgets')} className="text-sm text-primary hover:underline">Voir →</button>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 space-y-4">
                {budgets.filter(b => b.period === 'monthly').slice(0, 4).map(b => {
                  const spent = getBudgetSpent(b);
                  const status = getBudgetStatus(spent, b.limit);
                  const pct = Math.min((spent / b.limit) * 100, 100);
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span>{b.emoji} {b.category}</span>
                        <span className="font-mono text-xs">{formatAmount(spent)} / {formatAmount(b.limit)}</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            status === 'ok' ? 'bg-success' : status === 'warning' ? 'bg-warning' : 'bg-destructive'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Portefeuille</h2>
                <button onClick={() => navigate('/investments')} className="text-sm text-primary hover:underline">Voir →</button>
              </div>
              <div className="bg-card rounded-lg border border-border p-4 space-y-3">
                {investments.map(i => (
                  <div key={i.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{i.emoji}</span>
                      <div>
                        <p className="text-sm font-medium">{i.name}</p>
                        <p className="text-xs text-muted-foreground">{i.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-medium">{formatAmount(i.value)}</p>
                      <p className={`text-xs font-mono ${i.variation >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {i.variation >= 0 ? '+' : ''}{i.variation}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 bg-foreground text-background rounded-lg p-4 text-center">
                <p className="text-xs text-background/60 mb-1">Valeur totale</p>
                <p className="text-xl font-bold font-mono">{formatAmount(totalInvestments)}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
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
