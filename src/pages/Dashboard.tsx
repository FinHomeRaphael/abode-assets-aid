import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatAmount as rawFormatAmount, formatDate, getBudgetStatus, getInitials } from '@/utils/format';
import { useSubscription } from '@/hooks/useSubscription';
import { useCurrency } from '@/hooks/useCurrency';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import OnboardingModal from '@/components/OnboardingModal';
import ScanTicketModal from '@/components/ScanTicketModal';
import MonthlyReportModal from '@/components/MonthlyReportModal';
import ConvertedAmount from '@/components/ConvertedAmount';
import { supabase } from '@/integrations/supabase/client';
import { Debt, getDebtEmoji, calculateNextPaymentDate } from '@/types/debt';
import { toast } from 'sonner';

function generateAIAdvices(
  budgets: { category: string; emoji: string; spent: number; limit: number }[],
  totalExpense: number,
  prevTotalExpense: number,
  monthSavings: number,
  totalSavings: number,
  savingsGoals: { name: string; emoji: string; target: number; saved: number }[],
  currency: string,
): { icon: string; title: string; text: string }[] {
  const fmt = (amount: number) => rawFormatAmount(amount, currency);
  const advices: { icon: string; title: string; text: string }[] = [];

  // Conseil 1 : budget
  const overBudgets = budgets.filter(b => b.spent > b.limit);
  if (overBudgets.length > 0) {
    const b = overBudgets[0];
    const over = b.spent - b.limit;
    advices.push({ icon: '⚠️', title: 'Alerte budget', text: `Votre budget ${b.emoji} ${b.category} est dépassé de ${fmt(over)}. Réduisez cette catégorie pour économiser ${fmt(over * 12)}/an.` });
  } else {
    const warningBudgets = budgets.filter(b => b.spent / b.limit > 0.8 && b.spent <= b.limit);
    if (warningBudgets.length > 0) {
      const b = warningBudgets[0];
      const pct = Math.round((b.spent / b.limit) * 100);
      advices.push({ icon: '👀', title: 'Budget à surveiller', text: `${b.emoji} ${b.category} est à ${pct}% (${fmt(b.spent)} / ${fmt(b.limit)}). Surveillez vos dépenses cette fin de mois.` });
    } else {
      advices.push({ icon: '✅', title: 'Budgets maîtrisés', text: `Tous vos budgets sont sous contrôle ce mois-ci. Bravo, continuez comme ça ! 💪` });
    }
  }

  // Conseil 2 : épargne / tendance
  if (monthSavings > 0) {
    advices.push({ icon: '🎉', title: 'Épargne du mois', text: `Vous avez mis de côté ${fmt(monthSavings)} ce mois-ci, pour un total de ${fmt(totalSavings)}. Continuez sur cette lancée !` });
  } else if (prevTotalExpense > 0 && totalExpense > prevTotalExpense) {
    const pct = Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100);
    advices.push({ icon: '📈', title: 'Tendance dépenses', text: `Vos dépenses ont augmenté de ${pct}% vs le mois dernier (${fmt(totalExpense)} vs ${fmt(prevTotalExpense)}). Revoyez vos catégories.` });
  } else {
    advices.push({ icon: '💡', title: 'Astuce épargne', text: `Pensez à mettre de côté même un petit montant chaque mois. La régularité est la clé de l'épargne réussie !` });
  }

  // Conseil 3 : investissement immobilier
  const monthlyCapacity = Math.max(0, monthSavings);
  advices.push({
    icon: '🏠',
    title: 'Immobilier',
    text: monthlyCapacity > 200
      ? `Avec ${fmt(monthlyCapacity)}/mois d'épargne, vous pourriez rembourser un crédit immobilier. Les taux actuels restent favorables pour un premier achat.`
      : `Constituez d'abord un apport solide. Visez 10-15% du prix du bien. Avec ${fmt(totalSavings)} d'épargne, vous êtes sur la bonne voie.`,
  });

  // Conseil 4 : investissement bourse
  advices.push({
    icon: '📊',
    title: 'Bourse',
    text: totalSavings > 1000
      ? `Avec ${fmt(totalSavings)} d'épargne, diversifiez via un ETF World (frais < 0.3%). Un investissement régulier de ${fmt(Math.round(monthlyCapacity * 0.3))}/mois lisse le risque.`
      : `Commencez la bourse avec un PEA et des ETF diversifiés dès ${fmt(50)}/mois. L'investissement progressif réduit le risque et crée un effet boule de neige.`,
  });

  return advices;
}

