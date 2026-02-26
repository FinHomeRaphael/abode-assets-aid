import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import Layout from '@/components/Layout';
import BackHeader from '@/components/BackHeader';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { PremiumGate } from '@/components/PremiumPaywall';
import { formatLocalDate } from '@/utils/format';
import { Debt, DEBT_TYPES, getDebtEmoji, estimateEndDate, getPeriodsPerYear } from '@/types/debt';

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
  } = useApp();
  const { formatAmount } = useCurrency();
  const { isPremium } = useSubscription(householdId, currentUser?.id);

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

    return `Utilisateur: ${currentUser?.name || 'Inconnu'}
Foyer: ${household.name} (${household.members.length} membre(s))
Devise principale: ${household.currency}
Périmètre actuel: ${scopeLabel}
Plan: ${household.plan}

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

--- SOURCES DE REVENUS ---
${topIncome || 'Aucun revenu'}

--- TOP CATÉGORIES DE DÉPENSES ---
${topCats || 'Aucune dépense'}

--- BUDGETS ---
${budgetLines || 'Aucun budget défini'}

--- OBJECTIFS D'ÉPARGNE ---
${goalLines || 'Aucun objectif'}
Épargne totale cumulée: ${formatAmount(totalSavings)}

--- COMPTES BANCAIRES ---
${accountLines || 'Aucun compte'}
${activeAccounts.length > 0 ? `Solde total tous comptes: ${totalAccountBalance >= 0 ? '+' : '-'}${formatAmount(Math.abs(totalAccountBalance))}` : ''}

--- DETTES & CRÉDITS ---
${debtLines || 'Aucune dette'}
${debts.length > 0 ? `Total restant dû: -${formatAmount(totalDebtRemaining)}
Total remboursé: ${formatAmount(totalRepaid)}
Mensualités totales: -${formatAmount(totalDebtPayment)}` : ''}

--- TRANSACTIONS RÉCURRENTES ---
${recurringLines || 'Aucune transaction récurrente'}

--- TRANSACTIONS RÉCENTES ---
${recentTx || 'Aucune transaction'}

Nombre total de transactions ce mois: ${monthTx.length}`;
  }, [transactions, budgets, savingsGoals, savingsDeposits, household, currentUser, getTransactionsForMonth, getBudgetSpent, getGoalSaved, getMonthSavings, getTotalSavings, getBudgetsForMonth, formatAmount, debts, scopedAccounts, getAccountBalance, getRecurringTransactions, financeScope]);

  const checkAiLimit = useCallback(async (): Promise<boolean> => {
    return true;
  }, []);

  const incrementAiCount = useCallback(async () => {
    // No limits
  }, []);

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

  const suggestions = [
    'Comment optimiser mes dépenses ?',
    'Analyse mon budget du mois',
    'Combien je peux mettre de côté ?',
    'Quelles sont mes plus grosses dépenses ?',
  ];

  return (
    <>
    <Layout>
      <PremiumGate feature="le conseiller IA" description="Obtiens des conseils financiers personnalisés grâce à l'intelligence artificielle.">
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-8rem)] -mb-32 md:mb-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <BackHeader />
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-xl">✨</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Conseiller IA</h1>
            <p className="text-xs text-muted-foreground">Ton assistant financier personnel</p>
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
              placeholder="Pose ta question..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
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
      </PremiumGate>
    </Layout>
    </>
  );
};

export default FinanceChat;
