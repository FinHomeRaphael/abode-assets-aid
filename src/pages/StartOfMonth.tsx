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
    getBudgetsForMonth, scopedAccounts: accounts,
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

  // Available to budget = income - |savings net| - savings target - budgeted (same formula as Budgets page)
  const totalSavingsDeducted = Math.abs(monthSavingsNet);
  const savingsTarget = household.monthlySavingsTarget ?? 0;
  const availableAfterSavings = totalIncome - totalSavingsDeducted;

  // Budgets — use getBudgetsForMonth to only get budgets active for current month
  const budgetData = useMemo(() =>
    getBudgetsForMonth(now).filter(b => b.period === 'monthly').map(b => ({ ...b, spent: getBudgetSpent(b) })),
    [getBudgetsForMonth, getBudgetSpent]);

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

  // Month-level totals (all transactions, for hero summary)
  const totalMonthExpenses = useMemo(() =>
    monthTx.filter(t => t.type === 'expense' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0),
    [monthTx]);

  // Step completion
  const step1Done = recurringIncomes.length === 0 || recurringIncomes.every(t => checkedIncomes.has(t.id) || cancelledIncomes.has(t.id));
  const step2Done = recurringExpenses.length === 0 || recurringExpenses.every(t => checkedExpenses.has(t.id) || cancelledExpenses.has(t.id));
  const step3Done = debts.length === 0 || debts.every(d => checkedDebts.has(d.id));
  const remainingToBudget = availableAfterSavings - totalBudgetLimit - savingsTarget;
  const budgetCoverage = availableAfterSavings > 0 ? Math.round(((totalBudgetLimit + savingsTarget) / availableAfterSavings) * 100) : 0;
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

  const fade = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

  const Checkbox = ({ checked, cancelled, onClick, disabled }: { checked: boolean; cancelled?: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-all ${
        checked ? 'bg-primary border-primary text-primary-foreground' : cancelled ? 'border-destructive/40 bg-destructive/10' : 'border-border hover:border-primary/40'
      }`}
    >
      {checked && <Check className="w-2.5 h-2.5" />}
      {cancelled && <X className="w-2.5 h-2.5 text-destructive" />}
    </button>
  );

  const StepCard = ({ stepNum, title, subtitle, icon: Icon, done, total, children }: {
    stepNum: number; title: string; subtitle: string; icon: any; done: boolean; total: string; children: React.ReactNode;
  }) => (
    <motion.div variants={fade} className="rounded-2xl bg-card border border-border/50 overflow-hidden shadow-sm">
      {/* Step header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
            done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            {done ? <Check className="w-3 h-3" /> : stepNum}
          </div>
          <div>
            <p className="font-semibold text-[13px] flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 ${done ? 'text-primary' : 'text-muted-foreground'}`} />
              {title}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>
          </div>
        </div>
        <span className={`text-xs font-mono-amount font-semibold ${done ? 'text-primary' : 'text-muted-foreground'}`}>{total}</span>
      </div>
      {/* Divider */}
      <div className="h-px bg-border/40 mx-4" />
      {/* Content */}
      {children}
      {/* Done footer */}
      {done && (
        <div className="px-4 py-1.5 bg-primary/[0.04]">
          <p className="text-[10px] font-medium text-primary text-center">✓ Vérifié</p>
        </div>
      )}
    </motion.div>
  );

  const renderRecurringItem = (t: typeof recurringIncomes[0], type: 'income' | 'expense') => {
    const checked = type === 'income' ? checkedIncomes.has(t.id) : checkedExpenses.has(t.id);
    const cancelled = type === 'income' ? cancelledIncomes.has(t.id) : cancelledExpenses.has(t.id);
    const member = getMemberById(t.memberId);
    const isConfirmingCancel = confirmCancel === t.id;

    return (
      <div key={t.id} className={`px-4 py-2.5 transition-all ${cancelled ? 'opacity-40' : ''}`}>
        <div className="flex items-center gap-2.5">
          <Checkbox
            checked={checked}
            cancelled={cancelled}
            onClick={() => !cancelled && toggle(type === 'income' ? checkedIncomes : checkedExpenses, type === 'income' ? setCheckedIncomes : setCheckedExpenses, t.id)}
            disabled={cancelled}
          />
          <CategoryIcon category={t.category} size="sm" />
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-medium truncate ${cancelled ? 'line-through text-muted-foreground' : ''}`}>{t.label}</p>
            <p className="text-[10px] text-muted-foreground">Le {t.recurrenceDay || parseInt(t.date.split('-')[2])} · {t.category}{member ? ` · ${member.name}` : ''}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[13px] font-semibold font-mono-amount ${type === 'income' ? 'text-success' : 'text-destructive'}`}>
              {type === 'income' ? '+' : '-'}{formatAmount(t.convertedAmount)}
            </span>
            {!cancelled && !checked && (
              <button
                onClick={() => setConfirmCancel(isConfirmingCancel ? null : t.id)}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                ✕
              </button>
            )}
            {cancelled && (
              <span className="text-[9px] text-destructive/70 font-medium px-1 py-0.5 rounded bg-destructive/5">Annulé</span>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isConfirmingCancel && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 ml-7 p-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.03] space-y-2">
                <p className="text-[11px] text-destructive/80 font-medium">Arrêter cette récurrence pour ce mois ?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmCancel(null)} className="flex-1 py-1.5 rounded-lg border border-border text-[11px] font-medium hover:bg-muted transition-colors">Non</button>
                  <button onClick={() => handleCancelRecurring(t.id, type)} className="flex-1 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-[11px] font-semibold hover:bg-destructive/90 transition-colors">Oui</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const disponible = totalRecurringIncome - totalRecurringExpense - totalDebtPayments - totalBudgetLimit;

  return (
    <Layout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-2xl mx-auto space-y-3 pb-8">
        {/* Header */}
        <motion.div variants={fade}>
          <BackHeader title="Préparer mon mois" />
        </motion.div>

        {/* Hero progress card */}
        <motion.div variants={fade} className="rounded-2xl bg-card border border-border/50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Préparation</p>
              <p className="text-base font-bold capitalize mt-0.5">{monthLabel}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
              allDone ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {completedSteps}/{totalSteps}
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex gap-1.5">
            {steps.map((done, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
                <motion.div
                  className={`h-full rounded-full ${done ? 'bg-primary' : 'bg-transparent'}`}
                  initial={{ width: 0 }}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                />
              </div>
            ))}
          </div>

          {/* Summary row */}
          <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">Revenus</p>
              <p className="text-[13px] font-bold font-mono-amount text-success">+{formatAmount(totalIncome)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Dépenses</p>
              <p className="text-[13px] font-bold font-mono-amount text-destructive">-{formatAmount(totalMonthExpenses)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Reste à vivre</p>
              <p className={`text-[13px] font-bold font-mono-amount ${(totalIncome - totalMonthExpenses - totalSavingsDeducted) >= 0 ? 'text-foreground' : 'text-destructive'}`}>{formatAmount(totalIncome - totalMonthExpenses - totalSavingsDeducted)}</p>
            </div>
          </div>
        </motion.div>

        {/* Success banner */}
        <AnimatePresence>
          {allDone && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-primary/[0.06] border border-primary/20 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-primary">🚀 Mois bien préparé !</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Tout est vérifié et budgété pour {monthLabel}.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Revenus */}
        <StepCard stepNum={1} title="Revenus récurrents" subtitle="Confirme tes revenus attendus" icon={TrendingUp} done={step1Done} total={`+${formatAmount(totalRecurringIncome)}`}>
          <div className="divide-y divide-border/20">
            {recurringIncomes.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">Aucun revenu récurrent</p>
            ) : recurringIncomes.map(t => renderRecurringItem(t, 'income'))}
          </div>
        </StepCard>

        {/* Step 2: Charges */}
        <StepCard stepNum={2} title="Charges fixes" subtitle="Vérifie tes dépenses récurrentes" icon={TrendingDown} done={step2Done} total={`-${formatAmount(totalRecurringExpense)}`}>
          <div className="divide-y divide-border/20">
            {recurringExpenses.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">Aucune charge récurrente</p>
            ) : recurringExpenses.map(t => renderRecurringItem(t, 'expense'))}
          </div>
        </StepCard>

        {/* Step 3: Dettes */}
        <StepCard stepNum={3} title="Échéances dettes" subtitle="Confirme les paiements prévus" icon={CreditCard} done={step3Done} total={debts.length > 0 ? `-${formatAmount(totalDebtPayments)}` : '—'}>
          <div className="divide-y divide-border/20">
            {debts.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">Aucune dette enregistrée</p>
            ) : debts.map(d => {
              const checked = checkedDebts.has(d.id);
              const pctPaid = d.initialAmount > 0 ? Math.round(((d.initialAmount - d.remainingAmount) / d.initialAmount) * 100) : 0;
              return (
                <div key={d.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Checkbox checked={checked} onClick={() => toggle(checkedDebts, setCheckedDebts, d.id)} />
                    <span className="text-sm shrink-0">{getDebtEmoji(d.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{d.name}</p>
                      <p className="text-[10px] text-muted-foreground">Le {d.paymentDay} · {d.lender || d.type} · {pctPaid}%</p>
                    </div>
                    <span className="text-[13px] font-semibold text-destructive font-mono-amount shrink-0">-{formatAmount(d.paymentAmount, d.currency)}</span>
                  </div>
                  <div className="ml-7 mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pctPaid}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </StepCard>

        {/* Step 4: Budgets */}
        <StepCard stepNum={4} title="Budgets variables" subtitle="Alloue ton disponible à des budgets" icon={BarChart3} done={step4Done} total={budgetData.length > 0 ? formatAmount(totalBudgetLimit) : '—'}>
          {/* Budget summary breakdown */}
          <div className="mx-4 mt-2 mb-1 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/30">
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenus - Épargne</span>
                <span className="font-mono-amount font-medium">{formatAmount(availableAfterSavings)}</span>
              </div>
              {savingsTarget > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Objectif d'épargne</span>
                  <span className="font-mono-amount font-medium text-primary">-{formatAmount(savingsTarget)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Budgété</span>
                <span className="font-mono-amount font-medium text-primary">-{formatAmount(totalBudgetLimit)}</span>
              </div>
              <div className="h-px bg-border/40" />
              <div className="flex justify-between font-medium">
                <span className={remainingToBudget > 0 ? 'text-warning' : 'text-primary'}>
                  {remainingToBudget > 0 ? 'Non budgété' : 'Surplus budgété'}
                </span>
                <span className={`font-mono-amount font-semibold ${remainingToBudget > 0 ? 'text-warning' : 'text-primary'}`}>
                  {formatAmount(Math.abs(remainingToBudget))}
                </span>
              </div>
            </div>
          </div>

          {/* Status indicator */}
          {!isFullyCovered && availableAfterSavings > 0 && (
            <div className="mx-4 mt-1 mb-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/[0.06]">
              <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
              <p className="text-[10px] text-warning font-medium">{budgetCoverage}% du disponible couvert — crée des budgets pour atteindre 100%</p>
            </div>
          )}
          {isFullyCovered && budgetData.length > 0 && (
            <div className="mx-4 mt-1 mb-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/[0.04]">
              <Check className="w-3 h-3 text-primary shrink-0" />
              <p className="text-[10px] text-primary font-medium">Budget complet</p>
            </div>
          )}

          {/* Budget list */}
          {budgetData.length > 0 ? (
            <div className="px-4 py-2 space-y-2">
              {budgetData.map(b => {
                const pct = Math.min(Math.round((b.spent / b.limit) * 100), 100);
                const status = getBudgetStatus(b.spent, b.limit);
                return (
                  <div key={b.id} className="py-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[12px] font-medium">{b.emoji} {b.category}</p>
                      <span className="text-[11px] text-muted-foreground font-mono-amount">{formatAmount(b.spent)} / {formatAmount(b.limit)}</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${status === 'over' ? 'bg-destructive' : status === 'warning' ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {status === 'over' && (
                      <p className="text-[9px] text-destructive mt-0.5">Dépassé de {formatAmount(b.spent - b.limit)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 px-4">
              <p className="text-[12px] text-muted-foreground">Aucun budget configuré</p>
            </div>
          )}

          {/* Suggestions */}
          {budgetSuggestions.length > 0 && !isFullyCovered && (
            <div className="mx-4 mb-2 p-3 rounded-xl bg-muted/40 border border-border/30">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3 h-3 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Suggestions</p>
              </div>
              <div className="space-y-1">
                {budgetSuggestions.map(s => (
                  <button
                    key={s.category}
                    onClick={() => setShowAddBudget(true)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-card transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[12px]">{s.emoji}</span>
                      <span className="text-[11px] font-medium truncate">{s.category}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground font-mono-amount">~{formatAmount(s.suggestedAmount)}</span>
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Plus className="w-3 h-3 text-primary" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add button */}
          <div className="px-4 py-2.5 border-t border-border/30">
            <button
              onClick={() => setShowAddBudget(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-primary text-[12px] font-medium hover:bg-primary/[0.04] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Créer un budget
            </button>
          </div>
        </StepCard>
      </motion.div>
      <AddBudgetModal open={showAddBudget} onClose={() => setShowAddBudget(false)} />
    </Layout>
  );
};

export default StartOfMonth;
