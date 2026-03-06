import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import Layout from '@/components/Layout';
import BackHeader from '@/components/BackHeader';
import { useSubscription, FOYER_LIMITS } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { PlanGate } from '@/components/PlanGate';
import { formatLocalDate } from '@/utils/format';
import { Debt, DEBT_TYPES, getDebtEmoji, estimateEndDate, getPeriodsPerYear } from '@/types/debt';
import { useHealthScore } from '@/hooks/useHealthScore';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_STORAGE_KEY_PREFIX = 'finehome_chat_';
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-chat`;

const FinanceChat = () => {
  const {
    scopedTransactions: transactions, scopedBudgets: budgets, scopedSavingsGoals: savingsGoals, savingsDeposits,
    household, currentUser, getTransactionsForMonth,
    getBudgetSpent, getGoalSaved, getMonthSavings, getTotalSavings,
    getBudgetsForMonth, householdId, accounts, scopedAccounts, getAccountBalance,
    getRecurringTransactions, financeScope, session,
    customCategories, customAccountTypes, getGoalDeposits,
  } = useApp();
  const { formatAmount } = useCurrency();
  const { plan, isPremium } = useSubscription(householdId, currentUser?.id);

  // Personal savings target for scope-aware usage
  const [personalSavingsTarget, setPersonalSavingsTarget] = useState<number | null>(null);
  useEffect(() => {
    if (financeScope === 'personal' && session?.user?.id) {
      supabase.from('profiles').select('monthly_savings_target').eq('id', session.user.id).single().then(({ data }) => {
        setPersonalSavingsTarget(data?.monthly_savings_target != null ? Number(data.monthly_savings_target) : null);
      });
    }
  }, [financeScope, session?.user?.id]);

  // Fetch debts
  const [debts, setDebts] = useState<Debt[]>([]);
  useEffect(() => {
    if (!householdId) return;
    const fetchDebts = async () => {
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
          id: d.id, householdId: d.household_id, type: d.type, name: d.name, lender: d.lender || undefined,
          initialAmount: Number(d.initial_amount), remainingAmount: Number(d.remaining_amount),
          currency: d.currency, interestRate: Number(d.interest_rate), durationYears: Number(d.duration_years),
          startDate: d.start_date, paymentFrequency: d.payment_frequency, paymentDay: d.payment_day,
          paymentAmount: Number(d.payment_amount), categoryId: d.category_id || undefined,
          nextPaymentDate: d.next_payment_date || undefined, lastPaymentDate: d.last_payment_date || undefined,
          createdAt: d.created_at, updatedAt: d.updated_at,
          scope: d.scope || 'household', createdBy: d.created_by || undefined,
          amortizationType: d.amortization_type || 'fixed_annuity',
        })));
      }
    };
    fetchDebts();
  }, [householdId, financeScope, session?.user?.id]);

  // Fetch debt schedules
  const [debtSchedules, setDebtSchedules] = useState<{ debt_id: string; due_date: string; total_amount: number; principal_amount: number; interest_amount: number; capital_before: number; capital_after: number; status: string; period_number: number }[]>([]);
  useEffect(() => {
    if (!householdId) return;
    supabase.from('debt_schedules').select('*').eq('household_id', householdId).order('due_date').then(({ data }) => {
      if (data) setDebtSchedules(data);
    });
  }, [householdId]);

  // Fetch health scores history
  const [healthHistory, setHealthHistory] = useState<{ month_year: string; total_score: number; savings_rate_percent: number | null; debt_to_income_ratio: number | null; emergency_fund_months: number | null; budgets_respected_percent: number | null }[]>([]);
  useEffect(() => {
    if (!householdId) return;
    supabase.from('health_scores').select('month_year, total_score, savings_rate_percent, debt_to_income_ratio, emergency_fund_months, budgets_respected_percent').eq('household_id', householdId).order('month_year', { ascending: false }).limit(6).then(({ data }) => {
      if (data) setHealthHistory(data);
    });
  }, [householdId]);

  // Current health score
  const healthScore = useHealthScore();

  // Separate chat history per scope
  const chatStorageKey = useMemo(() => {
    if (financeScope === 'personal') {
      return `${CHAT_STORAGE_KEY_PREFIX}personal_${session?.user?.id || 'anon'}`;
    }
    return `${CHAT_STORAGE_KEY_PREFIX}household_${householdId || 'none'}`;
  }, [financeScope, session?.user?.id, householdId]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load messages when scope changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(chatStorageKey);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch { setMessages([]); }
  }, [chatStorageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(chatStorageKey, JSON.stringify(messages));
  }, [messages, chatStorageKey]);

  // Build financial context string
  const financialContext = useMemo(() => {
    const now = new Date();
    const monthTx = getTransactionsForMonth(now);
    const prevMonth = new Date(now); prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevTx = getTransactionsForMonth(prevMonth);

    const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.convertedAmount, 0);
    const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.convertedAmount, 0);
    const prevIncome = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.convertedAmount, 0);
    const prevExpense = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.convertedAmount, 0);
    const monthSavings = getMonthSavings(now);
    const totalSavings = getTotalSavings();
    const balance = totalIncome - totalExpense - monthSavings;

    const monthBudgets = getBudgetsForMonth(now);
    const budgetLines = monthBudgets.map(b => {
      const spent = getBudgetSpent(b, now);
      const pct = Math.round((spent / b.limit) * 100);
      const status = pct > 100 ? '🔴 DÉPASSÉ' : pct > 80 ? '🟡 ATTENTION' : '🟢 OK';
      return `- ${b.emoji} ${b.category}: dépensé -${formatAmount(spent)} sur limite ${formatAmount(b.limit)} (${pct}%) ${status}`;
    }).join('\n');

    const goalLines = savingsGoals.map(g => {
      const saved = getGoalSaved(g.id);
      const pct = g.target > 0 ? Math.round((saved / g.target) * 100) : 0;
      return `- ${g.emoji} ${g.name}: épargné ${formatAmount(saved, g.currency)} / objectif ${formatAmount(g.target, g.currency)} (${pct}%)${g.targetDate ? ` — date cible: ${g.targetDate}` : ''}`;
    }).join('\n');

    // Top expense categories this month
    const catMap: Record<string, number> = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.convertedAmount;
    });
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([cat, amount]) => `- ${cat}: -${formatAmount(amount)}`).join('\n');

    // Top income categories this month
    const incMap: Record<string, number> = {};
    monthTx.filter(t => t.type === 'income').forEach(t => {
      incMap[t.category] = (incMap[t.category] || 0) + t.convertedAmount;
    });
    const topIncome = Object.entries(incMap).sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => `- ${cat}: +${formatAmount(amount)}`).join('\n');

    // Recent transactions (more of them)
    const recentTx = monthTx.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)
      .map(t => {
        const sign = t.type === 'income' ? '+' : '-';
        const acctName = t.accountId ? scopedAccounts.find(a => a.id === t.accountId)?.name : undefined;
        return `- ${t.emoji} ${t.label}: ${sign}${formatAmount(t.convertedAmount)} (${t.category}, ${t.date}${acctName ? `, compte: ${acctName}` : ''}${t.notes ? `, note: ${t.notes}` : ''})`;
      })
      .join('\n');

    // Recurring transactions
    const recurringTxs = getRecurringTransactions();
    const recurringLines = recurringTxs.slice(0, 20).map(t => {
      const sign = t.type === 'income' ? '+' : '-';
      return `- ${t.emoji} ${t.label}: ${sign}${formatAmount(t.convertedAmount)}/mois (${t.category})`;
    }).join('\n');

    // Accounts and balances
    const activeAccounts = scopedAccounts.filter(a => !a.isArchived);
    const accountLines = activeAccounts.map(a => {
      const bal = getAccountBalance(a.id);
      return `- ${a.name} (${a.type}${a.currency !== household.currency ? `, ${a.currency}` : ''}): solde ${bal >= 0 ? '+' : '-'}${formatAmount(Math.abs(bal), a.currency)}`;
    }).join('\n');
    const totalAccountBalance = activeAccounts.reduce((s, a) => s + getAccountBalance(a.id), 0);

    // Debts
    const totalDebtRemaining = debts.reduce((s, d) => s + d.remainingAmount, 0);
    const totalDebtPayment = debts.reduce((s, d) => s + d.paymentAmount, 0);
    const totalRepaid = debts.reduce((s, d) => s + (d.initialAmount - d.remainingAmount), 0);
    const debtLines = debts.map(d => {
      const emoji = getDebtEmoji(d.type);
      const typeName = DEBT_TYPES.find(dt => dt.value === d.type)?.label || d.type;
      const endDate = estimateEndDate(d);
      const periodsYear = getPeriodsPerYear(d.paymentFrequency);
      const monthlyInterest = d.remainingAmount * (d.interestRate / 100 / periodsYear);
      const monthlyCapital = Math.max(d.paymentAmount - monthlyInterest, 0);
      return `- ${emoji} ${d.name} (${typeName}${d.lender ? `, prêteur: ${d.lender}` : ''}): restant dû -${formatAmount(d.remainingAmount, d.currency)}, échéance -${formatAmount(d.paymentAmount, d.currency)}/${d.paymentFrequency === 'monthly' ? 'mois' : d.paymentFrequency}, taux ${d.interestRate}%, amortissement ${formatAmount(monthlyCapital, d.currency)} + intérêts ${formatAmount(monthlyInterest, d.currency)}${endDate ? `, fin estimée: ${endDate}` : ''}`;
    }).join('\n');

    // Members
    const memberLines = household.members.map(m => `- ${m.name} (${m.role})`).join('\n');

    // Périmètre actuel
    const scopeLabel = financeScope === 'personal' ? 'Personnel' : 'Foyer';

    // Categories available
    const expenseCategories = customCategories.filter(c => c.type === 'expense').map(c => `${c.emoji} ${c.name}`).join(', ');
    const incomeCategories = customCategories.filter(c => c.type === 'income').map(c => `${c.emoji} ${c.name}`).join(', ');

    // Savings deposits details
    const depositLines = savingsGoals.map(g => {
      const deposits = getGoalDeposits(g.id);
      if (deposits.length === 0) return null;
      const recentDeposits = deposits.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
        .map(d => `  - ${d.date}: ${formatAmount(d.amount, g.currency)}`).join('\n');
      return `${g.emoji} ${g.name}:\n${recentDeposits}`;
    }).filter(Boolean).join('\n');

    // Debt schedules (upcoming payments)
    const nowStr = formatLocalDate(now);
    const upcomingSchedules = debtSchedules
      .filter(s => s.due_date >= nowStr && s.status === 'prevu')
      .slice(0, 12);
    const scheduleLines = upcomingSchedules.map(s => {
      const debt = debts.find(d => d.id === s.debt_id);
      return `- ${debt?.name || '?'}: ${s.due_date} — ${formatAmount(s.total_amount)} (capital: ${formatAmount(s.principal_amount)}, intérêts: ${formatAmount(s.interest_amount)}, restant après: ${formatAmount(s.capital_after)})`;
    }).join('\n');

    // Health score
    const healthLines = healthScore.criteria.map(c => `- ${c.label}: ${c.score}/20 — ${c.details}`).join('\n');
    const healthHistoryLines = healthHistory.map(h => `- ${h.month_year}: ${h.total_score}/100`).join('\n');

    // Monthly savings target
    const savingsTarget = financeScope === 'personal' ? personalSavingsTarget : household.monthlySavingsTarget;

    // 2 months before for trend
    const twoMonthsAgo = new Date(now); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const twoMonthsAgoTx = getTransactionsForMonth(twoMonthsAgo);
    const twoMonthsAgoExpense = twoMonthsAgoTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.convertedAmount, 0);
    const twoMonthsAgoIncome = twoMonthsAgoTx.filter(t => t.type === 'income').reduce((s, t) => s + t.convertedAmount, 0);

    return `Utilisateur: ${currentUser?.name || 'Inconnu'}