const Dashboard = () => {
  const { transactions, budgets, household, getMemberById, getBudgetSpent, getMonthSavings, getTotalSavings, savingsGoals, getGoalSaved, getTransactionsForMonth, currentUser, householdId, accounts } = useApp();
  const { formatAmount, currency } = useCurrency();
  const navigate = useNavigate();
  const [showScan, setShowScan] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [debts, setDebts] = useState<Debt[]>([]);

  // Onboarding: only show on very first login (persisted per user)
  const [showOnboarding, setShowOnboarding] = useState(false);

  React.useEffect(() => {
    if (!currentUser?.id) return;
    const key = `finehome_onboarding_done_${currentUser.id}`;
    if (!localStorage.getItem(key)) {
      setShowOnboarding(true);
    }
  }, [currentUser?.id]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    if (currentUser?.id) {
      localStorage.setItem(`finehome_onboarding_done_${currentUser.id}`, '1');
    }
  };


  // Fetch debts for dashboard card
  const fetchDebts = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase.from('debts').select('*').eq('household_id', householdId);
    if (data) {
      setDebts(data.map((d: any) => ({
        id: d.id, householdId: d.household_id, type: d.type, name: d.name, lender: d.lender,
        initialAmount: Number(d.initial_amount), remainingAmount: Number(d.remaining_amount),
        currency: d.currency, interestRate: Number(d.interest_rate), durationYears: Number(d.duration_years),
        startDate: d.start_date, paymentFrequency: d.payment_frequency, paymentDay: d.payment_day,
        paymentAmount: Number(d.payment_amount), categoryId: d.category_id,
        nextPaymentDate: d.next_payment_date, lastPaymentDate: d.last_payment_date,
        createdAt: d.created_at, updatedAt: d.updated_at,
      })));
    }
  }, [householdId]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const now = new Date();
  const monthTx = useMemo(() => getTransactionsForMonth(now), [getTransactionsForMonth]);

  // Comptes épargne
  const epargneAccountIds = new Set(accounts.filter(a => a.type === 'epargne').map(a => a.id));
  const epargneIn = monthTx.filter(t => t.type === 'income' && t.accountId && epargneAccountIds.has(t.accountId)).reduce((s, t) => s + t.convertedAmount, 0);
  const epargneOut = monthTx.filter(t => t.type === 'expense' && t.accountId && epargneAccountIds.has(t.accountId)).reduce((s, t) => s + t.convertedAmount, 0);

  // Revenus/dépenses hors transferts et hors comptes épargne
  const totalIncome = monthTx.filter(t => t.type === 'income' && t.category !== 'Transfert' && !(t.accountId && epargneAccountIds.has(t.accountId))).reduce((s, t) => s + t.convertedAmount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense' && t.category !== 'Transfert' && !(t.accountId && epargneAccountIds.has(t.accountId))).reduce((s, t) => s + t.convertedAmount, 0);
  const monthSavings = getMonthSavings(now);
  const totalSavings = getTotalSavings();
  const balance = totalIncome - totalExpense - monthSavings;

  const prevMonth = new Date(now);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevTx = useMemo(() => getTransactionsForMonth(prevMonth), [getTransactionsForMonth]);
  const prevExpense = prevTx.filter(t => t.type === 'expense' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);

  const budgetData = budgets.filter(b => b.period === 'monthly').map(b => ({
    ...b,
    spent: getBudgetSpent(b),
  }));

  const goalsData = savingsGoals.map(g => ({ ...g, saved: getGoalSaved(g.id) }));

  const aiAdvices = useMemo(() => generateAIAdvices(budgetData, totalExpense, prevExpense, monthSavings, totalSavings, goalsData, currency), [budgetData, totalExpense, prevExpense, monthSavings, totalSavings, goalsData, currency]);
  const [adviceIndex, setAdviceIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setAdviceIndex(i => (i + 1) % aiAdvices.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [aiAdvices.length]);

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
            {household?.name && <p className="text-sm text-muted-foreground">{household.name}</p>}
          </div>
          <button onClick={() => navigate('/profile')} className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
            {currentUser ? getInitials(currentUser.name) : '?'}
          </button>
        </motion.div>

        {/* Balance card */}
        <motion.div variants={fadeUp} className="bg-primary rounded-3xl p-6 text-primary-foreground shadow-card-lg">
          <p className="text-primary-foreground/70 text-sm font-medium mb-1">Solde disponible (mois en cours)</p>
          <p className="text-3xl font-bold font-mono-amount tracking-tight">{balance >= 0 ? '+ ' : '- '}{formatAmount(balance)}</p>
          <div className="flex items-center gap-2 sm:gap-3 mt-4">
            <div className="flex-1 bg-primary-foreground/10 rounded-2xl p-2 sm:p-3 text-center">
              <p className="text-primary-foreground/60 text-[10px] sm:text-xs mb-0.5">Revenus</p>
              <p className="font-semibold font-mono-amount text-xs sm:text-sm whitespace-nowrap">+{formatAmount(totalIncome)}</p>
            </div>
            <div className="flex-1 bg-primary-foreground/10 rounded-2xl p-2 sm:p-3 text-center">
              <p className="text-primary-foreground/60 text-[10px] sm:text-xs mb-0.5">Dépenses</p>
              <p className="font-semibold font-mono-amount text-xs sm:text-sm whitespace-nowrap">-{formatAmount(totalExpense)}</p>
            </div>
            <div className="flex-1 bg-primary-foreground/10 rounded-2xl p-2 sm:p-3 text-center">
              <p className="text-primary-foreground/60 text-[10px] sm:text-xs mb-0.5">Enveloppes</p>
              <p className="font-semibold font-mono-amount text-xs sm:text-sm whitespace-nowrap">{formatAmount(monthSavings)}</p>
            </div>
          </div>
          {(epargneIn > 0 || epargneOut > 0) && (
            <div className="flex items-center gap-2 sm:gap-3 mt-2">
              <div className="flex-1 bg-primary-foreground/10 rounded-2xl p-2 sm:p-3 text-center">
                <p className="text-primary-foreground/60 text-[10px] sm:text-xs mb-0.5">🐖 Épargne</p>
                <p className="font-semibold font-mono-amount text-xs sm:text-sm whitespace-nowrap">+{formatAmount(epargneIn)}</p>
              </div>
              <div className="flex-1 bg-primary-foreground/10 rounded-2xl p-2 sm:p-3 text-center">
                <p className="text-primary-foreground/60 text-[10px] sm:text-xs mb-0.5">🐖 Dép. épargne</p>
                <p className="font-semibold font-mono-amount text-xs sm:text-sm whitespace-nowrap">-{formatAmount(epargneOut)}</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* AI Insight Carousel */}
        <motion.div variants={fadeUp} className="card-elevated p-4 overflow-hidden">
          <div className="relative min-h-[72px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={adviceIndex}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{aiAdvices[adviceIndex].icon}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-0.5">{aiAdvices[adviceIndex].title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{aiAdvices[adviceIndex].text}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {aiAdvices.map((_, i) => (
              <button
                key={i}
                onClick={() => setAdviceIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === adviceIndex ? 'bg-primary w-4' : 'bg-muted-foreground/30'}`}
              />
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={fadeUp}>
          <h2 className="font-semibold text-base mb-3">Actions rapides</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onClick={() => navigate('/start-of-month')} className="card-elevated p-4 flex flex-col items-center gap-2 card-hover text-center">
              <div className="w-11 h-11 rounded-2xl bg-accent/10 flex items-center justify-center">
                <span className="text-xl">🗓️</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Préparer mon mois</p>
                <p className="text-xs text-muted-foreground">Checklist guidée</p>
              </div>
            </button>
            <button onClick={() => navigate('/chat')} className="card-elevated p-4 flex flex-col items-center gap-2 card-hover text-center">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="text-xl">✨</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Conseiller IA</p>
                <p className="text-xs text-muted-foreground">Chat personnalisé</p>
              </div>
            </button>
            <button onClick={() => setShowScan(true)} className="card-elevated p-4 flex flex-col items-center gap-2 card-hover text-center">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="text-xl">📸</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Scanner ticket</p>
                <p className="text-xs text-muted-foreground">Ajouter via photo</p>
              </div>
            </button>
            <button onClick={() => setShowReport(true)} className="card-elevated p-4 flex flex-col items-center gap-2 card-hover text-center relative">
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

        <div className="grid md:grid-cols-5 gap-6">
          {/* Transactions */}
          <motion.div variants={fadeUp} className="md:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">Transactions récentes</h2>
              <button onClick={() => navigate('/transactions')} className="text-sm text-primary font-medium hover:underline">Voir tout</button>
            </div>
            <div className="card-elevated divide-y divide-border/50 overflow-hidden">
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-lg">{t.emoji}</div>
                    <div>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.category} · {formatDate(t.date)}</p>
                    </div>
                  </div>
                  <ConvertedAmount transaction={t} />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right sidebar */}
          <motion.div variants={fadeUp} className="md:col-span-2 space-y-6">
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
                <h2 className="font-semibold text-base">Enveloppes</h2>
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

            {/* Debts */}
            {debts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-base">Dettes</h2>
                  <button onClick={() => navigate('/debts')} className="text-sm text-primary font-medium hover:underline">Voir</button>
                </div>
                <div className="card-elevated p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total restant dû</span>
                    <span className="font-mono-amount font-semibold text-destructive">{formatAmount(debts.reduce((s, d) => s + d.remainingAmount, 0))}</span>
                  </div>
                  {(() => {
                    const nextPayments = debts
                      .filter(d => d.remainingAmount > 0)
                      .map(d => ({ date: d.nextPaymentDate || calculateNextPaymentDate(d), amount: d.paymentAmount, name: d.name, emoji: getDebtEmoji(d.type) }))
                      .filter(p => p.date)
                      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                    const next = nextPayments[0];
                    if (!next) return null;
                    return (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{next.emoji} {next.name}</span>
                        <span className="font-mono-amount text-xs">{formatAmount(next.amount)} · {formatDate(next.date!)}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>

      <ScanTicketModal open={showScan} onClose={() => setShowScan(false)} />
      <MonthlyReportModal open={showReport} onClose={() => setShowReport(false)} />
      <OnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
    </Layout>
  );
};

export default Dashboard;
