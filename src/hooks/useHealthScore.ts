import { useMemo, useEffect, useCallback, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { formatLocalDate } from '@/utils/format';
import React from 'react';

interface CriterionResult {
  key: string;
  label: string;
  emoji: string;
  score: number;
  maxScore: number;
  description: string;
  details: { label: string; value: string }[];
  formula: string;
}

interface HealthScoreResult {
  totalScore: number;
  criteria: CriterionResult[];
  label: string;
  color: string;
  previousScore: number | null;
  diff: number | null;
  tips: { emoji: string; title: string; text: string }[];
}

function getMonthYearStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function scoreSavingsRate(rate: number): number {
  if (rate >= 20) return 20;
  if (rate >= 15) return 16;
  if (rate >= 10) return 12;
  if (rate >= 5) return 8;
  if (rate >= 1) return 4;
  return 0;
}

function scoreDebtToPatrimony(totalDebts: number, totalPatrimony: number): number {
  if (totalPatrimony <= 0) return 0;
  const ratio = (totalDebts / totalPatrimony) * 100;
  // 25/25 at ≤70%, 15/25 at 80%, 0/25 at ≥90%, linear interpolation
  if (ratio <= 70) return 25;
  if (ratio <= 80) return Math.round(25 - ((ratio - 70) / 10) * 10); // 25→15
  if (ratio < 90) return Math.round(15 - ((ratio - 80) / 10) * 15); // 15→0
  return 0;
}

function scoreEmergencyFund(totalSavings: number, monthlyExpenses: number): number {
  if (monthlyExpenses <= 0) return 20;
  const months = totalSavings / monthlyExpenses;
  if (months >= 6) return 20;       // 100%
  if (months >= 3) return 10;       // 50%
  if (months >= 2) return 6;
  if (months >= 1) return 3;
  return 0;
  return 0;
}


// EU median patrimony ~205,000€ (INSEE 2024)
const EU_MEDIAN_PATRIMONY = 205000;

function scorePatrimony(totalAssets: number, medianRef: number): number {
  if (medianRef <= 0) return 10;
  const pct = (totalAssets / medianRef) * 100;
  if (pct >= 200) return 10;
  if (pct >= 120) return 8;
  if (pct >= 80) return 6;
  if (pct >= 50) return 4;
  if (pct >= 20) return 2;
  return 0;
}


function scoreDebtService(monthlyPayments: number, monthlyIncome: number): number {
  if (monthlyIncome <= 0) return 0;
  const ratio = (monthlyPayments / monthlyIncome) * 100;
  // 15/15 at ≤30%, 7/15 at 35%, linear interpolation between thresholds
  if (ratio <= 30) return 15;
  if (ratio <= 35) return Math.round(15 - ((ratio - 30) / 5) * 8); // 15→7
  if (ratio <= 40) return Math.round(7 - ((ratio - 35) / 5) * 4);  // 7→3
  if (ratio <= 50) return Math.round(3 - ((ratio - 40) / 10) * 3); // 3→0
  return 0;
}



function getScoreLabel(score: number): string {
  if (score <= 25) return 'Critique';
  if (score <= 50) return 'À améliorer';
  if (score <= 70) return 'Correcte';
  if (score <= 85) return 'Bonne';
  return 'Excellente';
}

function getScoreColor(score: number): string {
  if (score <= 25) return 'hsl(0, 84%, 60%)';
  if (score <= 50) return 'hsl(38, 92%, 50%)';
  if (score <= 70) return 'hsl(48, 96%, 53%)';
  if (score <= 85) return 'hsl(160, 84%, 39%)';
  return 'hsl(160, 84%, 29%)';
}

export function useHealthScore(): HealthScoreResult {
  const {
    scopedTransactions: transactions,
    scopedBudgets: budgets,
    scopedSavingsGoals: savingsGoals,
    savingsDeposits,
    scopedAccounts: accounts,
    getTransactionsForMonth,
    getMonthSavings,
    getTotalSavings,
    getAccountBalance,
    household,
    householdId,
    session,
    financeScope,
  } = useApp();

  const now = new Date();

  // Fetch debts from DB (including property_value for patrimony)
  const [debtsData, setDebtsData] = useState<{ remaining_amount: number; payment_amount: number; property_value: number | null; currency: string }[]>([]);

  useEffect(() => {
    if (!householdId) return;
    const userId = session?.user?.id;
    let query = supabase.from('debts').select('remaining_amount, payment_amount, property_value, currency');
    if (financeScope === 'personal') {
      query = query.eq('scope', 'personal').eq('created_by', userId);
    } else {
      query = query.eq('household_id', householdId).eq('scope', 'household');
    }
    query.then(({ data }) => {
      if (data) setDebtsData(data.map(d => ({ remaining_amount: Number(d.remaining_amount), payment_amount: Number(d.payment_amount), property_value: d.property_value ? Number(d.property_value) : null, currency: d.currency })));
    });
  }, [householdId, financeScope, session?.user?.id]);

  return useMemo(() => {
    const monthTx = getTransactionsForMonth(now);
    const epargneAccountIds = new Set(accounts.filter(a => a.type === 'epargne').map(a => a.id));

    // Monthly income (exclude savings accounts & transfers)
    const monthlyIncome = monthTx
      .filter(t => t.type === 'income' && t.category !== 'Transfert' && !(t.accountId && epargneAccountIds.has(t.accountId)))
      .reduce((s, t) => s + t.convertedAmount, 0);

    // Monthly expenses (exclude savings accounts & transfers)
    const monthlyExpenses = monthTx
      .filter(t => t.type === 'expense' && t.category !== 'Transfert' && !(t.accountId && epargneAccountIds.has(t.accountId)))
      .reduce((s, t) => s + t.convertedAmount, 0);

    const monthSavings = getMonthSavings(now);
    const totalSavings = getTotalSavings();

    // Savings rate
    const savingsRatePercent = monthlyIncome > 0 ? (monthSavings / monthlyIncome) * 100 : 0;

    // Debts from DB
    const hasDebts = debtsData.length > 0;
    const totalDebtRemaining = debtsData.reduce((s, d) => s + d.remaining_amount, 0);
    const monthlyDebtPayments = debtsData.reduce((s, d) => s + d.payment_amount, 0);

    // Annual income estimate
    const annualIncome = monthlyIncome * 12;



    // Emergency fund months
    const emergencyFundMonths = monthlyExpenses > 0 ? totalSavings / monthlyExpenses : 999;

    // Debt service ratio
    const debtServiceRatio = monthlyIncome > 0 ? (monthlyDebtPayments / monthlyIncome) * 100 : 0;

    // Patrimony: account balances + property values (all converted to base currency)
    const activeAccounts = accounts.filter(a => !a.isArchived);
    const accountsTotal = activeAccounts.reduce((s, a) => {
      const bal = getAccountBalance(a.id);
      return s + bal; // already in convertedAmount via transactions
    }, 0);
    const propertyTotal = debtsData
      .filter(d => d.property_value && d.property_value > 0)
      .reduce((s, d) => s + (d.property_value || 0), 0);
    const totalPatrimony = accountsTotal + propertyTotal;
    const patrimonyPct = EU_MEDIAN_PATRIMONY > 0 ? Math.round((totalPatrimony / EU_MEDIAN_PATRIMONY) * 100) : 0;

    // === Adaptive weights (5 criteria) ===
    const baseWeights: Record<string, number> = {
      savingsRate: 25,
      emergencyFund: 25,
      patrimony: 10,
      debtToIncome: 25,
      debtService: 15,
    };

    let excludedWeight = 0;
    if (!hasDebts) {
      excludedWeight += baseWeights.debtToIncome + baseWeights.debtService;
      baseWeights.debtToIncome = 0;
      baseWeights.debtService = 0;
    }

    const activeKeys = Object.keys(baseWeights).filter(k => baseWeights[k] > 0);
    const redistribution = activeKeys.length > 0 ? excludedWeight / activeKeys.length : 0;
    for (const k of activeKeys) {
      baseWeights[k] += redistribution;
    }

    // Total weight for normalization
    const totalWeight = Object.values(baseWeights).reduce((a, b) => a + b, 0);

    // === Score each criterion (raw scores on base scale) ===
    const rawSavingsRate = scoreSavingsRate(savingsRatePercent);
    const rawDebtToIncome = scoreDebtToPatrimony(totalDebtRemaining, totalPatrimony);
    const rawEmergencyFund = scoreEmergencyFund(totalSavings, monthlyExpenses);
    const rawDebtService = scoreDebtService(monthlyDebtPayments, monthlyIncome);
    const rawPatrimony = scorePatrimony(totalPatrimony, EU_MEDIAN_PATRIMONY);

    // Final total score (normalized to 0-100)
    let totalScore: number;
    if (totalWeight > 0) {
      totalScore = Math.round(
        (rawSavingsRate / 20) * baseWeights.savingsRate +
        (rawDebtToIncome / 25) * baseWeights.debtToIncome +
        (rawEmergencyFund / 20) * baseWeights.emergencyFund +
        (rawDebtService / 15) * baseWeights.debtService +
        (rawPatrimony / 10) * baseWeights.patrimony
      );
    } else {
      totalScore = 50;
    }

    totalScore = Math.max(0, Math.min(100, totalScore));

    // Build criteria list
    const criteria: CriterionResult[] = [];
    const addedMaxScore = (weight: number) => Math.round(weight);

    const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    const cur = household?.currency || 'CHF';

    if (baseWeights.savingsRate > 0) {
      const max = addedMaxScore(baseWeights.savingsRate);
      const sc = Math.round((rawSavingsRate / 20) * max);
      criteria.push({
        key: 'savingsRate', label: 'Taux d\'épargne', emoji: '💰',
        score: sc, maxScore: max,
        description: `${Math.round(savingsRatePercent)}% de tes revenus épargnés`,
        formula: `Épargne du mois ÷ Revenus du mois × 100`,
        details: [
          { label: 'Épargne du mois', value: `${fmt(monthSavings)} ${cur}` },
          { label: 'Revenus du mois', value: `${fmt(monthlyIncome)} ${cur}` },
          { label: 'Taux calculé', value: `${savingsRatePercent.toFixed(1)}%` },
        ],
      });
    }
    if (baseWeights.emergencyFund > 0) {
      const max = addedMaxScore(baseWeights.emergencyFund);
      const sc = Math.round((rawEmergencyFund / 20) * max);
      criteria.push({
        key: 'emergencyFund', label: 'Fonds d\'urgence', emoji: '🚨',
        score: sc, maxScore: max,
        description: `${emergencyFundMonths >= 999 ? '∞' : emergencyFundMonths.toFixed(1)} mois de dépenses de côté`,
        formula: `Épargne totale ÷ Dépenses mensuelles`,
        details: [
          { label: 'Épargne totale', value: `${fmt(totalSavings)} ${cur}` },
          { label: 'Dépenses mensuelles', value: `${fmt(monthlyExpenses)} ${cur}` },
          { label: 'Mois couverts', value: emergencyFundMonths >= 999 ? '∞' : `${emergencyFundMonths.toFixed(1)} mois` },
        ],
      });
    }
    if (baseWeights.debtToIncome > 0) {
      const max = addedMaxScore(baseWeights.debtToIncome);
      const sc = Math.round((rawDebtToIncome / 25) * max);
      const ratio = totalPatrimony > 0 ? Math.round((totalDebtRemaining / totalPatrimony) * 100) : 0;
      criteria.push({
        key: 'debtToIncome', label: 'Ratio dettes/patrimoine', emoji: '📊',
        score: sc, maxScore: max,
        description: `${ratio}% de ton patrimoine total`,
        formula: `Dettes restantes ÷ Patrimoine total × 100`,
        details: [
          { label: 'Dettes restantes', value: `${fmt(totalDebtRemaining)} ${cur}` },
          { label: 'Patrimoine total', value: `${fmt(totalPatrimony)} ${cur}` },
          { label: 'Ratio calculé', value: `${ratio}%` },
        ],
      });
    }
    if (baseWeights.debtService > 0) {
      const max = addedMaxScore(baseWeights.debtService);
      const sc = Math.round((rawDebtService / 15) * max);
      criteria.push({
        key: 'debtService', label: 'Taux d\'endettement', emoji: '💳',
        score: sc, maxScore: max,
        description: `${Math.round(debtServiceRatio)}% de tes revenus mensuels`,
        formula: `Mensualités dettes ÷ Revenus mensuels × 100`,
        details: [
          { label: 'Mensualités de dettes', value: `${fmt(monthlyDebtPayments)} ${cur}` },
          { label: 'Revenus mensuels', value: `${fmt(monthlyIncome)} ${cur}` },
          { label: 'Ratio calculé', value: `${Math.round(debtServiceRatio)}%` },
        ],
      });
    }
    if (baseWeights.patrimony > 0) {
      const max = addedMaxScore(baseWeights.patrimony);
      const sc = Math.round((rawPatrimony / 10) * max);
      let compLabel: string;
      if (patrimonyPct >= 200) compLabel = 'Bien au-dessus de la médiane';
      else if (patrimonyPct >= 120) compLabel = 'Au-dessus de la médiane';
      else if (patrimonyPct >= 80) compLabel = 'Dans la moyenne européenne';
      else if (patrimonyPct >= 50) compLabel = 'En-dessous de la médiane';
      else compLabel = 'Bien en-dessous de la médiane';
      criteria.push({
        key: 'patrimony', label: 'Patrimoine total', emoji: '🏛️',
        score: sc, maxScore: max,
        description: `${patrimonyPct}% de la médiane européenne – ${compLabel}`,
        formula: `(Comptes bancaires + Biens immobiliers) ÷ Médiane européenne × 100`,
        details: [
          { label: 'Solde comptes', value: `${fmt(accountsTotal)} ${cur}` },
          { label: 'Immobilier', value: `${fmt(propertyTotal)} ${cur}` },
          { label: 'Patrimoine total', value: `${fmt(totalPatrimony)} ${cur}` },
          { label: 'Médiane européenne', value: `${fmt(EU_MEDIAN_PATRIMONY)} EUR` },
          { label: 'Position', value: `${patrimonyPct}%` },
        ],
      });
    }

    // Sort criteria by score/maxScore ratio ascending (weakest first for tips)
    const sortedForTips = [...criteria].sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore));

    // Generate tips
    const tips: { emoji: string; title: string; text: string }[] = [];
    for (const c of sortedForTips) {
      if (tips.length >= 2) break;
      const ratio = c.maxScore > 0 ? c.score / c.maxScore : 1;
      if (ratio >= 0.9) continue;

      if (c.key === 'savingsRate') {
        const nextThreshold = savingsRatePercent < 5 ? 5 : savingsRatePercent < 10 ? 10 : savingsRatePercent < 15 ? 15 : 20;
        tips.push({
          emoji: '💰', title: 'Booste ton épargne',
          text: `Passe de ${Math.round(savingsRatePercent)}% à ${nextThreshold}% d'épargne pour gagner des points supplémentaires.`,
        });
      } else if (c.key === 'emergencyFund') {
        const target = emergencyFundMonths < 1 ? 1 : emergencyFundMonths < 2 ? 2 : emergencyFundMonths < 3 ? 3 : 6;
        tips.push({
          emoji: '🚨', title: 'Augmente ton fonds d\'urgence',
          text: `Tu as ${emergencyFundMonths >= 999 ? '∞' : emergencyFundMonths.toFixed(1)} mois de côté. Vise ${target} mois minimum.`,
        });
      } else if (c.key === 'patrimony') {
        tips.push({
          emoji: '🏛️', title: 'Construis ton patrimoine',
          text: `Ton patrimoine représente ${patrimonyPct}% de la médiane européenne (205 000€). Continue à épargner et investir.`,
        });
      } else if (c.key === 'debtService') {
        tips.push({
          emoji: '💳', title: 'Réduis ton taux d\'endettement',
          text: `Tes mensualités représentent ${Math.round(debtServiceRatio)}% de tes revenus. Vise moins de 33%.`,
        });
      } else if (c.key === 'debtToIncome') {
        tips.push({
          emoji: '📊', title: 'Rembourse tes dettes',
          text: `Ton ratio dette/revenus est élevé. Concentre-toi sur le remboursement pour améliorer ton score.`,
        });
      }
    }

    return {
      totalScore,
      criteria,
      label: getScoreLabel(totalScore),
      color: getScoreColor(totalScore),
      previousScore: null,
      diff: null,
      tips,
    };
  }, [transactions, budgets, savingsGoals, savingsDeposits, accounts, debtsData, getTransactionsForMonth, getMonthSavings, getTotalSavings, getAccountBalance]);
}

