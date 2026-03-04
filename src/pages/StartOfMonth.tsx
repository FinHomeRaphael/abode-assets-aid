import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import BackHeader from '@/components/BackHeader';
import { CategoryIcon } from '@/utils/categoryIcons';
import { Debt, getDebtEmoji } from '@/types/debt';
import { supabase } from '@/integrations/supabase/client';
import { getBudgetStatus } from '@/utils/format';
import { EXPENSE_CATEGORIES, CATEGORY_EMOJIS } from '@/types/finance';
import { TrendingUp, TrendingDown, CreditCard, BarChart3, Check, X, Plus, AlertTriangle, Lightbulb } from 'lucide-react';
import AddBudgetModal from '@/components/AddBudgetModal';

const STORAGE_KEY_PREFIX = 'finehome_start_month_';

interface ChecklistState {
  checkedIncomes: string[];
  checkedExpenses: string[];
  checkedDebts: string[];
  checkedBudgets: string[];
  cancelledIncomes: string[];
  cancelledExpenses: string[];
}

function loadChecklist(monthYear: string): ChecklistState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${monthYear}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { checkedIncomes: [], checkedExpenses: [], checkedDebts: [], checkedBudgets: [], cancelledIncomes: [], cancelledExpenses: [] };
}

function saveChecklist(monthYear: string, state: ChecklistState) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${monthYear}`, JSON.stringify(state));
}

const StartOfMonth = () => {
  const {
    scopedTransactions: transactions, household, session,
    scopedBudgets: budgets, getBudgetSpent, addBudget, getTransactionsForMonth,
    scopedAccounts: accounts,
    householdId, financeScope, getMemberById,
    softDeleteRecurringTransaction,
  } = useApp();
  const [showAddBudget, setShowAddBudget] = useState(false);
  const { formatAmount, currency } = useCurrency();
  const navigate = useNavigate();

  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now);
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Debts
  const [debts, setDebts] = useState<Debt[]>([]);
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

  // Recurring transactions
  const recurringIncomes = useMemo(() =>
    transactions.filter(t => t.isRecurring && !t.recurringSourceId && t.type === 'income' && (!t.recurringEndMonth || t.recurringEndMonth > monthYear)),
    [transactions, monthYear]);
  const recurringExpenses = useMemo(() =>
    transactions.filter(t => t.isRecurring && !t.recurringSourceId && t.type === 'expense' && (!t.recurringEndMonth || t.recurringEndMonth > monthYear)),
    [transactions, monthYear]);

  // Month transactions (for budget calculation matching Budgets page)
  const monthTx = useMemo(() => getTransactionsForMonth(now), [getTransactionsForMonth]);

  // Savings calculation (same as Budgets page)
  const savingsAccountIds = useMemo(() =>
    new Set(accounts.filter(a => (a.type === 'epargne' || a.type === 'pilier3a') && !a.isArchived).map(a => a.id)),
    [accounts]);
  const isSavingsTx = (t: typeof monthTx[0]) => !!(t.accountId && savingsAccountIds.has(t.accountId));
  const monthSavingsNet = useMemo(() => {
    const savingsTransferIn = monthTx.filter(t => t.type === 'income' && isSavingsTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
    const savingsTransferOut = monthTx.filter(t => t.type === 'expense' && isSavingsTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
    const savingsDirectIncome = monthTx.filter(t => t.type === 'income' && isSavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
    const savingsDirectExpenses = monthTx.filter(t => t.type === 'expense' && isSavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
    return (savingsTransferIn + savingsDirectIncome) - (savingsTransferOut + savingsDirectExpenses);
  }, [monthTx, savingsAccountIds]);

  // Total income (same as Budgets page)
  const totalIncome = useMemo(() =>
    monthTx.filter(t => t.type === 'income' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0),
    [monthTx]);

  // Available to budget = income - |savings net| - budgeted (same formula as Budgets page)
  const totalSavingsDeducted = Math.abs(monthSavingsNet);
  const availableAfterSavings = totalIncome - totalSavingsDeducted;

  // Budgets
  const budgetData = useMemo(() =>
    budgets.filter(b => b.period === 'monthly').map(b => ({ ...b, spent: getBudgetSpent(b) })),
    [budgets, getBudgetSpent]);

  // Checklist state
  const initial = useMemo(() => loadChecklist(monthYear), [monthYear]);
  const [checkedIncomes, setCheckedIncomes] = useState<Set<string>>(() => new Set(initial.checkedIncomes));
  const [checkedExpenses, setCheckedExpenses] = useState<Set<string>>(() => new Set(initial.checkedExpenses));
  const [checkedDebts, setCheckedDebts] = useState<Set<string>>(() => new Set(initial.checkedDebts));
  const [checkedBudgets, setCheckedBudgets] = useState<Set<string>>(() => new Set(initial.checkedBudgets));
  const [cancelledIncomes, setCancelledIncomes] = useState<Set<string>>(() => new Set(initial.cancelledIncomes));
  const [cancelledExpenses, setCancelledExpenses] = useState<Set<string>>(() => new Set(initial.cancelledExpenses));
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  // Persist
  useEffect(() => {
    saveChecklist(monthYear, {
      checkedIncomes: Array.from(checkedIncomes),
      checkedExpenses: Array.from(checkedExpenses),
      checkedDebts: Array.from(checkedDebts),
      checkedBudgets: Array.from(checkedBudgets),
      cancelledIncomes: Array.from(cancelledIncomes),
      cancelledExpenses: Array.from(cancelledExpenses),
    });
  }, [monthYear, checkedIncomes, checkedExpenses, checkedDebts, checkedBudgets, cancelledIncomes, cancelledExpenses]);

  const toggle = (set: Set<string>, setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCancelRecurring = (id: string, type: 'income' | 'expense') => {
    softDeleteRecurringTransaction(id, monthYear);
    const cancelSetter = type === 'income' ? setCancelledIncomes : setCancelledExpenses;
    cancelSetter(prev => new Set(prev).add(id));
    setConfirmCancel(null);
  };

  // Totals (computed before step completion checks)
  const totalRecurringIncome = recurringIncomes.filter(t => !cancelledIncomes.has(t.id)).reduce((s, t) => s + t.convertedAmount, 0);
  const totalRecurringExpense = recurringExpenses.filter(t => !cancelledExpenses.has(t.id)).reduce((s, t) => s + t.convertedAmount, 0);
  const totalDebtPayments = debts.reduce((s, d) => s + d.paymentAmount, 0);
  const totalBudgetLimit = budgetData.reduce((s, b) => s + b.limit, 0);

  // Step completion
  const step1Done = recurringIncomes.length === 0 || recurringIncomes.every(t => checkedIncomes.has(t.id) || cancelledIncomes.has(t.id));
  const step2Done = recurringExpenses.length === 0 || recurringExpenses.every(t => checkedExpenses.has(t.id) || cancelledExpenses.has(t.id));
  const step3Done = debts.length === 0 || debts.every(d => checkedDebts.has(d.id));
  const remainingToBudget = availableAfterSavings - totalBudgetLimit;
  const budgetCoverage = availableAfterSavings > 0 ? Math.round((totalBudgetLimit / availableAfterSavings) * 100) : 0;
  const isFullyCovered = remainingToBudget <= 0 || budgetCoverage >= 95;
  const step4Done = budgetData.length > 0 && isFullyCovered;

  const steps = [step1Done, step2Done, step3Done, step4Done];
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps = 4;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);
  const allDone = completedSteps === totalSteps;

  // Budget suggestions: categories with spending but no budget
  const budgetedCategories = useMemo(() => new Set(budgetData.map(b => b.category)), [budgetData]);
  const budgetSuggestions = useMemo(() => {
    const expenseTx = monthTx.filter(t => t.type === 'expense' && t.category !== 'Transfert');
    const catSpent = new Map<string, number>();
    expenseTx.forEach(t => {
      if (!budgetedCategories.has(t.category)) {
        catSpent.set(t.category, (catSpent.get(t.category) || 0) + t.convertedAmount);
      }
    });
    // Add debt suggestion if no debt budget exists
    if (!budgetedCategories.has('Dettes') && totalDebtPayments > 0) {
      catSpent.set('Dettes', totalDebtPayments);
    }
    return Array.from(catSpent.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, spent]) => ({
        category: cat,
        spent,
        emoji: CATEGORY_EMOJIS[cat] || '📌',
        suggestedAmount: cat === 'Dettes' ? totalDebtPayments : Math.round(spent),
      }));
  }, [monthTx, budgetedCategories, totalDebtPayments]);

  const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

  const Checkbox = ({ checked, cancelled, onClick, disabled }: { checked: boolean; cancelled?: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
        checked ? 'bg-primary border-primary text-primary-foreground' : cancelled ? 'border-destructive/40 bg-destructive/10' : 'border-border hover:border-primary/50'
      }`}
    >
      {checked && <Check className="w-3 h-3" />}
      {cancelled && <X className="w-3 h-3 text-destructive" />}
    </button>
  );

  const StepHeader = ({ stepNum, title, subtitle, icon: Icon, done, total }: { stepNum: number; title: string; subtitle: string; icon: any; done: boolean; total: string }) => (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-border/50 ${done ? 'bg-primary/5' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          {done ? <Check className="w-3.5 h-3.5" /> : stepNum}
        </div>
        <div>
          <p className="font-semibold text-sm flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-primary" />
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <span className="text-xs font-mono-amount font-semibold text-muted-foreground">{total}</span>
    </div>
  );

  const renderRecurringItem = (t: typeof recurringIncomes[0], type: 'income' | 'expense') => {
    const checked = type === 'income' ? checkedIncomes.has(t.id) : checkedExpenses.has(t.id);
    const cancelled = type === 'income' ? cancelledIncomes.has(t.id) : cancelledExpenses.has(t.id);
    const member = getMemberById(t.memberId);
    const isConfirmingCancel = confirmCancel === t.id;

    return (
      <div key={t.id} className={`px-4 py-2.5 transition-colors ${cancelled ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={checked}
            cancelled={cancelled}
            onClick={() => !cancelled && toggle(type === 'income' ? checkedIncomes : checkedExpenses, type === 'income' ? setCheckedIncomes : setCheckedExpenses, t.id)}
            disabled={cancelled}
          />
          <CategoryIcon category={t.category} size="sm" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${cancelled ? 'line-through text-muted-foreground' : ''}`}>{t.label}</p>
            <p className="text-[11px] text-muted-foreground">Le {t.recurrenceDay || parseInt(t.date.split('-')[2])} · {t.category}{member ? ` · ${member.name}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-sm font-semibold font-mono-amount ${type === 'income' ? 'text-success' : 'text-destructive'}`}>
              {type === 'income' ? '+' : '-'}{formatAmount(t.convertedAmount)}
            </span>
            {!cancelled && !checked && (
              <button
                onClick={() => setConfirmCancel(isConfirmingCancel ? null : t.id)}
                className="text-[10px] font-medium px-1.5 py-1 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
              >
                Annuler
              </button>
            )}
            {cancelled && (
              <span className="text-[10px] text-destructive font-medium px-1.5 py-0.5 rounded-md bg-destructive/10">Annulé</span>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isConfirmingCancel && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 ml-8 p-2.5 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                <p className="text-xs text-destructive font-medium">Arrêter cette récurrence à partir de ce mois ?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmCancel(null)} className="flex-1 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">Non</button>
                  <button onClick={() => handleCancelRecurring(t.id, type)} className="flex-1 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-colors">Oui, arrêter</button>
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
      <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-2xl mx-auto space-y-4 pb-6">
        {/* Header */}
        <motion.div variants={fade}>
          <BackHeader title="🗓️ Préparer mon mois" />
          <p className="text-sm text-muted-foreground capitalize -mt-2">{monthLabel}</p>
        </motion.div>

        {/* Progress */}
        <motion.div variants={fade} className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Progression</span>
            <span className="font-bold text-primary">{completedSteps}/{totalSteps} étapes</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
          </div>
        </motion.div>

        {/* Success */}
        <AnimatePresence>
          {allDone && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-primary/5 border-2 border-primary/30 p-5 text-center">
              <p className="text-3xl mb-2">🚀</p>
              <p className="font-bold text-lg">Mois bien préparé !</p>
              <p className="text-sm text-muted-foreground mt-1">Tout est vérifié pour {monthLabel}.</p>
              <div className="mt-3 p-3 rounded-xl bg-card border border-border">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-left">
                    <p className="text-[11px] text-muted-foreground">Revenus attendus</p>
                    <p className="font-semibold text-success font-mono-amount">+{formatAmount(totalRecurringIncome)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] text-muted-foreground">Sorties prévues</p>
                    <p className="font-semibold text-destructive font-mono-amount">-{formatAmount(totalRecurringExpense + totalDebtPayments)}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border/50 flex justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Disponible estimé</span>
                  <span className={`text-sm font-bold font-mono-amount ${(totalRecurringIncome - totalRecurringExpense - totalDebtPayments - totalBudgetLimit) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatAmount(totalRecurringIncome - totalRecurringExpense - totalDebtPayments - totalBudgetLimit)}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Revenus récurrents */}
        <motion.div variants={fade} className="rounded-2xl bg-card border border-border overflow-hidden">
          <StepHeader stepNum={1} title="Revenus récurrents" subtitle="Confirme tes revenus attendus ce mois" icon={TrendingUp} done={step1Done} total={`+${formatAmount(totalRecurringIncome)}`} />
          <div className="divide-y divide-border/30">
            {recurringIncomes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun revenu récurrent configuré</p>
            ) : recurringIncomes.map(t => renderRecurringItem(t, 'income'))}
          </div>
          {step1Done && recurringIncomes.length > 0 && (
            <div className="px-4 py-2 bg-primary/5 text-center">
              <p className="text-xs font-medium text-primary">✓ Revenus vérifiés</p>
            </div>
          )}
        </motion.div>

        {/* Step 2: Charges fixes */}
        <motion.div variants={fade} className="rounded-2xl bg-card border border-border overflow-hidden">
          <StepHeader stepNum={2} title="Charges fixes" subtitle="Vérifie tes dépenses récurrentes" icon={TrendingDown} done={step2Done} total={`-${formatAmount(totalRecurringExpense)}`} />
          <div className="divide-y divide-border/30">
            {recurringExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune charge récurrente configurée</p>
            ) : recurringExpenses.map(t => renderRecurringItem(t, 'expense'))}
          </div>
          {step2Done && recurringExpenses.length > 0 && (
            <div className="px-4 py-2 bg-primary/5 text-center">
              <p className="text-xs font-medium text-primary">✓ Charges vérifiées</p>
            </div>
          )}
        </motion.div>

        {/* Step 3: Échéances dettes */}
        <motion.div variants={fade} className="rounded-2xl bg-card border border-border overflow-hidden">
          <StepHeader stepNum={3} title="Échéances dettes" subtitle="Confirme les paiements prévus ce mois" icon={CreditCard} done={step3Done} total={debts.length > 0 ? `-${formatAmount(totalDebtPayments)}` : '—'} />
          <div className="divide-y divide-border/30">
            {debts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune dette enregistrée</p>
            ) : debts.map(d => {
              const checked = checkedDebts.has(d.id);
              const pctPaid = d.initialAmount > 0 ? Math.round(((d.initialAmount - d.remainingAmount) / d.initialAmount) * 100) : 0;
              return (
                <div key={d.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={checked} onClick={() => toggle(checkedDebts, setCheckedDebts, d.id)} />
                    <span className="text-base shrink-0">{getDebtEmoji(d.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground">Le {d.paymentDay} · {d.lender || d.type} · {pctPaid}% remboursé</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive font-mono-amount shrink-0">-{formatAmount(d.paymentAmount, d.currency)}</span>
                  </div>
                  <div className="ml-8 mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pctPaid}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {step3Done && debts.length > 0 && (
            <div className="px-4 py-2 bg-primary/5 text-center">
              <p className="text-xs font-medium text-primary">✓ Échéances confirmées</p>
            </div>
          )}
        </motion.div>

        <motion.div variants={fade} className="rounded-2xl bg-card border border-border overflow-hidden">
          <StepHeader stepNum={4} title="Budgets variables" subtitle="Alloue ton disponible à des budgets" icon={BarChart3} done={step4Done} total={budgetData.length > 0 ? formatAmount(totalBudgetLimit) : '—'} />
          
          {/* Unbudgeted warning */}
          {!isFullyCovered && availableAfterSavings > 0 && (
            <div className="px-4 py-3 bg-warning/10 border-b border-warning/20">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-warning">
                    {formatAmount(remainingToBudget)} reste à budgéter
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tes budgets couvrent {budgetCoverage}% de ton disponible ({formatAmount(availableAfterSavings)}).
                  </p>
                </div>
              </div>
            </div>
          )}
          {isFullyCovered && budgetData.length > 0 && (
            <div className="px-4 py-3 bg-success/10 border-b border-success/20">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-success shrink-0" />
                <p className="text-sm font-medium text-success">Budget complet ! Tout ton disponible est alloué.</p>
              </div>
            </div>
          )}

          {/* Existing budgets (read-only, no checkboxes) */}
          {budgetData.length > 0 && (
            <div className="divide-y divide-border/30">
              {budgetData.map(b => {
                const pct = Math.min(Math.round((b.spent / b.limit) * 100), 100);
                const status = getBudgetStatus(b.spent, b.limit);
                return (
                  <div key={b.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{b.emoji} {b.category}</p>
                      <span className="text-xs text-muted-foreground font-mono-amount">{formatAmount(b.spent)} / {formatAmount(b.limit)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${status === 'over' ? 'bg-destructive' : status === 'warning' ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {status === 'over' && (
                      <p className="text-[10px] text-destructive mt-1">⚠️ Dépassé de {formatAmount(b.spent - b.limit)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {budgetData.length === 0 && (
            <div className="text-center py-4 px-4">
              <p className="text-sm text-muted-foreground">Aucun budget configuré</p>
              <p className="text-xs text-muted-foreground mt-1">Crée des budgets pour suivre tes dépenses variables</p>
            </div>
          )}

          {/* Budget suggestions */}
          {budgetSuggestions.length > 0 && !isFullyCovered && (
            <div className="px-4 py-3 border-t border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground">Suggestions</p>
              </div>
              <div className="space-y-2">
                {budgetSuggestions.map(s => (
                  <button
                    key={s.category}
                    onClick={() => setShowAddBudget(true)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/50 hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">{s.emoji}</span>
                      <span className="text-xs font-medium truncate">{s.category}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground font-mono-amount">~{formatAmount(s.suggestedAmount)}</span>
                      <Plus className="w-3.5 h-3.5 text-primary" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add budget button */}
          <div className="px-4 py-3 border-t border-border/50">
            <button
              onClick={() => setShowAddBudget(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Créer un budget
            </button>
          </div>

          {step4Done && (
            <div className="px-4 py-2 bg-primary/5 text-center border-t border-border/30">
              <p className="text-xs font-medium text-primary">✓ Budgets complets</p>
            </div>
          )}
        </motion.div>

        {/* Summary card */}
        <motion.div variants={fade} className="rounded-2xl bg-muted/50 border border-border p-4">
          <p className="text-sm font-semibold mb-3">📊 Résumé prévisionnel</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revenus récurrents</span>
              <span className="font-medium text-success font-mono-amount">+{formatAmount(totalRecurringIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Charges fixes</span>
              <span className="font-medium text-destructive font-mono-amount">-{formatAmount(totalRecurringExpense)}</span>
            </div>
            {debts.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Échéances dettes</span>
                <span className="font-medium text-destructive font-mono-amount">-{formatAmount(totalDebtPayments)}</span>
              </div>
            )}
            {budgetData.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Budgets variables</span>
                <span className="font-medium font-mono-amount">-{formatAmount(totalBudgetLimit)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-border/50 flex justify-between">
              <span className="font-semibold">Disponible estimé</span>
              <span className={`font-bold font-mono-amount ${(totalRecurringIncome - totalRecurringExpense - totalDebtPayments - totalBudgetLimit) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatAmount(totalRecurringIncome - totalRecurringExpense - totalDebtPayments - totalBudgetLimit)}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
      <AddBudgetModal open={showAddBudget} onClose={() => setShowAddBudget(false)} />
    </Layout>
  );
};

export default StartOfMonth;