Foyer: ${household.name} (${household.members.length} membre(s))
Devise principale: ${household.currency}
Périmètre actuel: ${scopeLabel}
Plan: ${household.plan}
${savingsTarget ? `Objectif d'épargne mensuel: ${formatAmount(savingsTarget)}` : ''}

--- MEMBRES DU FOYER ---
${memberLines || 'Aucun membre'}

--- CE MOIS-CI (${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}) ---
Revenus totaux: +${formatAmount(totalIncome)}
Dépenses totales: -${formatAmount(totalExpense)}
Épargne versée ce mois: ${monthSavings >= 0 ? '-' : '+'}${formatAmount(Math.abs(monthSavings))} ${monthSavings < 0 ? '(⚠️ retrait d\'épargne)' : ''}
Solde disponible (revenus - dépenses - épargne): ${balance >= 0 ? '+' : '-'}${formatAmount(Math.abs(balance))}

--- MOIS PRÉCÉDENT (${prevMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}) ---
Revenus: +${formatAmount(prevIncome)}
Dépenses: -${formatAmount(prevExpense)}
Évolution dépenses: ${prevExpense > 0 ? `${totalExpense > prevExpense ? '📈 +' : '📉 -'}${Math.abs(Math.round(((totalExpense - prevExpense) / prevExpense) * 100))}%` : 'N/A'}

