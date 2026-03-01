import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatAmount as rawFormatAmount, formatDate, getBudgetStatus, getInitials } from '@/utils/format';
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
import { useSubscription } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PremiumPaywall';
import { TrendingUp, TrendingDown, Target, Wallet, PiggyBank, CreditCard, Calendar, Sparkles, Camera, BarChart3, ArrowRight, ChevronRight, ChevronDown, Lock, HeartPulse } from 'lucide-react';
import HealthScoreGauge from '@/components/HealthScoreGauge';
import { useHealthScore, useSaveHealthScore, useHealthScoreHistory } from '@/hooks/useHealthScore';

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
  if (monthSavings > 0) {
    advices.push({ icon: '🎉', title: 'Épargne du mois', text: `Vous avez mis de côté ${fmt(monthSavings)} ce mois-ci, pour un total de ${fmt(totalSavings)}. Continuez sur cette lancée !` });
  } else if (prevTotalExpense > 0 && totalExpense > prevTotalExpense) {
    const pct = Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100);
    advices.push({ icon: '📈', title: 'Tendance dépenses', text: `Vos dépenses ont augmenté de ${pct}% vs le mois dernier (${fmt(totalExpense)} vs ${fmt(prevTotalExpense)}). Revoyez vos catégories.` });
  } else {
    advices.push({ icon: '💡', title: 'Astuce épargne', text: `Pensez à mettre de côté même un petit montant chaque mois. La régularité est la clé de l'épargne réussie !` });
  }
  return advices;
}

