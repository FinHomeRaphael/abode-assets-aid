import React, { useState, useMemo } from 'react';
import { formatLocalDate } from '@/utils/format';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumModal from '@/components/PremiumModal';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ===== Helpers =====

function getMonthRange(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return { start: formatLocalDate(new Date(y, m, 1)), end: formatLocalDate(new Date(y, m + 1, 0)) };
}

function getMonthYearStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date);
}

const Insights = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [chartRange, setChartRange] = useState<6 | 12>(12);
  const { transactions, budgets, savingsGoals, savingsDeposits, getTransactionsForMonth, getBudgetsForMonth, getBudgetSpent, getGoalSaved, householdId, currentUser } = useApp();
  const { formatAmount } = useCurrency();
  const { isPremium, presentOffering } = useSubscription(householdId, currentUser?.id);
  const [showPremium, setShowPremium] = useState(false);

  // Current month transactions
  const monthTx = useMemo(() => getTransactionsForMonth(currentMonth), [currentMonth, getTransactionsForMonth]);
  const expenses = useMemo(() => monthTx.filter(t => t.type === 'expense'), [monthTx]);
  const incomes = useMemo(() => monthTx.filter(t => t.type === 'income'), [monthTx]);
  const totalExpenses = useMemo(() => expenses.reduce((s, t) => s + t.convertedAmount, 0), [expenses]);
  const totalIncome = useMemo(() => incomes.reduce((s, t) => s + t.convertedAmount, 0), [incomes]);

  // Month budgets
  const monthBudgets = useMemo(() => getBudgetsForMonth(currentMonth), [currentMonth, getBudgetsForMonth]);

  // Previous 3 months transactions for averages
  const prev3MonthsAvg = useMemo(() => {
    const avgs: Record<string, number> = {};
    for (let i = 1; i <= 3; i++) {
      const d = new Date(currentMonth);
      d.setMonth(d.getMonth() - i);
      const tx = getTransactionsForMonth(d).filter(t => t.type === 'expense');
      tx.forEach(t => { avgs[t.category] = (avgs[t.category] || 0) + t.convertedAmount; });
    }
    Object.keys(avgs).forEach(k => { avgs[k] /= 3; });
    return avgs;
  }, [currentMonth, getTransactionsForMonth]);

  // Category spending
  const categorySpending = useMemo(() => {
    const map: Record<string, { amount: number; emoji: string }> = {};
    expenses.forEach(t => {
      if (!map[t.category]) map[t.category] = { amount: 0, emoji: t.emoji };
      map[t.category].amount += t.convertedAmount;
    });
    return Object.entries(map).sort((a, b) => b[1].amount - a[1].amount);
  }, [expenses]);

  // Savings this month
  const monthSavings = useMemo(() => {
    const range = getMonthRange(currentMonth);
    return savingsDeposits.filter(d => d.date >= range.start && d.date <= range.end).reduce((s, d) => s + d.amount, 0);
  }, [currentMonth, savingsDeposits]);

  // Debt payments this month
  const debtPayments = useMemo(() => {
    return expenses.filter(t => t.debtId && t.debtPaymentType === 'principal');
  }, [expenses]);

  // Recurring small expenses (leaks)
  const leaks = useMemo(() => {
    const keywords = ['café', 'coffee', 'starbucks', 'boulangerie', 'uber', 'snack', 'mcdonald', 'subway', 'deliveroo', 'uber eats'];
    const small = expenses.filter(t => t.convertedAmount < 20);
    const groups: Record<string, { count: number; total: number; label: string }> = {};
    small.forEach(t => {
      const key = t.label.toLowerCase().trim();
      const match = keywords.find(k => key.includes(k)) || key;
      if (!groups[match]) groups[match] = { count: 0, total: 0, label: t.label };
      groups[match].count++;
      groups[match].total += t.convertedAmount;
    });
    return Object.values(groups).filter(g => g.count >= 5).sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Chart data (6 rolling months or full calendar year)
  const chartData = useMemo(() => {
    const data: { month: string; total: number; date: Date }[] = [];
    if (chartRange === 12) {
      const year = currentMonth.getFullYear();
      for (let m = 0; m < 12; m++) {
        const d = new Date(year, m, 1);
        const tx = getTransactionsForMonth(d).filter(t => t.type === 'expense');
        const total = tx.reduce((s, t) => s + t.convertedAmount, 0);
        data.push({ month: monthLabel(d), total, date: d });
      }
    } else {
      for (let i = chartRange - 1; i >= 0; i--) {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - i);
        const tx = getTransactionsForMonth(d).filter(t => t.type === 'expense');
        const total = tx.reduce((s, t) => s + t.convertedAmount, 0);
        data.push({ month: monthLabel(d), total, date: d });
      }
    }
    return data;
  }, [currentMonth, chartRange, getTransactionsForMonth]);

  const chartAvg = useMemo(() => {
    const totals = chartData.map(d => d.total);
    return totals.reduce((s, v) => s + v, 0) / Math.max(totals.length, 1);
  }, [chartData]);

  // Has enough data?
  const hasData = transactions.length >= 3;

  // Key facts
  const keyFacts = useMemo(() => {
    if (!hasData) return [];
    const facts: { icon: string; text: string; priority: number }[] = [];
    monthBudgets.forEach(b => {
      const spent = getBudgetSpent(b, currentMonth);
      if (spent > b.limit) {
        facts.push({ icon: '⚠️', text: `Tu as dépassé ton budget ${b.category} de ${formatAmount(spent - b.limit)}.`, priority: 1 });
      }
    });
    if (monthBudgets.length > 0 && facts.filter(f => f.icon === '⚠️').length === 0) {
      facts.push({ icon: '✅', text: 'Bravo ! Tu as respecté tous tes budgets ce mois.', priority: 2 });
    }
    categorySpending.slice(0, 3).forEach(([cat, { amount }]) => {
      const avg = prev3MonthsAvg[cat];
      if (avg && avg > 0) {
        const diff = ((amount - avg) / avg) * 100;
        if (Math.abs(diff) > 15) {
          facts.push({ icon: diff > 0 ? '📈' : '📉', text: `Tu as dépensé ${Math.abs(Math.round(diff))}% ${diff > 0 ? 'de plus' : 'de moins'} en ${cat} que ta moyenne.`, priority: diff > 0 ? 1.5 : 2.5 });
        }
      }
    });
    const fixedCategories = ['Logement', 'Abonnements', 'Impôts'];
    const fixedTotal = expenses.filter(t => fixedCategories.includes(t.category)).reduce((s, t) => s + t.convertedAmount, 0);
    if (totalIncome > 0) {
      const ratio = Math.round((fixedTotal / totalIncome) * 100);
      facts.push({ icon: '🏠', text: `Tes charges fixes représentent ${ratio}% de tes revenus.`, priority: 3 });
    }
    if (monthSavings > 0 && totalIncome > 0) {
      const pct = Math.round((monthSavings / totalIncome) * 100);
      facts.push({ icon: '🐷', text: `Tu as épargné ${formatAmount(monthSavings)}, soit ${pct}% de ton revenu.`, priority: 2.5 });
    }
    debtPayments.forEach(t => {
      facts.push({ icon: '🏦', text: `Tu as remboursé ${formatAmount(t.convertedAmount)} de capital sur "${t.label.replace('Amortissement - ', '')}".`, priority: 3 });
    });
    savingsGoals.forEach(g => {
      const saved = getGoalSaved(g.id);
      const pct = Math.round((saved / g.target) * 100);
      if (pct > 0) {
        facts.push({ icon: '🎯', text: `Tu as atteint ${pct}% de ton objectif "${g.name}".`, priority: 2.5 });
      }
    });
    return facts.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }, [hasData, monthBudgets, getBudgetSpent, currentMonth, categorySpending, prev3MonthsAvg, expenses, totalIncome, monthSavings, debtPayments, savingsGoals, getGoalSaved, formatAmount]);

  // Recommendations
  const recommendations = useMemo(() => {
    if (!hasData) return [];
    const recs: { icon: string; text: string }[] = [];
    monthBudgets.forEach(b => {
      const spent = getBudgetSpent(b, currentMonth);
      const pct = Math.round((spent / b.limit) * 100);
      if (pct < 40 && pct > 0) {
        recs.push({ icon: '💡', text: `Tu n'as utilisé que ${pct}% de ton budget ${b.category}. Tu pourrais le réduire.` });
      }
    });
    const abos = expenses.filter(t => t.category === 'Abonnements').reduce((s, t) => s + t.convertedAmount, 0);
    if (totalExpenses > 0 && abos > 0) {
      const pct = Math.round((abos / totalExpenses) * 100);
      if (pct > 10) {
        recs.push({ icon: '📱', text: `Tes abonnements représentent ${pct}% de tes dépenses : vérifie si tu les utilises tous.` });
      }
    }
    if (categorySpending.length > 0 && savingsGoals.length > 0) {
      const topCat = categorySpending[0];
      const goal = savingsGoals[0];
      const saved = getGoalSaved(goal.id);
      const remaining = goal.target - saved;
      if (remaining > 0 && topCat[1].amount > 50) {
        const reduction = Math.round(topCat[1].amount * 0.2);
        const monthsGained = remaining > 0 ? Math.round(remaining / reduction) : 0;
        if (monthsGained > 0 && monthsGained < 120) {
          recs.push({ icon: '🎯', text: `Si tu réduis ${topCat[0]} de ${formatAmount(reduction)}/mois, tu atteins "${goal.name}" ${monthsGained} mois plus tôt.` });
        }
      }
    }
    const savingMonths = (() => {
      let count = 0;
      for (let i = 0; i < 6; i++) {
        const d = new Date(currentMonth);
        d.setMonth(d.getMonth() - i);
        const range = getMonthRange(d);
        const hasSaving = savingsDeposits.some(dep => dep.date >= range.start && dep.date <= range.end);
        if (hasSaving) count++;
        else break;
      }
      return count;
    })();
    if (savingMonths >= 2) {
      recs.push({ icon: '✨', text: `Continue comme ça ! Tu épargnes régulièrement depuis ${savingMonths} mois.` });
    }
    return recs.slice(0, 3);
  }, [hasData, monthBudgets, getBudgetSpent, currentMonth, expenses, totalExpenses, categorySpending, savingsGoals, getGoalSaved, savingsDeposits, formatAmount]);

  // PAYWALL for free users
  if (!isPremium) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">💡 Insights</h1>
              <p className="text-sm text-muted-foreground">Comprendre mon argent</p>
            </div>
          </div>

          {/* Blurred preview */}
          <div className="relative">
            <div className="blur-sm pointer-events-none opacity-60 space-y-4">
              <Card className="rounded-[20px]">
                <CardContent className="p-5 space-y-3">
                  <h2 className="text-base font-semibold">Faits marquants</h2>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 text-sm"><span className="text-lg">⚠️</span><span>Données masquées...</span></div>
                    <div className="flex items-start gap-3 text-sm"><span className="text-lg">📈</span><span>Données masquées...</span></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-[20px]">
                <CardContent className="p-5 h-48 bg-muted/30" />
              </Card>
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4 bg-card/95 backdrop-blur-sm rounded-2xl p-8 shadow-lg max-w-sm">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-3xl">🔒</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Fonctionnalité Premium</h3>
                  <p className="text-sm text-muted-foreground mt-1">Débloquez l'analyse comportementale de vos finances</p>
                </div>
                <button
                  onClick={() => setShowPremium(true)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
                >
                  ⭐ Débloquer Insights
                </button>
              </div>
            </div>
          </div>
        </div>
        <PremiumModal open={showPremium} onClose={() => setShowPremium(false)} presentOffering={presentOffering} />
      </Layout>
    );
  }

  if (!hasData) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-6xl mb-4">🔍</span>
          <h2 className="text-xl font-bold text-foreground mb-2">Pas encore assez de données</h2>
          <p className="text-muted-foreground max-w-sm">Continue à enregistrer tes transactions pour générer des insights personnalisés !</p>
        </div>
      </Layout>
    );
  }

  const top3 = categorySpending.slice(0, 3);
  const currentMonthData = chartData[chartData.length - 1];
  const diffPct = chartAvg > 0 ? Math.round(((currentMonthData.total - chartAvg) / chartAvg) * 100) : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">💡 Insights</h1>
            <p className="text-sm text-muted-foreground">Comprendre mon argent</p>
          </div>
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

        {/* BLOC 1: Key Facts */}
        <Card className="rounded-[20px]">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">Faits marquants</h2>
            {keyFacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas assez de données ce mois pour générer des faits.</p>
            ) : (
              <div className="space-y-2.5">
                {keyFacts.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-lg flex-shrink-0">{f.icon}</span>
                    <span className="text-foreground">{f.text}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* BLOC 2: Top Categories & Leaks */}
        <Card className="rounded-[20px]">
          <CardContent className="p-5 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Top catégories</h2>
            {top3.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune dépense ce mois.</p>
            ) : (
              <div className="space-y-3">
                {top3.map(([cat, { amount, emoji }]) => {
                  const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2"><span>{emoji}</span><span className="font-medium text-foreground">{cat}</span></span>
                        <span className="text-muted-foreground">{formatAmount(amount)} · {pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
            {leaks.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Fuites détectées</h3>
                {leaks.map((l, i) => (
                  <div key={i} className="text-sm space-y-0.5">
                    <p className="text-foreground">☕ {l.count} achats "{l.label}" ce mois = {formatAmount(l.total)}</p>
                    <p className="text-muted-foreground text-xs">→ Si tu continues : {formatAmount(l.total * 12)}/an</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* BLOC 3: Evolution chart */}
        <Card className="rounded-[20px]">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                {chartRange === 12 ? `Dépenses ${currentMonth.getFullYear()}` : 'Évolution des dépenses'}
              </h2>
              <div className="flex items-center bg-muted rounded-xl p-0.5">
                <button
                  onClick={() => setChartRange(6)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${chartRange === 6 ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  6 mois
                </button>
                <button
                  onClick={() => setChartRange(12)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${chartRange === 12 ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  1 an
                </button>
              </div>
            </div>
            <div className={chartRange === 12 ? 'h-56 -mx-2' : 'h-48'}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={chartRange === 12 ? 16 : 32} margin={chartRange === 12 ? { left: 4, right: 4 } : undefined}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: chartRange === 12 ? 10 : 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: number) => [formatAmount(value), 'Dépenses']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.total > chartAvg ? 'hsl(0 70% 55%)' : 'hsl(142 60% 50%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-muted-foreground">
              <span>Moyenne : {formatAmount(chartAvg)}/mois</span>
              <span>
                Ce mois : {formatAmount(currentMonthData.total)}{' '}
                <span className={diffPct > 0 ? 'text-destructive' : 'text-green-600'}>
                  ({diffPct > 0 ? '+' : ''}{diffPct}%)
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* BLOC 4: Recommendations */}
        {recommendations.length > 0 && (
          <Card className="rounded-[20px]">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-base font-semibold text-foreground">Recommandations</h2>
              <div className="space-y-2.5">
                {recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-lg flex-shrink-0">{r.icon}</span>
                    <span className="text-foreground">{r.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <PremiumModal open={showPremium} onClose={() => setShowPremium(false)} presentOffering={presentOffering} />
    </Layout>
  );
};

export default Insights;