--- IL Y A 2 MOIS (${twoMonthsAgo.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}) ---
Revenus: +${formatAmount(twoMonthsAgoIncome)}
Dépenses: -${formatAmount(twoMonthsAgoExpense)}

--- SOURCES DE REVENUS ---
${topIncome || 'Aucun revenu'}

--- TOP CATÉGORIES DE DÉPENSES ---
${topCats || 'Aucune dépense'}

--- BUDGETS ---
${budgetLines || 'Aucun budget défini'}

--- OBJECTIFS D'ÉPARGNE ---
${goalLines || 'Aucun objectif'}
Épargne totale cumulée: ${formatAmount(totalSavings)}

--- DERNIERS VERSEMENTS D'ÉPARGNE ---
${depositLines || 'Aucun versement récent'}

--- COMPTES BANCAIRES ---
${accountLines || 'Aucun compte'}
${activeAccounts.length > 0 ? `Solde total tous comptes: ${totalAccountBalance >= 0 ? '+' : '-'}${formatAmount(Math.abs(totalAccountBalance))}` : ''}

--- DETTES & CRÉDITS ---
${debtLines || 'Aucune dette'}
${debts.length > 0 ? `Total restant dû: -${formatAmount(totalDebtRemaining)}
Total remboursé: ${formatAmount(totalRepaid)}
Mensualités totales: -${formatAmount(totalDebtPayment)}` : ''}