const Dashboard = () => {
  const { scopedTransactions: transactions, scopedBudgets: budgets, household, getMemberById, getBudgetSpent, getMonthSavings, getTotalSavings, scopedSavingsGoals: savingsGoals, getGoalSaved, getTransactionsForMonth, currentUser, householdId, scopedAccounts: accounts, financeScope, session } = useApp();
  const { formatAmount, currency } = useCurrency();
  const navigate = useNavigate();
  const [showScan, setShowScan] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<{ feature: string; description: string } | null>(null);
  const { isPremium, loading: subLoading } = useSubscription();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [balanceExpanded, setBalanceExpanded] = useState(false);

  React.useEffect(() => {
    if (!currentUser?.id) return;
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_done')
        .eq('id', currentUser.id)
        .single();
      if (data && !data.onboarding_done) {
        setShowOnboarding(true);
      }
    };
    checkOnboarding();
  }, [currentUser?.id]);

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (currentUser?.id) {
      await supabase
        .from('profiles')
        .update({ onboarding_done: true } as any)
        .eq('id', currentUser.id);
    }
  };

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

  const now = new Date();
  const monthTx = useMemo(() => getTransactionsForMonth(now), [getTransactionsForMonth]);

  const epargneAccountIds = new Set(accounts.filter(a => a.type === 'epargne' || a.type === 'pilier3a').map(a => a.id));
  const isEpargneTx = (t: typeof monthTx[0]) => !!(t.accountId && epargneAccountIds.has(t.accountId));

  // Identify transfer IDs linked to savings accounts
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

  // Épargne: transferts entrants + revenus directs - transferts sortants - dépenses directes
  const epargneTransferIn = monthTx.filter(t => t.type === 'income' && isEpargneTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneTransferOut = monthTx.filter(t => t.type === 'expense' && isEpargneTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneDirectIn = monthTx.filter(t => t.type === 'income' && isEpargneTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneDirectOut = monthTx.filter(t => t.type === 'expense' && isEpargneTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const epargneIn = epargneTransferIn + epargneDirectIn;
  const epargneOut = epargneTransferOut + epargneDirectOut;
  const monthSavingsNet = epargneIn - epargneOut;

  const totalIncome = monthTx.filter(t => t.type === 'income' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const totalExpense = monthTx.filter(t => t.type === 'expense' && !isAnySavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const monthSavings = monthSavingsNet;
  const totalSavings = getTotalSavings();
  const balance = totalIncome - totalExpense - monthSavingsNet;

  const prevMonth = new Date(now);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevTx = useMemo(() => getTransactionsForMonth(prevMonth), [getTransactionsForMonth]);
  const prevExpense = prevTx.filter(t => t.type === 'expense' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);

  const budgetData = budgets.filter(b => b.period === 'monthly').map(b => ({ ...b, spent: getBudgetSpent(b) }));
  const goalsData = savingsGoals.map(g => ({ ...g, saved: getGoalSaved(g.id) }));

  const aiAdvices = useMemo(() => generateAIAdvices(budgetData, totalExpense, prevExpense, monthSavings, totalSavings, goalsData, currency), [budgetData, totalExpense, prevExpense, monthSavings, totalSavings, goalsData, currency]);
  const [adviceIndex, setAdviceIndex] = useState(0);
  const healthScore = useHealthScore();
  useSaveHealthScore(healthScore.totalScore, householdId);

  useEffect(() => {
    const timer = setInterval(() => setAdviceIndex(i => (i + 1) % aiAdvices.length), 6000);
    return () => clearInterval(timer);
  }, [aiAdvices.length]);

  const fade = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

  return (
    <Layout>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 via-transparent to-transparent h-64" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="relative space-y-6">
        {/* Header */}
        <motion.div variants={fade}>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="text-lg font-semibold tracking-tight">Bonjour, {currentUser?.name || 'Utilisateur'} 👋</h1>
        </motion.div>

        {/* Balance card */}
        <motion.div variants={fade} className="bg-gradient-to-br from-primary/10 via-card to-card border border-primary/15 rounded-2xl p-5">
          <button onClick={() => setBalanceExpanded(!balanceExpanded)} className="w-full text-left">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs mb-1">Solde du mois</p>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${balanceExpanded ? 'rotate-180' : ''}`} />
            </div>
            <div className="flex items-center gap-2">
              <p className={`text-3xl font-semibold font-mono-amount tracking-tight ${balance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                {balance >= 0 ? '+' : '-'}{formatAmount(Math.abs(balance))}
              </p>
              {monthSavings < 0 && (
                <span className="text-amber-500 text-lg" title="Épargne négative">⚠️</span>
              )}
            </div>
          </button>
          <AnimatePresence>
            {balanceExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs flex items-center gap-1.5">💰 Revenus</span>
                    <span className="font-mono-amount text-xs font-semibold text-success">+{formatAmount(totalIncome)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs flex items-center gap-1.5">💸 Dépenses</span>
                    <span className="font-mono-amount text-xs font-semibold text-destructive">-{formatAmount(totalExpense)}</span>
                  </div>
                  {monthSavingsNet !== 0 && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs flex items-center gap-1.5">🏦 Épargne nette</span>
                      <span className={`font-mono-amount text-xs font-semibold ${monthSavingsNet > 0 ? 'text-amber-500' : 'text-success'}`}>
                        {monthSavingsNet > 0 ? '-' : '+'}{formatAmount(Math.abs(monthSavingsNet))}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-border">
                    <span className="text-xs font-bold">Solde</span>
                    <span className={`font-mono-amount text-xs font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {balance >= 0 ? '+' : ''}{formatAmount(balance)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {monthSavings < 0 && (
            <button
              onClick={() => navigate('/transactions')}
              className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <span>⚠️</span>
              <span>Vous puisez dans vos économies ce mois-ci. Pensez à faire un transfert vers votre épargne.</span>
              <ArrowRight className="w-3 h-3 flex-shrink-0" />
            </button>
          )}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-[11px] text-muted-foreground">Revenus</span>
              </div>
              <p className="font-mono-amount text-sm font-medium">+{formatAmount(totalIncome)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                <span className="text-[11px] text-muted-foreground">Dépenses</span>
              </div>
              <p className="font-mono-amount text-sm font-medium">-{formatAmount(totalExpense)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[11px] text-muted-foreground">Épargne</span>
              </div>
              <p className="font-mono-amount text-sm font-medium">{monthSavings >= 0 ? '' : '-'}{formatAmount(Math.abs(monthSavings))}</p>
            </div>
          </div>
        </motion.div>

        {/* Health Score + Quick Actions — side by side on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Health Score Widget */}
          <motion.div
            variants={fade}
            className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:bg-muted/30 transition-colors md:flex md:flex-col"
            onClick={() => navigate('/health-score')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Santé Financière</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex justify-center md:flex-1 md:items-center">
              <HealthScoreGauge
                score={healthScore.totalScore}
                label={healthScore.label}
                color={healthScore.color}
                diff={healthScore.diff}
                compact
              />
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={fade} className="grid grid-cols-2 gap-2 md:auto-rows-fr">
            {[
              { icon: Calendar, label: 'Préparer', onClick: () => navigate('/start-of-month') },
              { icon: Sparkles, label: 'Coach IA', onClick: () => isPremium ? navigate('/chat') : setPaywallFeature({ feature: 'le Coach IA', description: 'Accédez à votre coach financier personnel propulsé par l\'IA pour des conseils adaptés à votre situation.' }), locked: !subLoading && !isPremium },
              { icon: Camera, label: 'Scanner', onClick: () => setShowScan(true) },
              { icon: BarChart3, label: 'Rapport', onClick: () => isPremium ? setShowReport(true) : setPaywallFeature({ feature: 'le rapport mensuel', description: 'Obtenez un rapport détaillé de vos finances chaque mois avec des conseils personnalisés.' }), locked: !subLoading && !isPremium },
            ].map((item: any, i: number) => (
              <button key={i} onClick={item.onClick} className="bg-card border border-border rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors active:scale-95 relative">
                {item.locked && <Lock className="w-3 h-3 text-amber-500 absolute top-1.5 right-1.5" />}
                <item.icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </button>
            ))}
          </motion.div>
        </div>

        {/* AI Insight */}
        <motion.div variants={fade} className="bg-card border border-border rounded-xl p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={adviceIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-3"
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{aiAdvices[adviceIndex].icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs mb-0.5">{aiAdvices[adviceIndex].title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{aiAdvices[adviceIndex].text}</p>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center justify-center gap-1 mt-3">
            {aiAdvices.map((_, i) => (
              <button
                key={i}
                onClick={() => setAdviceIndex(i)}
                className={`h-1 rounded-full transition-all duration-300 ${i === adviceIndex ? 'bg-primary w-4' : 'bg-border w-1'}`}
              />
            ))}
          </div>
        </motion.div>

        {/* Content grid */}
        <div className="grid md:grid-cols-5 gap-5">
          {/* Transactions */}
          <motion.div variants={fade} className="md:col-span-3">
            <SectionHeader title="Transactions récentes" action="Voir tout" onAction={() => navigate('/transactions')} />
            <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0">{t.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground">{t.category} · {formatDate(t.date)}</p>
                    </div>
                  </div>
                  <ConvertedAmount transaction={t} />
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune transaction</div>
              )}
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.div variants={fade} className="md:col-span-2 space-y-5">
            {/* Budgets */}
            <div>
              <SectionHeader title="Budgets" action="Voir" onAction={() => navigate('/budgets')} />
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                {budgetData.slice(0, 4).map(b => {
                  const status = getBudgetStatus(b.spent, b.limit);
                  const pct = Math.min((b.spent / b.limit) * 100, 100);
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{b.emoji} {b.category}</span>
                        <span className="font-mono-amount text-muted-foreground">{formatAmount(b.spent)} / {formatAmount(b.limit)}</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${status === 'ok' ? 'bg-success' : status === 'warning' ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {budgetData.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Aucun budget</p>}
              </div>
            </div>

            {/* Savings */}
            <div>
              <SectionHeader title="Épargne" action="Voir" onAction={() => navigate('/savings')} />
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                {goalsData.slice(0, 3).map(g => {
                  const pct = Math.min((g.saved / g.target) * 100, 100);
                  return (
                    <div key={g.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{g.emoji} {g.name}</span>
                        <span className="font-mono-amount text-primary font-medium">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {goalsData.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Aucun objectif d'épargne</p>}
              </div>
            </div>

            {/* Debts */}
            {debts.length > 0 && (
              <div>
                <SectionHeader title="Dettes" action="Voir" onAction={() => navigate('/debts')} />
                <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total restant dû</span>
                    <span className="font-mono-amount font-medium text-destructive">{formatAmount(debts.reduce((s, d) => s + d.remainingAmount, 0))}</span>
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
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{next.emoji} {next.name}</span>
                        <span className="font-mono-amount">{formatAmount(next.amount)} · {formatDate(next.date!)}</span>
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
      <PaywallModal open={!!paywallFeature} onClose={() => setPaywallFeature(null)} feature={paywallFeature?.feature || ''} description={paywallFeature?.description} />
    </Layout>
  );
};

const SectionHeader = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <div className="flex items-center justify-between mb-2">
    <h2 className="text-sm font-semibold">{title}</h2>
    {action && onAction && (
      <button onClick={onAction} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
        {action} <ChevronRight className="w-3 h-3" />
      </button>
    )}
  </div>
);

export default Dashboard;
