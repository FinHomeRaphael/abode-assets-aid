import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import Layout from '@/components/Layout';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_STORAGE_KEY = 'finehome_chat_messages';
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-chat`;

const FinanceChat = () => {
  const {
    transactions, budgets, savingsGoals, savingsDeposits,
    household, currentUser, getTransactionsForMonth,
    getBudgetSpent, getGoalSaved, getMonthSavings, getTotalSavings,
    getBudgetsForMonth,
  } = useApp();
  const { formatAmount } = useCurrency();

  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

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
      return `- ${b.emoji} ${b.category}: ${formatAmount(spent)} / ${formatAmount(b.limit)} (${pct}%)`;
    }).join('\n');

    const goalLines = savingsGoals.map(g => {
      const saved = getGoalSaved(g.id);
      const pct = Math.round((saved / g.target) * 100);
      return `- ${g.emoji} ${g.name}: ${formatAmount(saved, g.currency)} / ${formatAmount(g.target, g.currency)} (${pct}%)${g.targetDate ? ` — objectif: ${g.targetDate}` : ''}`;
    }).join('\n');

    // Top expense categories this month
    const catMap: Record<string, number> = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.convertedAmount;
    });
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([cat, amount]) => `- ${cat}: ${formatAmount(amount)}`).join('\n');

    // Recent transactions
    const recentTx = monthTx.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
      .map(t => `- ${t.emoji} ${t.label}: ${t.type === 'income' ? '+' : '-'}${formatAmount(t.convertedAmount)} (${t.category}, ${t.date})`)
      .join('\n');

    const recurringCount = transactions.filter(t => t.isRecurring && !t.recurringSourceId && !t.recurringEndMonth).length;

    return `Utilisateur: ${currentUser?.name || 'Inconnu'}
Foyer: ${household.name} (${household.members.length} membre(s))
Devise: ${household.currency}

--- CE MOIS-CI ---
Revenus: ${formatAmount(totalIncome)}
Dépenses: ${formatAmount(totalExpense)}
Enveloppes du mois: ${formatAmount(monthSavings)}
Solde disponible: ${formatAmount(balance)}

--- MOIS PRÉCÉDENT ---
Revenus: ${formatAmount(prevIncome)}
Dépenses: ${formatAmount(prevExpense)}

--- TOP CATÉGORIES DE DÉPENSES ---
${topCats || 'Aucune dépense'}

--- BUDGETS ---
${budgetLines || 'Aucun budget défini'}

--- OBJECTIFS D'ENVELOPPE ---
${goalLines || 'Aucun objectif'}
Enveloppes totales cumulées: ${formatAmount(totalSavings)}

--- TRANSACTIONS RÉCENTES ---
${recentTx || 'Aucune transaction'}

Transactions récurrentes actives: ${recurringCount}
Nombre total de transactions ce mois: ${monthTx.length}`;
  }, [transactions, budgets, savingsGoals, savingsDeposits, household, currentUser, getTransactionsForMonth, getBudgetSpent, getGoalSaved, getMonthSavings, getTotalSavings, getBudgetsForMonth, formatAmount]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
    <Layout>
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-8rem)] -mb-32 md:mb-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-xl">✨</span>
          </div>
          <div>
            <h1 className="text-lg font-bold">Conseiller IA</h1>
            <p className="text-xs text-muted-foreground">Ton assistant financier personnel</p>
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
              onClick={() => { setMessages([]); localStorage.removeItem(CHAT_STORAGE_KEY); }}
              className="w-full mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Effacer la conversation
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default FinanceChat;