--- PROCHAINES ÉCHÉANCES DE DETTES ---
${scheduleLines || 'Aucune échéance à venir'}

--- TRANSACTIONS RÉCURRENTES ---
${recurringLines || 'Aucune transaction récurrente'}

--- TRANSACTIONS RÉCENTES ---
${recentTx || 'Aucune transaction'}

Nombre total de transactions ce mois: ${monthTx.length}

--- SCORE DE SANTÉ FINANCIÈRE (${healthScore.totalScore}/100) ---
${healthLines || 'Non calculé'}

--- HISTORIQUE DES SCORES ---
${healthHistoryLines || 'Aucun historique'}

--- CATÉGORIES DISPONIBLES ---
Dépenses: ${expenseCategories || 'Aucune'}
Revenus: ${incomeCategories || 'Aucune'}`;
  }, [transactions, budgets, savingsGoals, savingsDeposits, household, currentUser, getTransactionsForMonth, getBudgetSpent, getGoalSaved, getGoalDeposits, getMonthSavings, getTotalSavings, getBudgetsForMonth, formatAmount, debts, debtSchedules, scopedAccounts, getAccountBalance, getRecurringTransactions, financeScope, customCategories, healthScore, healthHistory]);

  // Coach IA usage tracking
  const [coachUsage, setCoachUsage] = useState<{ count: number; resetDate: string | null }>({ count: 0, resetDate: null });

  useEffect(() => {
    if (!householdId) return;
    supabase.from('households').select('coach_ia_conversations_count, coach_ia_reset_date').eq('id', householdId).single().then(({ data }) => {
      if (data) {
        setCoachUsage({
          count: (data as any).coach_ia_conversations_count || 0,
          resetDate: (data as any).coach_ia_reset_date || null,
        });
      }
    });
  }, [householdId]);

  const coachLimitReached = plan === 'foyer' && coachUsage.count >= FOYER_LIMITS.coachIa;

  const checkAiLimit = useCallback(async (): Promise<boolean> => {
    if (plan === 'famille') return true;
    if (plan === 'free') return false;
    // foyer: check limit
    const { data } = await supabase.from('households').select('coach_ia_conversations_count').eq('id', householdId).single();
    const count = (data as any)?.coach_ia_conversations_count || 0;
    if (count >= FOYER_LIMITS.coachIa) {
      setCoachUsage(prev => ({ ...prev, count }));
      return false;
    }
    return true;
  }, [plan, householdId]);

  const incrementAiCount = useCallback(async () => {
    if (plan !== 'foyer' || !householdId) return;
    const { data } = await supabase.from('households').select('coach_ia_conversations_count').eq('id', householdId).single();
    const current = (data as any)?.coach_ia_conversations_count || 0;
    const newCount = current + 1;
    await supabase.from('households').update({ coach_ia_conversations_count: newCount } as any).eq('id', householdId);
    setCoachUsage(prev => ({ ...prev, count: newCount }));
  }, [plan, householdId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const allowed = await checkAiLimit();
    if (!allowed) return;

    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    const allMessages = [...messages, userMsg];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Session expirée, veuillez vous reconnecter.');
        setIsLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          financialContext,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erreur réseau' }));
        toast.error(err.error || 'Erreur du service IA');
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
                }
                return [...prev, { role: 'assistant', content: snapshot }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
                }
                return [...prev, { role: 'assistant', content: snapshot }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      toast.error('Erreur de connexion au service IA');
    }

    await incrementAiCount();
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const suggestions = useMemo(() => {
    const now = new Date();
    const monthTx = getTransactionsForMonth(now);
    const totalIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.convertedAmount, 0);
    const totalExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.convertedAmount, 0);
    const monthBudgets = getBudgetsForMonth(now);

    const contextual: { emoji: string; text: string; priority: number }[] = [];

    // Budgets dépassés
    const overBudgets = monthBudgets.filter(b => {
      const spent = getBudgetSpent(b, now);
      return spent > b.limit;
    });
    if (overBudgets.length > 0) {
      const names = overBudgets.map(b => b.category).join(', ');
      contextual.push({ emoji: '🔴', text: `J'ai dépassé mon budget ${names}, que faire ?`, priority: 10 });
    }

    // Budgets en alerte (>80%)
    const warningBudgets = monthBudgets.filter(b => {
      const spent = getBudgetSpent(b, now);
      const ratio = spent / b.limit;
      return ratio > 0.8 && ratio <= 1;
    });
    if (warningBudgets.length > 0) {
      contextual.push({ emoji: '🟡', text: `Mon budget ${warningBudgets[0].category} est presque épuisé, des conseils ?`, priority: 8 });
    }

    // Échéances proches (dans les 7 jours)
    const nowStr = formatLocalDate(now);
    const weekLater = new Date(now); weekLater.setDate(weekLater.getDate() + 7);
    const weekStr = formatLocalDate(weekLater);
    const upcomingPayments = debtSchedules.filter(s => s.due_date >= nowStr && s.due_date <= weekStr && s.status === 'prevu');
    if (upcomingPayments.length > 0) {
      const totalDue = upcomingPayments.reduce((s, p) => s + p.total_amount, 0);
      contextual.push({ emoji: '📅', text: `J'ai ${formatAmount(totalDue)} d'échéances cette semaine, suis-je prêt ?`, priority: 9 });
    }

    // Score de santé faible
    if (healthScore.totalScore < 50) {
      contextual.push({ emoji: '💊', text: `Mon score de santé financière est de ${healthScore.totalScore}/100, comment l'améliorer ?`, priority: 7 });
    }

    // Pas de revenus encore ce mois
    if (totalIncome === 0 && now.getDate() > 5) {
      contextual.push({ emoji: '⚠️', text: `Aucun revenu enregistré ce mois, est-ce normal ?`, priority: 6 });
    }

    // Dépenses élevées vs revenus
    if (totalIncome > 0 && totalExpense > totalIncome * 0.9) {
      contextual.push({ emoji: '📈', text: `Mes dépenses atteignent ${Math.round(totalExpense / totalIncome * 100)}% de mes revenus, que faire ?`, priority: 8 });
    }

    // Objectif d'épargne
    const savingsTarget = financeScope === 'personal' ? personalSavingsTarget : household.monthlySavingsTarget;
    const monthSavings = getMonthSavings(now);
    if (savingsTarget && monthSavings < savingsTarget) {
      contextual.push({ emoji: '🎯', text: `Comment atteindre mon objectif d'épargne de ${formatAmount(savingsTarget)} ce mois ?`, priority: 5 });
    }

    // Objectifs d'épargne proches de l'objectif
    const nearGoals = savingsGoals.filter(g => {
      const saved = getGoalSaved(g.id);
      return g.target > 0 && saved / g.target >= 0.9 && saved < g.target;
    });
    if (nearGoals.length > 0) {
      contextual.push({ emoji: '🏁', text: `Mon objectif "${nearGoals[0].name}" est presque atteint, et après ?`, priority: 4 });
    }

    // Trier par priorité et prendre les 2 meilleurs
    contextual.sort((a, b) => b.priority - a.priority);
    const dynamic = contextual.slice(0, 2).map(c => `${c.emoji} ${c.text}`);

    // Suggestions par défaut
    const defaults = [
      'Analyse mon budget du mois',
      'Combien je peux mettre de côté ?',
      'Quelles sont mes plus grosses dépenses ?',
      'Comment optimiser mes finances ?',
    ];

    // Combiner: contextuelles d'abord, puis compléter avec les défauts
    const result = [...dynamic];
    for (const d of defaults) {
      if (result.length >= 4) break;
      result.push(d);
    }
    return result;
  }, [getTransactionsForMonth, getBudgetsForMonth, getBudgetSpent, debtSchedules, healthScore, savingsGoals, getGoalSaved, household, getMonthSavings, formatAmount]);

  return (
    <>
    <Layout>
      <PlanGate requiredPlan="foyer" message="Le Coach IA est disponible avec le plan Foyer. Obtiens des conseils personnalisés basés sur tes finances." ctaText="Découvrir le plan Foyer →">
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-8rem)] -mb-32 md:mb-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <BackHeader />
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-xl">✨</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Coach IA</h1>
            <p className="text-xs text-muted-foreground">Ton coach financier personnel</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            financeScope === 'personal'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}>
            <span>{financeScope === 'personal' ? '👤' : '🏠'}</span>
            <span>{financeScope === 'personal' ? 'Personnel' : 'Foyer'}</span>
          </div>
        </div>

        {/* Coach IA usage counter (foyer only) */}
        {plan === 'foyer' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">{coachUsage.count}/{FOYER_LIMITS.coachIa} conversations ce mois</span>
              {coachUsage.count >= 25 && coachUsage.count < 30 && (
                <span className="text-warning font-medium">Plus que {30 - coachUsage.count} disponibles</span>
              )}
              {coachUsage.count >= 30 && (
                <span className="text-destructive font-medium">Limite atteinte</span>
              )}
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  coachUsage.count >= 30 ? 'bg-destructive' : coachUsage.count >= 25 ? 'bg-warning' : 'bg-primary'
                }`}
                style={{ width: `${Math.min((coachUsage.count / 30) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-3">
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
                <span className="text-3xl">💬</span>
              </div>
              <div className="text-center">
                <p className="font-semibold">Salut {currentUser?.name?.split(' ')[0] || ''} !</p>
                <p className="text-sm text-muted-foreground mt-1">Pose-moi une question sur tes finances</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {suggestions.map(s => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }} className="text-xs px-3 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </div>

        {/* Input */}
        <div className="pt-3 border-t border-border/50 pb-safe">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={coachLimitReached ? "Limite atteinte ce mois" : "Pose ta question..."}
              disabled={isLoading || coachLimitReached}
              className="flex-1 px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading || coachLimitReached}
              className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              Envoyer
            </button>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); localStorage.removeItem(chatStorageKey); }}
              className="w-full mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Effacer la conversation
            </button>
          )}
        </div>
      </div>
      </PlanGate>
    </Layout>
    </>
  );
};

export default FinanceChat;
