import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import ConvertedAmount from '@/components/ConvertedAmount';

const StartOfMonth = () => {
  const {
    transactions, getTransactionsForMonth, getRecurringTransactions,
    addTransaction, household, currentUser,
    savingsGoals, getGoalSaved, addSavingsDeposit, getMonthSavings,
    getMemberById,
  } = useApp();
  const { formatAmount } = useCurrency();

  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now);

  // --- Step 1 & 2: recurring templates ---
  const recurringTemplates = useMemo(() => {
    return transactions.filter(t => t.isRecurring && !t.recurringSourceId && (!t.recurringEndMonth || t.recurringEndMonth > monthYear));
  }, [transactions, monthYear]);

  const recurringIncomes = recurringTemplates.filter(t => t.type === 'income');
  const recurringExpenses = recurringTemplates.filter(t => t.type === 'expense');

  // Check which ones already have an instance for this month
  const monthTx = useMemo(() => getTransactionsForMonth(now), [getTransactionsForMonth]);

  const isReceivedOrPaid = (templateId: string) => {
    // Check if the template itself is in this month
    const template = transactions.find(t => t.id === templateId);
    if (template) {
      const [tY, tM] = template.date.split('-').map(Number);
      if (tY === now.getFullYear() && tM === now.getMonth() + 1) return true;
    }
    // Check for generated instance
    return monthTx.some(t => t.recurringSourceId === templateId);
  };

  // Ignored items (user explicitly skipped)
  const [ignoredIncomes, setIgnoredIncomes] = useState<Set<string>>(new Set());
  const [ignoredExpenses, setIgnoredExpenses] = useState<Set<string>>(new Set());
  const [savingsConfirmed, setSavingsConfirmed] = useState(false);
  const [savingsSkipped, setSavingsSkipped] = useState(false);
  const [savingsAmounts, setSavingsAmounts] = useState<Record<string, string>>({});

  // Step completion
  const step1Done = recurringIncomes.length === 0 || recurringIncomes.every(t => isReceivedOrPaid(t.id) || ignoredIncomes.has(t.id));
  const step2Done = recurringExpenses.length === 0 || recurringExpenses.every(t => isReceivedOrPaid(t.id) || ignoredExpenses.has(t.id));
  const step3Done = savingsConfirmed || savingsSkipped || savingsGoals.length === 0;

  const completedSteps = [step1Done, step2Done, step3Done].filter(Boolean).length;
  const progressPct = Math.round((completedSteps / 3) * 100);
  const allDone = completedSteps === 3;

  const handleMarkReceived = (template: typeof recurringIncomes[0]) => {
    // Create a transaction for this month
    const day = template.recurrenceDay || parseInt(template.date.split('-')[2]) || 1;
    const maxDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const safeDay = Math.min(day, maxDay);
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;

    addTransaction({
      type: template.type,
      label: template.label,
      amount: template.amount,
      currency: template.currency,
      category: template.category,
      memberId: template.memberId,
      date: dateStr,
      emoji: template.emoji,
      notes: `Via début de mois`,
      isRecurring: false,
      recurringSourceId: template.id,
    });
    toast.success(`${template.type === 'income' ? 'Revenu' : 'Dépense'} enregistré(e) ✓`);
  };

  const handleConfirmSavings = () => {
    let deposited = false;
    for (const goal of savingsGoals) {
      const amount = parseFloat(savingsAmounts[goal.id] || '0');
      if (amount > 0) {
        addSavingsDeposit({
          goalId: goal.id,
          amount,
          memberId: currentUser?.id || household.members[0]?.id || '',
          date: `${monthYear}-01`,
        });
        deposited = true;
      }
    }
    setSavingsConfirmed(true);
    if (deposited) toast.success('Épargne du mois enregistrée ✓');
    else toast.info('Aucune épargne enregistrée ce mois');
  };

  const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

  return (
    <Layout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <motion.div variants={fadeUp}>
          <h1 className="text-xl font-bold mb-1">🗓️ Début de mois</h1>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel}</p>
        </motion.div>

        {/* Progress bar */}
        <motion.div variants={fadeUp} className="card-elevated p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Progression</span>
            <span className="font-bold text-primary">{progressPct}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {['Revenus', 'Charges', 'Épargne'].map((label, i) => (
              <span key={label} className={`text-xs font-medium ${[step1Done, step2Done, step3Done][i] ? 'text-primary' : 'text-muted-foreground'}`}>
                {[step1Done, step2Done, step3Done][i] ? '✓ ' : ''}{label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Success message */}
        <AnimatePresence>
          {allDone && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card-elevated p-6 text-center border-2 border-primary/30">
              <p className="text-3xl mb-2">🎉</p>
              <p className="font-bold text-lg">Ton mois est prêt !</p>
              <p className="text-sm text-muted-foreground mt-1">Toutes les étapes sont complétées pour {monthLabel}.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Recurring Incomes */}
        <motion.div variants={fadeUp} className="card-elevated overflow-hidden">
          <div className={`p-4 flex items-center justify-between border-b border-border/50 ${step1Done ? 'bg-primary/5' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step1Done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {step1Done ? '✓' : '1'}
              </div>
              <div>
                <p className="font-semibold text-sm">Vérifier tes revenus du mois</p>
                <p className="text-xs text-muted-foreground">Marque les revenus récurrents comme reçus</p>
              </div>
            </div>
            {step1Done && <span className="text-xs font-semibold text-primary px-2 py-1 rounded-lg bg-primary/10">Terminé</span>}
          </div>
          <div className="p-4 space-y-2">
            {recurringIncomes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">Aucun revenu récurrent configuré</p>
            ) : recurringIncomes.map(t => {
              const received = isReceivedOrPaid(t.id);
              const ignored = ignoredIncomes.has(t.id);
              const member = getMemberById(t.memberId);
              return (
                <div key={t.id} className={`flex items-center justify-between rounded-xl px-3 py-3 transition-colors ${received || ignored ? 'bg-muted/30' : 'bg-muted/50'}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg">{t.emoji}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${received || ignored ? 'line-through text-muted-foreground' : ''}`}>{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.category}{member ? ` · ${member.name}` : ''} · Le {t.recurrenceDay || parseInt(t.date.split('-')[2])}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono-amount text-sm font-semibold text-primary">+{formatAmount(t.amount, t.currency)}</span>
                    {received ? (
                      <span className="text-xs text-primary font-medium px-2 py-1 rounded-lg bg-primary/10">Reçu ✓</span>
                    ) : ignored ? (
                      <span className="text-xs text-muted-foreground font-medium px-2 py-1 rounded-lg bg-muted">Ignoré</span>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={() => handleMarkReceived(t)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                          Reçu
                        </button>
                        <button onClick={() => setIgnoredIncomes(prev => new Set(prev).add(t.id))} className="text-xs font-medium px-2 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                          Ignorer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Step 2: Recurring Expenses */}
        <motion.div variants={fadeUp} className="card-elevated overflow-hidden">
          <div className={`p-4 flex items-center justify-between border-b border-border/50 ${step2Done ? 'bg-primary/5' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step2Done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {step2Done ? '✓' : '2'}
              </div>
              <div>
                <p className="font-semibold text-sm">Vérifier tes charges fixes</p>
                <p className="text-xs text-muted-foreground">Marque les dépenses récurrentes comme payées</p>
              </div>
            </div>
            {step2Done && <span className="text-xs font-semibold text-primary px-2 py-1 rounded-lg bg-primary/10">Terminé</span>}
          </div>
          <div className="p-4 space-y-2">
            {recurringExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">Aucune dépense récurrente configurée</p>
            ) : recurringExpenses.map(t => {
              const paid = isReceivedOrPaid(t.id);
              const ignored = ignoredExpenses.has(t.id);
              const member = getMemberById(t.memberId);
              return (
                <div key={t.id} className={`flex items-center justify-between rounded-xl px-3 py-3 transition-colors ${paid || ignored ? 'bg-muted/30' : 'bg-muted/50'}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg">{t.emoji}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${paid || ignored ? 'line-through text-muted-foreground' : ''}`}>{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.category}{member ? ` · ${member.name}` : ''} · Le {t.recurrenceDay || parseInt(t.date.split('-')[2])}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono-amount text-sm font-semibold text-destructive">-{formatAmount(t.amount, t.currency)}</span>
                    {paid ? (
                      <span className="text-xs text-primary font-medium px-2 py-1 rounded-lg bg-primary/10">Payé ✓</span>
                    ) : ignored ? (
                      <span className="text-xs text-muted-foreground font-medium px-2 py-1 rounded-lg bg-muted">Ignoré</span>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={() => handleMarkReceived(t)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                          Payé
                        </button>
                        <button onClick={() => setIgnoredExpenses(prev => new Set(prev).add(t.id))} className="text-xs font-medium px-2 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                          Ignorer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Step 3: Savings */}
        <motion.div variants={fadeUp} className="card-elevated overflow-hidden">
          <div className={`p-4 flex items-center justify-between border-b border-border/50 ${step3Done ? 'bg-primary/5' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step3Done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {step3Done ? '✓' : '3'}
              </div>
              <div>
                <p className="font-semibold text-sm">Planifier ton épargne du mois</p>
                <p className="text-xs text-muted-foreground">Définis combien mettre de côté ce mois-ci</p>
              </div>
            </div>
            {step3Done && <span className="text-xs font-semibold text-primary px-2 py-1 rounded-lg bg-primary/10">Terminé</span>}
          </div>
          <div className="p-4 space-y-3">
            {savingsGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">Aucun objectif d'épargne créé</p>
            ) : step3Done ? (
              <div className="text-center py-3">
                <p className="text-sm text-muted-foreground">
                  {savingsSkipped ? 'Pas d\'épargne ce mois-ci' : 'Épargne planifiée pour ce mois ✓'}
                </p>
              </div>
            ) : (
              <>
                {savingsGoals.map(g => {
                  const saved = getGoalSaved(g.id);
                  const pct = Math.min((saved / g.target) * 100, 100);
                  return (
                    <div key={g.id} className="rounded-xl bg-muted/50 px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{g.emoji} {g.name}</span>
                        <span className="text-xs text-muted-foreground font-mono-amount">{formatAmount(saved, g.currency)} / {formatAmount(g.target, g.currency)} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground shrink-0">Épargner :</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={savingsAmounts[g.id] || ''}
                          onChange={e => setSavingsAmounts(prev => ({ ...prev, [g.id]: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="text-xs text-muted-foreground">{g.currency}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setSavingsSkipped(true)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Je ne peux pas épargner ce mois
                  </button>
                  <button
                    onClick={handleConfirmSavings}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Valider l'épargne
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default StartOfMonth;
