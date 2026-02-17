import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

const STORAGE_KEY_PREFIX = 'finehome_start_month_';

interface ChecklistState {
  checkedIncomes: string[];
  checkedExpenses: string[];
  cancelled: string[];
  savingsConfirmed: boolean;
  savingsSkipped: boolean;
}

function loadChecklist(monthYear: string): ChecklistState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${monthYear}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { checkedIncomes: [], checkedExpenses: [], cancelled: [], savingsConfirmed: false, savingsSkipped: false };
}

function saveChecklist(monthYear: string, state: ChecklistState) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${monthYear}`, JSON.stringify(state));
}

const StartOfMonth = () => {
  const {
    transactions, household, currentUser,
    savingsGoals, getGoalSaved, addSavingsDeposit,
    softDeleteRecurringTransaction, getMemberById,
  } = useApp();
  const { formatAmount } = useCurrency();

  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now);

  // Recurring templates active this month
  const recurringTemplates = useMemo(() => {
    return transactions.filter(t => t.isRecurring && !t.recurringSourceId && (!t.recurringEndMonth || t.recurringEndMonth > monthYear));
  }, [transactions, monthYear]);

  const recurringIncomes = recurringTemplates.filter(t => t.type === 'income');
  const recurringExpenses = recurringTemplates.filter(t => t.type === 'expense');

  // Load persisted state
  const initial = useMemo(() => loadChecklist(monthYear), [monthYear]);

  const [checkedIncomes, setCheckedIncomes] = useState<Set<string>>(() => new Set(initial.checkedIncomes));
  const [checkedExpenses, setCheckedExpenses] = useState<Set<string>>(() => new Set(initial.checkedExpenses));
  const [cancelRequested, setCancelRequested] = useState<Set<string>>(() => new Set(initial.cancelled));
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  // Savings
  const [savingsConfirmed, setSavingsConfirmed] = useState(initial.savingsConfirmed);
  const [savingsSkipped, setSavingsSkipped] = useState(initial.savingsSkipped);
  const [savingsAmounts, setSavingsAmounts] = useState<Record<string, string>>({});

  // Persist on every change
  useEffect(() => {
    saveChecklist(monthYear, {
      checkedIncomes: Array.from(checkedIncomes),
      checkedExpenses: Array.from(checkedExpenses),
      cancelled: Array.from(cancelRequested),
      savingsConfirmed,
      savingsSkipped,
    });
  }, [monthYear, checkedIncomes, checkedExpenses, cancelRequested, savingsConfirmed, savingsSkipped]);

  // Step completion: every item is either checked or cancel-requested
  const step1Done = recurringIncomes.length === 0 || recurringIncomes.every(t => checkedIncomes.has(t.id) || cancelRequested.has(t.id));
  const step2Done = recurringExpenses.length === 0 || recurringExpenses.every(t => checkedExpenses.has(t.id) || cancelRequested.has(t.id));
  const step3Done = savingsConfirmed || savingsSkipped || savingsGoals.length === 0;

  const completedSteps = [step1Done, step2Done, step3Done].filter(Boolean).length;
  const progressPct = Math.round((completedSteps / 3) * 100);
  const allDone = completedSteps === 3;

  const toggleCheck = (id: string, type: 'income' | 'expense') => {
    const setter = type === 'income' ? setCheckedIncomes : setCheckedExpenses;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCancelRecurring = (id: string) => {
    softDeleteRecurringTransaction(id, monthYear);
    setCancelRequested(prev => new Set(prev).add(id));
    setConfirmCancel(null);
    toast.success('Récurrence arrêtée à partir de ce mois ✓');
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

  const renderRecurringItem = (t: typeof recurringTemplates[0], type: 'income' | 'expense') => {
    const checked = type === 'income' ? checkedIncomes.has(t.id) : checkedExpenses.has(t.id);
    const cancelled = cancelRequested.has(t.id);
    const member = getMemberById(t.memberId);
    const isConfirmingCancel = confirmCancel === t.id;

    return (
      <div key={t.id} className={`rounded-xl px-3 py-3 transition-colors ${cancelled ? 'bg-destructive/5 opacity-60' : checked ? 'bg-primary/5' : 'bg-muted/50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Checkbox */}
            <button
              onClick={() => !cancelled && toggleCheck(t.id, type)}
              disabled={cancelled}
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                checked ? 'bg-primary border-primary text-primary-foreground' : cancelled ? 'border-muted bg-muted' : 'border-border hover:border-primary/50'
              }`}
            >
              {checked && <span className="text-xs">✓</span>}
              {cancelled && <span className="text-xs">✕</span>}
            </button>
            <span className="text-lg">{t.emoji}</span>
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate ${cancelled ? 'line-through text-muted-foreground' : ''}`}>{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.category}{member ? ` · ${member.name}` : ''} · Le {t.recurrenceDay || parseInt(t.date.split('-')[2])}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className={`font-mono-amount text-sm font-semibold ${type === 'income' ? 'text-primary' : 'text-destructive'}`}>
              {type === 'income' ? '+' : '-'}{formatAmount(t.convertedAmount)}
            </span>
            {!cancelled && !checked && (
              <button
                onClick={() => setConfirmCancel(isConfirmingCancel ? null : t.id)}
                className="text-xs font-medium px-2 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
              >
                Annuler
              </button>
            )}
            {cancelled && (
              <span className="text-xs text-destructive font-medium px-2 py-1 rounded-lg bg-destructive/10">Annulé</span>
            )}
          </div>
        </div>

        {/* Cancel confirmation */}
        <AnimatePresence>
          {isConfirmingCancel && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                <p className="text-xs text-destructive font-medium">
                  Arrêter cette récurrence à partir de ce mois ? L'historique passé sera conservé.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmCancel(null)} className="flex-1 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
                    Non
                  </button>
                  <button onClick={() => handleCancelRecurring(t.id)} className="flex-1 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-colors">
                    Oui, arrêter
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

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
            <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
          </div>
          <div className="flex justify-between mt-2">
            {['Revenus', 'Charges', 'Épargne'].map((label, i) => (
              <span key={label} className={`text-xs font-medium ${[step1Done, step2Done, step3Done][i] ? 'text-primary' : 'text-muted-foreground'}`}>
                {[step1Done, step2Done, step3Done][i] ? '✓ ' : ''}{label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Success */}
        <AnimatePresence>
          {allDone && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', damping: 12 }} className="card-elevated p-6 text-center border-2 border-primary/30 bg-primary/5">
              <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', damping: 8 }} className="text-4xl mb-3">🚀</motion.p>
              <p className="font-bold text-lg">Tu gères comme un(e) pro !</p>
              <p className="text-sm text-muted-foreground mt-1.5">Tout est en ordre pour {monthLabel}. Profite bien de ton mois 💪</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Incomes */}
        <motion.div variants={fadeUp} className="card-elevated overflow-hidden">
          <div className={`p-4 flex items-center justify-between border-b border-border/50 ${step1Done ? 'bg-primary/5' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step1Done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {step1Done ? '✓' : '1'}
              </div>
              <div>
                <p className="font-semibold text-sm">Vérifier tes revenus du mois</p>
                <p className="text-xs text-muted-foreground">Coche ou annule tes revenus récurrents</p>
              </div>
            </div>
            {step1Done && <span className="text-xs font-semibold text-primary px-2 py-1 rounded-lg bg-primary/10">Terminé</span>}
          </div>
          <div className="p-4 space-y-2">
            {recurringIncomes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">Aucun revenu récurrent configuré</p>
            ) : recurringIncomes.map(t => renderRecurringItem(t, 'income'))}
            <AnimatePresence>
              {step1Done && recurringIncomes.length > 0 && (
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center text-xs font-medium text-primary pt-2">
                  ✨ Revenus vérifiés, nickel !
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Step 2: Expenses */}
        <motion.div variants={fadeUp} className="card-elevated overflow-hidden">
          <div className={`p-4 flex items-center justify-between border-b border-border/50 ${step2Done ? 'bg-primary/5' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step2Done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {step2Done ? '✓' : '2'}
              </div>
              <div>
                <p className="font-semibold text-sm">Vérifier tes charges fixes</p>
                <p className="text-xs text-muted-foreground">Coche ou annule tes dépenses récurrentes</p>
              </div>
            </div>
            {step2Done && <span className="text-xs font-semibold text-primary px-2 py-1 rounded-lg bg-primary/10">Terminé</span>}
          </div>
          <div className="p-4 space-y-2">
            {recurringExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">Aucune dépense récurrente configurée</p>
            ) : recurringExpenses.map(t => renderRecurringItem(t, 'expense'))}
            <AnimatePresence>
              {step2Done && recurringExpenses.length > 0 && (
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center text-xs font-medium text-primary pt-2">
                  💸 Charges sous contrôle, bien joué !
                </motion.p>
              )}
            </AnimatePresence>
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
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-3">
                <p className="text-sm font-medium text-primary">
                  {savingsSkipped ? '👍 Pas de souci, le mois prochain sera le bon !' : '🐷 Épargne planifiée, futur toi te remerciera !'}
                </p>
              </motion.div>
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
                  <button onClick={() => setSavingsSkipped(true)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                    Je ne peux pas épargner ce mois
                  </button>
                  <button onClick={handleConfirmSavings} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
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