export function useSaveHealthScore(score: number, householdId: string) {
  const saveScore = useCallback(async () => {
    if (!householdId || score === undefined) return;
    const monthYear = getMonthYearStr(new Date());

    try {
      const { data: existing } = await supabase
        .from('health_scores')
        .select('id')
        .eq('household_id', householdId)
        .eq('month_year', monthYear)
        .maybeSingle();

      const payload = {
        household_id: householdId,
        month_year: monthYear,
        total_score: score,
      };

      if (existing) {
        await supabase.from('health_scores').update({ total_score: score }).eq('id', existing.id);
      } else {
        await supabase.from('health_scores').insert(payload);
      }
    } catch (e) {
      console.error('Error saving health score:', e);
    }
  }, [score, householdId]);

  useEffect(() => {
    saveScore();
  }, [saveScore]);
}

export function useHealthScoreHistory(householdId: string) {
  const [history, setHistory] = React.useState<{ monthYear: string; score: number }[]>([]);

  useEffect(() => {
    if (!householdId) return;
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('health_scores')
        .select('month_year, total_score')
        .eq('household_id', householdId)
        .order('month_year', { ascending: true })
        .limit(12);

      if (data) {
        setHistory(data.map(d => ({ monthYear: d.month_year, score: d.total_score })));
      }
    };
    fetchHistory();
  }, [householdId]);

  return history;
}
