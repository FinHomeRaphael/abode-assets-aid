import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatDateLong } from '@/utils/format';
import { getBudgetStatus } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_EMOJIS, DEFAULT_EXCHANGE_RATES } from '@/types/finance';
import { getPeriodsPerYear, getDebtEmoji, PaymentFrequency } from '@/types/debt';
import { toast } from 'sonner';
import { PaywallModal } from '@/components/PremiumPaywall';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { Plus, X, ChevronDown, ChevronUp, TrendingUp, Wallet, AlertTriangle, CheckCircle, PieChart, Lightbulb, ArrowRight, Target, Pencil, PartyPopper, CircleAlert, CircleCheck, Clock, Trash2, StopCircle, CreditCard, Info, Minus, Equal } from 'lucide-react';
import { CategoryIcon, getCategoryIcon } from '@/utils/categoryIcons';
import { supabase } from '@/integrations/supabase/client';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const Budgets = () => {
  const { scopedBudgets: budgets, addBudget, updateBudget, getBudgetSpent, deleteBudget, softDeleteBudget, getBudgetsForMonth, getTransactionsForMonth, getMemberById, householdId, currentUser, customCategories, scopedAccounts: accounts, household, financeScope, session } = useApp();
  const { canAdd } = useSubscription(householdId, currentUser?.id);
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [formulaExpanded, setFormulaExpanded] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  // Create modal state
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newIsRecurring, setNewIsRecurring] = useState(true);
  const [newAlerts, setNewAlerts] = useState(true);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<typeof budgets[0] | null>(null);
  const [editLimit, setEditLimit] = useState('');
  const [editIsRecurring, setEditIsRecurring] = useState(true);
  const [editAlerts, setEditAlerts] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<typeof budgets[0] | null>(null);

  // Savings target state
  const [showSavingsTargetEdit, setShowSavingsTargetEdit] = useState(false);
  const [savingsTargetInput, setSavingsTargetInput] = useState('');

  const savingsTarget = household.monthlySavingsTarget;

  // === Debt monthly total for budget suggestion ===
  const [debtMonthlyTotal, setDebtMonthlyTotal] = useState(0);

  useEffect(() => {
    if (!householdId) return;
    const fetchDebtTotal = async () => {
      const userId = session?.user?.id;
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Fetch debts for scope filtering
      let debtQuery = supabase.from('debts').select('id, currency, payment_amount, payment_frequency, has_schedule');
      if (financeScope === 'personal') {
        debtQuery = debtQuery.eq('scope', 'personal').eq('created_by', userId);
      } else {
        debtQuery = debtQuery.eq('household_id', householdId).eq('scope', 'household');
      }
      const { data: debtsData } = await debtQuery;
      if (!debtsData || debtsData.length === 0) { setDebtMonthlyTotal(0); return; }

      const baseCurrency = household.currency;
      const convert = (amount: number, from: string) => {
        if (from === baseCurrency) return amount;
        const fromToEur = DEFAULT_EXCHANGE_RATES[from] || 1;
        const mainToEur = DEFAULT_EXCHANGE_RATES[baseCurrency] || 1;
        return amount * (fromToEur / mainToEur);
      };

      // Debts WITH schedules: sum from debt_schedules
      const debtsWithSchedule = debtsData.filter((d: any) => d.has_schedule !== false);
      const debtsWithoutSchedule = debtsData.filter((d: any) => d.has_schedule === false);

      let total = 0;

      if (debtsWithSchedule.length > 0) {
        const debtIds = debtsWithSchedule.map((d: any) => d.id);
        const debtCurrencyMap = new Map(debtsWithSchedule.map((d: any) => [d.id, d.currency]));

        const { data: schedules } = await supabase
          .from('debt_schedules')
          .select('debt_id, total_amount')
          .in('debt_id', debtIds)
          .gte('due_date', monthStart)
          .lte('due_date', monthEnd);

        if (schedules) {
          for (const s of schedules) {
            const cur = debtCurrencyMap.get(s.debt_id) || baseCurrency;
            total += convert(Number(s.total_amount), cur);
          }
        }
      }

      // Debts WITHOUT schedules: use payment_amount if monthly payment is due this month
      for (const d of debtsWithoutSchedule) {
        const freq = (d as any).payment_frequency || 'monthly';
        // For monthly debts, always add; for others, check if payment falls this month
        if (freq === 'monthly') {
          total += convert(Number((d as any).payment_amount) || 0, (d as any).currency || baseCurrency);
        }
      }

      setDebtMonthlyTotal(Math.round(total * 100) / 100);
    };
    fetchDebtTotal();
  }, [householdId, financeScope, session?.user?.id, household.currency]);

  const handleSaveSavingsTarget = async () => {
    const value = parseFloat(savingsTargetInput);
    if (isNaN(value) || value <= 0) { toast.error('Montant invalide'); return; }
    await supabase.from('households').update({ monthly_savings_target: value } as any).eq('id', householdId);
    // Optimistic update via household reference
    (household as any).monthlySavingsTarget = value;
    setShowSavingsTargetEdit(false);
    toast.success('Objectif d\'épargne mis à jour');
  };

  const handleRemoveSavingsTarget = async () => {
    await supabase.from('households').update({ monthly_savings_target: null } as any).eq('id', householdId);
    (household as any).monthlySavingsTarget = null;
    setShowSavingsTargetEdit(false);
    toast.success('Objectif supprimé');
  };

  const currentMonthYear = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = useMemo(() => getTransactionsForMonth(currentMonth), [currentMonth, getTransactionsForMonth]);
  const filteredBudgets = useMemo(() => {
    return getBudgetsForMonth(currentMonth).filter(b => b.period === 'monthly');
  }, [getBudgetsForMonth, currentMonth]);

  // === Income calculations ===
  const incomeTransactions = useMemo(() => {
    return monthTx.filter(t => t.type === 'income' && t.category !== 'Transfert');
  }, [monthTx]);

  const totalIncome = useMemo(() => {
    return incomeTransactions.reduce((s, t) => s + t.convertedAmount, 0);
  }, [incomeTransactions]);

  const incomeByCategory = useMemo(() => {
    const map = new Map<string, { emoji: string; total: number }>();
    incomeTransactions.forEach(t => {
      const existing = map.get(t.category) || { emoji: CATEGORY_EMOJIS[t.category] || t.emoji, total: 0 };
      existing.total += t.convertedAmount;
      map.set(t.category, existing);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [incomeTransactions]);

  // === Budget calculations ===
  // === Savings tracking (same logic as Transactions page) ===
  const savingsAccountIds = useMemo(() => {
    return new Set(accounts.filter(a => (a.type === 'epargne' || a.type === 'pilier3a') && !a.isArchived).map(a => a.id));
  }, [accounts]);

  const isSavingsTx = (t: typeof monthTx[0]) => !!(t.accountId && savingsAccountIds.has(t.accountId));

  const monthSavingsNet = useMemo(() => {
    const savingsTransferIn = monthTx.filter(t => t.type === 'income' && isSavingsTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
    const savingsTransferOut = monthTx.filter(t => t.type === 'expense' && isSavingsTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
    const savingsDirectIncome = monthTx.filter(t => t.type === 'income' && isSavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
    const savingsDirectExpenses = monthTx.filter(t => t.type === 'expense' && isSavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
    return (savingsTransferIn + savingsDirectIncome) - (savingsTransferOut + savingsDirectExpenses);
  }, [monthTx, savingsAccountIds]);

  // monthSavingsAmount for Épargne budget tracking (income side only)
  const monthSavingsAmount = useMemo(() => {
    return monthTx
      .filter(t => t.type === 'income' && t.accountId && savingsAccountIds.has(t.accountId) && t.category === 'Transfert')
      .reduce((s, t) => s + t.convertedAmount, 0);
  }, [monthTx, savingsAccountIds]);

  const EPARGNE_CATEGORY = 'Épargne';

  // Override getBudgetSpent for Épargne category
  const getSpentForBudget = (b: typeof budgets[0]) => {
    if (b.category === EPARGNE_CATEGORY) {
      return monthSavingsAmount;
    }
    return getBudgetSpent(b, currentMonth);
  };

  const totalBudgeted = useMemo(() => {
    return filteredBudgets.reduce((s, b) => s + b.limit, 0);
  }, [filteredBudgets]);

  // Available to budget = income - max(savings target, actual savings) - budgeted
  // In personal scope, savings target is not used (it's a household concept)
  const isHouseholdScope = financeScope === 'household';
  const effectiveSavingsTarget = isHouseholdScope ? (savingsTarget ?? 0) : 0;
  const totalSavingsDeducted = Math.abs(monthSavingsNet);
  const savingsDeduction = Math.max(effectiveSavingsTarget, totalSavingsDeducted);
  const totalAllocated = totalBudgeted + savingsDeduction;
  const remainingToBudget = totalIncome - totalAllocated;
  const budgetPercentage = totalIncome > 0 ? Math.min((totalAllocated / totalIncome) * 100, 100) : 0;

  // === 3-month average spending per category ===
  const avg3MonthByCategory = useMemo(() => {
    const map = new Map<string, number[]>();
    for (let offset = 0; offset < 3; offset++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - offset, 1);
      const txMonth = getTransactionsForMonth(d);
      const catTotals = new Map<string, number>();
      txMonth.filter(t => t.type === 'expense' && t.category !== 'Transfert').forEach(t => {
        catTotals.set(t.category, (catTotals.get(t.category) || 0) + t.convertedAmount);
      });
      catTotals.forEach((total, cat) => {
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(total);
      });
    }
    const result = new Map<string, number>();
    map.forEach((values, cat) => {
      result.set(cat, Math.round(values.reduce((a, b) => a + b, 0) / values.length));
    });
    return result;
  }, [currentMonth, getTransactionsForMonth]);

  // === Categories without budget ===
  const allExpenseCategories = useMemo(() => {
    const base = [...EXPENSE_CATEGORIES];
    const customs = customCategories.filter(c => c.type === 'expense').map(c => c.name);
    return [...base, ...customs].filter(c => c !== EPARGNE_CATEGORY);
  }, [customCategories]);

  const budgetedCategories = new Set(filteredBudgets.map(b => b.category));

  const categoriesWithoutBudget = useMemo(() => {
    const expenseTx = monthTx.filter(t => t.type === 'expense' && t.category !== 'Transfert');
    const catSpent = new Map<string, number>();
    expenseTx.forEach(t => {
      if (!budgetedCategories.has(t.category)) {
        catSpent.set(t.category, (catSpent.get(t.category) || 0) + t.convertedAmount);
      }
    });
    // Also include categories from 3-month average that have no current spending but had past spending
    avg3MonthByCategory.forEach((avg, cat) => {
      if (!budgetedCategories.has(cat) && !catSpent.has(cat) && cat !== 'Transfert') {
        catSpent.set(cat, 0);
      }
    });
    return Array.from(catSpent.entries())
      .sort((a, b) => {
        // Sort by suggested budget (avg or spent) descending
        const aSugg = avg3MonthByCategory.get(a[0]) || a[1];
        const bSugg = avg3MonthByCategory.get(b[0]) || b[1];
        return bSugg - aSugg;
      })
      .map(([cat, spent]) => ({
        category: cat,
        spent,
        emoji: CATEGORY_EMOJIS[cat] || '📌',
        suggestedBudget: avg3MonthByCategory.get(cat) || Math.round(spent),
      }));
  }, [monthTx, budgetedCategories, monthSavingsAmount, avg3MonthByCategory]);

  // === Available categories for create modal (exclude already budgeted) ===
  const availableCategories = allExpenseCategories.filter(c => !budgetedCategories.has(c));

  // === Handlers ===
  const handleAddIncome = () => {
    navigate('/transactions', { state: { openModal: true, preselectedType: 'income' } });
  };

  const handleCreate = () => {
    if (!newCategory || !newLimit) { toast.error('Remplissez tous les champs'); return; }
    const isDebt = newCategory === 'Dettes';
    const effectiveRecurring = isDebt ? false : newIsRecurring;
    const monthYear = effectiveRecurring ? undefined : currentMonthYear;
    addBudget({
      category: newCategory,
      limit: parseFloat(newLimit),
      period: 'monthly',
      emoji: CATEGORY_EMOJIS[newCategory] || '📌',
      alertsEnabled: newAlerts,
      recurring: effectiveRecurring,
      isRecurring: effectiveRecurring,
      monthYear,
      startMonth: currentMonthYear,
    });
    setShowCreate(false);
    setNewCategory('');
    setNewLimit('');
  };

  const handleCreateFromSuggestion = (category: string, suggestedAmount?: number) => {
    setNewCategory(category);
    setNewLimit(suggestedAmount ? String(suggestedAmount) : '');
    setShowCreate(true);
  };

  const openEditModal = (b: typeof budgets[0]) => {
    setEditTarget(b);
    setEditLimit(String(b.limit));
    setEditIsRecurring(b.isRecurring);
    setEditAlerts(b.alertsEnabled);
  };

  const handleSaveEdit = () => {
    if (!editTarget || !editLimit) return;
    updateBudget(editTarget.id, { limit: parseFloat(editLimit), isRecurring: editIsRecurring, alertsEnabled: editAlerts });
    setEditTarget(null);
  };

  const handleDeleteFromEdit = () => { if (!editTarget) return; setDeleteTarget(editTarget); setEditTarget(null); };
  const handleSoftDelete = () => { if (!deleteTarget) return; softDeleteBudget(deleteTarget.id); setDeleteTarget(null); };
  const handleHardDelete = () => { if (!deleteTarget) return; deleteBudget(deleteTarget.id); setDeleteTarget(null); };

  const getProgressColor = (pct: number) => {
    if (pct > 100) return 'bg-destructive';
    if (pct >= 100) return 'bg-emerald-700';
    if (pct >= 80) return 'bg-warning';
    return 'bg-success';
  };

  const getStatusIcon = (pct: number) => {
    if (pct > 100) return <CircleAlert className="w-4 h-4 text-destructive" />;
    if (pct >= 80) return <AlertTriangle className="w-4 h-4 text-warning" />;
    return <CircleCheck className="w-4 h-4 text-success" />;
  };

  const formatMonth = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(parseInt(y), parseInt(m) - 1));
  };

  const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

  // Overall budget health stats
  const totalSpent = useMemo(() => filteredBudgets.reduce((s, b) => s + getSpentForBudget(b), 0), [filteredBudgets, getSpentForBudget]);
  const overBudgetCount = filteredBudgets.filter(b => getSpentForBudget(b) > b.limit).length;
  const onTrackCount = filteredBudgets.filter(b => {
    const pct = b.limit > 0 ? (getSpentForBudget(b) / b.limit) * 100 : 0;
    return pct <= 80;
  }).length;

  return (
    <Layout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5 pb-4">

        {/* Header */}
        <motion.div variants={fade} className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Gestion</p>
            <h1 className="text-lg font-bold tracking-tight">Budgets</h1>
          </div>
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </motion.div>

        {/* Hero card — Available to budget */}
        <motion.div variants={fade}>
          <div className={`w-full text-left bg-primary p-6 shadow-lg shadow-primary/20 rounded-2xl`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-primary-foreground/70">Disponible à budgéter</span>
              <Wallet className="w-4 h-4 text-primary-foreground/50" />
            </div>
            <p className="text-4xl font-bold font-mono-amount tracking-tight text-primary-foreground">
              {formatAmount(Math.max(remainingToBudget, 0))}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-1.5 bg-primary-foreground/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${remainingToBudget < 0 ? 'bg-destructive' : 'bg-primary-foreground/60'}`}
                />
              </div>
              <span className="text-xs text-primary-foreground/60 font-mono-amount">{Math.round(budgetPercentage)}%</span>
            </div>
            {/* Formula breakdown toggle */}
            <button
              onClick={() => setFormulaExpanded(!formulaExpanded)}
              className="flex items-center gap-1 mt-3 text-primary-foreground/60 hover:text-primary-foreground/80 transition-colors"
            >
              <Info className="w-3 h-3" />
              <span className="text-[10px]">Comment c'est calculé ?</span>
              {formulaExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <AnimatePresence>
              {formulaExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 bg-primary-foreground/10 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-primary-foreground/80">
                      <span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Revenus</span>
                      <span className="font-mono-amount font-semibold">{formatAmount(totalIncome)}</span>
                    </div>
                    {savingsDeduction > 0 && (
                      <div className="flex items-center justify-between text-xs text-primary-foreground/80">
                        <span className="flex items-center gap-1.5"><Target className="w-3 h-3" /> {totalSavingsDeducted > effectiveSavingsTarget ? 'Épargne réelle' : 'Objectif d\'épargne'}</span>
                        <span className="font-mono-amount font-semibold">- {formatAmount(savingsDeduction)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-primary-foreground/80">
                      <span className="flex items-center gap-1.5"><Minus className="w-3 h-3" /> Budgété</span>
                      <span className="font-mono-amount font-semibold">- {formatAmount(totalBudgeted)}</span>
                    </div>
                    <div className="border-t border-primary-foreground/20 pt-1.5 flex items-center justify-between text-xs text-primary-foreground font-bold">
                      <span className="flex items-center gap-1.5"><Equal className="w-3 h-3" /> Disponible</span>
                      <span className="font-mono-amount">{formatAmount(remainingToBudget)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {remainingToBudget < 0 && totalIncome > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Dépassement de {formatAmount(Math.abs(remainingToBudget))}</span>
              </div>
            )}
            {remainingToBudget === 0 && totalIncome > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <CheckCircle className="w-3.5 h-3.5 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Tout est budgété !</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Summary stat cards */}
        <motion.div variants={fade} className="grid grid-cols-3 gap-1.5">
          <div className="bg-card border border-border/30 rounded-xl p-3 text-center">
            <TrendingUp className="w-3.5 h-3.5 text-success mx-auto mb-1" />
            <p className="text-[9px] text-muted-foreground mb-0.5">Revenus</p>
            <p className="font-mono-amount font-bold text-success text-xs">{formatAmount(totalIncome)}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-xl p-3 text-center">
            <PieChart className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
            <p className="text-[9px] text-muted-foreground mb-0.5">Budgété</p>
            <p className="font-mono-amount font-bold text-foreground text-xs">{formatAmount(totalAllocated)}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-xl p-3 text-center">
            <Wallet className={`w-3.5 h-3.5 mx-auto mb-1 ${monthSavingsNet >= 0 ? 'text-success' : 'text-destructive'}`} />
            <p className="text-[9px] text-muted-foreground mb-0.5">Épargne</p>
            <p className={`font-mono-amount font-bold text-xs ${monthSavingsNet >= 0 ? 'text-success' : 'text-destructive'}`}>{formatAmount(totalSavingsDeducted)}</p>
          </div>
        </motion.div>

        {/* Income detail — collapsible */}
        <motion.div variants={fade} className="bg-card border border-border/30 rounded-2xl overflow-hidden">
          <button
            onClick={() => setIncomeExpanded(!incomeExpanded)}
            className="w-full px-4 py-3.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Revenus du mois</p>
                <p className="text-base font-bold font-mono-amount">{formatAmount(totalIncome)}</p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${incomeExpanded ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {incomeExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-1.5">
                  {incomeByCategory.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Aucun revenu ce mois</p>
                  ) : (
                    incomeByCategory.map(([cat, { total }]) => (
                      <div key={cat} className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2.5">
                        <span className="text-sm flex items-center gap-2"><CategoryIcon category={cat} size="sm" /> {cat}</span>
                        <span className="text-sm font-mono-amount font-semibold">{formatAmount(total)}</span>
                      </div>
                    ))
                  )}
                  <button
                    onClick={handleAddIncome}
                    className="w-full py-2.5 rounded-xl border border-dashed border-border/50 text-xs font-medium text-muted-foreground hover:bg-secondary/30 hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter du revenu
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Savings target section */}
        <motion.div variants={fade} className="bg-card border border-border/30 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Épargne mensuelle</span>
            </div>
            <button
              onClick={() => { setSavingsTargetInput(savingsTarget ? String(savingsTarget) : ''); setShowSavingsTargetEdit(true); }}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              {savingsTarget ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Épargné ce mois</span>
            <span className={`font-mono-amount font-semibold ${monthSavingsNet >= 0 ? 'text-success' : 'text-destructive'}`}>
              {monthSavingsNet >= 0 ? '+' : ''}{formatAmount(monthSavingsNet)}
            </span>
          </div>

          {savingsTarget && savingsTarget > 0 && (
            <>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(Math.max((monthSavingsNet / savingsTarget) * 100, 0), 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full rounded-full ${monthSavingsNet >= savingsTarget ? 'bg-success' : 'bg-primary'}`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Objectif : <span className="font-mono-amount">{formatAmount(savingsTarget)}</span></span>
                <span className="font-mono-amount">{Math.round(Math.max((monthSavingsNet / savingsTarget) * 100, 0))}%</span>
              </div>
              {monthSavingsNet >= savingsTarget && (
                <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-xl px-3 py-2">
                  <PartyPopper className="w-4 h-4 text-success shrink-0" />
                  <p className="text-[11px] text-success font-medium">Objectif d'épargne atteint ce mois !</p>
                </div>
              )}
            </>
          )}

          {monthSavingsNet < 0 && (
            <button
              onClick={() => navigate('/transactions')}
              className="flex items-center gap-1.5 w-full px-3 py-2 rounded-xl bg-warning/10 border border-warning/20 text-[11px] text-warning hover:bg-warning/15 transition-colors text-left"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">Vous puisez dans vos économies ce mois-ci.</span>
              <ArrowRight className="w-3 h-3 flex-shrink-0" />
            </button>
          )}
        </motion.div>

        {/* Budget List */}
        <motion.div variants={fade} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold">Tes budgets</h2>
              {filteredBudgets.length > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                  {onTrackCount}/{filteredBudgets.length} en règle
                </span>
              )}
            </div>
            <button
              onClick={() => {
                if (!canAdd('budgets', budgets.length)) { setShowPaywall(true); return; }
                setNewCategory('');
                setNewLimit('');
                setShowCreate(true);
              }}
              className="h-8 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Ajouter
            </button>
          </div>

          {filteredBudgets.length === 0 ? (
            <div className="bg-card border border-border/30 rounded-2xl p-8 text-center">
              <PieChart className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun budget pour ce mois</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Créez votre premier budget pour suivre vos dépenses</p>
            </div>
          ) : (
            <div className="bg-card border border-border/30 rounded-2xl overflow-hidden divide-y divide-border/30">
              {filteredBudgets.map((b, idx) => {
                const spent = getSpentForBudget(b);
                const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
                const clampedPct = Math.min(pct, 100);
                const remaining = b.limit - spent;

                return (
                  <div
                    key={b.id}
                    className="px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors active:scale-[0.99]"
                    onClick={() => openEditModal(b)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <CategoryIcon category={b.category} size="sm" />
                        <span className="font-semibold text-sm">{b.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono-amount font-semibold">{formatAmount(spent)}</span>
                        <span className="text-[10px] text-muted-foreground">/</span>
                        <span className="text-xs font-mono-amount text-muted-foreground">{formatAmount(b.limit)}</span>
                        {getStatusIcon(pct)}
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${clampedPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={`h-full rounded-full ${getProgressColor(pct)}`}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] font-mono-amount text-muted-foreground">{Math.round(pct)}%</span>
                      {remaining >= 0 ? (
                        <span className="text-[10px] text-muted-foreground">Reste <span className="font-mono-amount font-medium">{formatAmount(remaining)}</span></span>
                      ) : (
                        <span className="text-[10px] text-destructive font-medium">Dépassé de <span className="font-mono-amount">{formatAmount(Math.abs(remaining))}</span></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Debt budget suggestion */}
        {debtMonthlyTotal > 0 && !budgetedCategories.has('Dettes') && (
          <motion.div variants={fade} className="bg-card border border-primary/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Suggestion dette</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <span className="text-sm font-medium">Dettes</span>
                  <p className="text-[10px] text-muted-foreground">Échéance mensuelle totale</p>
                </div>
              </div>
              <button
                onClick={() => handleCreateFromSuggestion('Dettes', debtMonthlyTotal)}
                className="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0 flex items-center gap-1.5"
              >
                <Target className="w-3 h-3" />
                {formatAmount(debtMonthlyTotal)}
              </button>
            </div>
          </motion.div>
        )}

        {/* Suggestions */}
        {categoriesWithoutBudget.length > 0 && (
          <motion.div variants={fade} className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Suggestions de budget</h2>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Basées sur vos dépenses moyennes des 3 derniers mois
            </p>
            <div className="bg-card border border-border/30 rounded-2xl overflow-hidden divide-y divide-border/30">
              {categoriesWithoutBudget.map(({ category, spent, emoji, suggestedBudget }) => (
                <div key={category} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <CategoryIcon category={category} size="sm" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium block truncate">{category}</span>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Ce mois : <span className="font-mono-amount font-medium text-foreground">{formatAmount(spent)}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Moy. : <span className="font-mono-amount font-medium text-primary">{formatAmount(suggestedBudget)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCreateFromSuggestion(category, suggestedBudget)}
                    className="h-7 px-2.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {formatAmount(suggestedBudget)}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Pie Chart - collapsible */}
        {filteredBudgets.length > 0 && (
          <motion.div variants={fade} className="bg-card border border-border/30 rounded-2xl overflow-hidden">
            <button
              onClick={() => setChartExpanded(!chartExpanded)}
              className="w-full px-4 py-3.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Répartition des budgets</span>
              </div>
              {chartExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            <AnimatePresence>
              {chartExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5">
                    {(() => {
                      const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a855f7'];
                      const budgetData = filteredBudgets.map((b, i) => ({
                        name: b.category,
                        value: b.limit,
                        spent: getBudgetSpent(b),
                        color: COLORS[i % COLORS.length],
                      }));
                      const remaining = Math.max(remainingToBudget, 0);
                      const chartData = remaining > 0
                        ? [...budgetData, { name: 'Restant à budgéter', value: remaining, spent: 0, color: '#d1d5db' }]
                        : budgetData;
                      const chartTotal = chartData.reduce((s, d) => s + d.value, 0);
                      const activeIndex = hoveredSlice;
                      return (
                        <div className="space-y-4">
                          <div className="relative">
                            <ResponsiveContainer width="100%" height={240}>
                              <RechartsPieChart>
                                <defs>
                                  {chartData.map((entry, i) => (
                                    <filter key={`shadow-${i}`} id={`glow-${i}`}>
                                      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={entry.color} floodOpacity="0.5" />
                                    </filter>
                                  ))}
                                </defs>
                                <Pie
                                  data={chartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={55}
                                  outerRadius={activeIndex !== null ? 95 : 90}
                                  cornerRadius={4}
                                  paddingAngle={3}
                                  dataKey="value"
                                  onMouseEnter={(_, index) => setHoveredSlice(index)}
                                  onMouseLeave={() => setHoveredSlice(null)}
                                  animationBegin={0}
                                  animationDuration={600}
                                >
                                  {chartData.map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={entry.color}
                                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.25}
                                      stroke={activeIndex === index ? '#fff' : 'transparent'}
                                      strokeWidth={activeIndex === index ? 2 : 0}
                                      style={{
                                        transition: 'opacity 0.3s ease, transform 0.3s ease',
                                        cursor: 'pointer',
                                        filter: activeIndex === index ? `url(#glow-${index})` : 'none',
                                      }}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value: number) => formatAmount(value)}
                                  contentStyle={{
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                    border: 'none',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                    backdropFilter: 'blur(8px)',
                                    background: 'hsl(var(--card) / 0.95)',
                                  }}
                                />
                              </RechartsPieChart>
                            </ResponsiveContainer>
                            {/* Center label */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="text-center">
                                {activeIndex !== null && chartData[activeIndex].name !== 'Restant à budgéter' ? (
                                  <>
                                     <p className="text-[10px] text-muted-foreground max-w-[80px] truncate mx-auto">{chartData[activeIndex].name}</p>
                                    <p className="text-sm font-bold font-mono-amount">{formatAmount(chartData[activeIndex].spent)}</p>
                                    <p className="text-[9px] text-muted-foreground">sur {formatAmount(chartData[activeIndex].value)}</p>
                                  </>
                                ) : activeIndex !== null ? (
                                  <>
                                    <p className="text-lg font-bold font-mono-amount">{formatAmount(chartData[activeIndex].value)}</p>
                                    <p className="text-[10px] text-muted-foreground">Restant</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-lg font-bold font-mono-amount">{formatAmount(chartTotal)}</p>
                                    <p className="text-[10px] text-muted-foreground">Total budgété</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5">
                            {chartData.map((item, i) => {
                              const pct = chartTotal > 0 ? Math.round((item.value / chartTotal) * 100) : 0;
                              const isActive = activeIndex === i;
                                  const isOver = item.spent > item.value && item.name !== 'Restant à budgéter';
                                  return (
                                <div
                                  key={i}
                                  className={`flex items-center gap-3 text-xs rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200 ${isOver ? 'ring-1 ring-destructive/40' : ''}`}
                                  style={{
                                    backgroundColor: isActive ? (isOver ? '#ef444418' : `${item.color}18`) : (isOver ? '#ef44440a' : undefined),
                                    opacity: activeIndex === null || isActive ? 1 : 0.4,
                                    borderLeft: isOver ? '3px solid #ef4444' : (isActive ? `3px solid ${item.color}` : '3px solid transparent'),
                                    transform: isActive ? 'translateX(2px)' : 'none',
                                  }}
                                  onMouseEnter={() => setHoveredSlice(i)}
                                  onMouseLeave={() => setHoveredSlice(null)}
                                >
                                  <div
                                    className="w-3.5 h-3.5 rounded-md shrink-0"
                                    style={{
                                      backgroundColor: isOver ? '#ef4444' : item.color,
                                      boxShadow: isActive ? `0 0 8px ${isOver ? '#ef4444' : item.color}60` : `0 1px 2px ${isOver ? '#ef4444' : item.color}30`,
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="font-medium text-foreground truncate">{item.name}</span>
                                        {isOver && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
                                      </div>
                                      <span className="font-mono-amount font-semibold text-foreground shrink-0 ml-2">{pct}%</span>
                                    </div>
                                    {item.value > 0 && item.spent !== undefined && item.name !== 'Restant à budgéter' ? (
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all duration-300"
                                              style={{
                                                width: `${Math.min((item.spent / item.value) * 100, 100)}%`,
                                                backgroundColor: isOver ? '#ef4444' : item.color,
                                              }}
                                            />
                                          </div>
                                          <span className={`font-mono-amount text-[10px] shrink-0 ${isOver ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                                            {formatAmount(item.spent)} / {formatAmount(item.value)}
                                          </span>
                                        </div>
                                        {isOver && (
                                          <p className="text-[10px] text-destructive font-medium">
                                            Dépassement de {formatAmount(item.spent - item.value)}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="font-mono-amount text-[10px] text-muted-foreground">{formatAmount(item.value)}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ==================== MODALS ==================== */}

        {/* Create modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl border border-border/30 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                <div className="px-5 pt-5 pb-3 border-b border-border/30 flex items-center justify-between shrink-0">
                  <h2 className="text-base font-bold">Nouveau budget</h2>
                  <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Catégorie</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                      {availableCategories.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewCategory(c)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all truncate ${
                            newCategory === c
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Montant</label>
                    <input
                      type="number"
                      value={newLimit}
                      onChange={e => setNewLimit(e.target.value)}
                      placeholder="500"
                      className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Remaining hint */}
                  {totalIncome > 0 && (
                    <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-xl px-3 py-2">
                      <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-xs text-primary">
                        Il te reste <span className="font-mono-amount font-semibold">{formatAmount(remainingToBudget - (parseFloat(newLimit) || 0))}</span> à budgéter
                      </span>
                    </div>
                  )}

                  {newCategory === 'Dettes' ? (
                    <div className="bg-muted/50 border border-border rounded-xl px-3 py-2">
                      <p className="text-xs text-muted-foreground"><Lightbulb className="w-3 h-3 inline mr-1" />Le budget Dettes s'adapte automatiquement chaque mois selon vos échéances. Il ne peut pas être récurrent.</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium mb-1">Type</label>
                      <div className="flex gap-2">
                         <button onClick={() => setNewIsRecurring(true)} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${newIsRecurring ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}><Clock className="w-3.5 h-3.5" /> Récurrent</button>
                         <button onClick={() => setNewIsRecurring(false)} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${!newIsRecurring ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}><Target className="w-3.5 h-3.5" /> Ponctuel</button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{newIsRecurring ? 'Actif tous les mois.' : 'Ce mois uniquement.'}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={newAlerts} onChange={e => setNewAlerts(e.target.checked)} id="alerts" className="rounded" />
                    <label htmlFor="alerts" className="text-xs">Alertes activées</label>
                  </div>
                </div>
                <div className="px-5 pb-5 flex gap-2 shrink-0">
                  <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                  <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Créer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit / Detail modal */}
        <AnimatePresence>
          {editTarget && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setEditTarget(null)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl border border-border/30 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                <div className="px-5 pt-5 pb-3 border-b border-border/30 flex items-center justify-between shrink-0">
                  <h2 className="text-base font-bold flex items-center gap-2"><CategoryIcon category={editTarget.category} size="sm" /> {editTarget.category}</h2>
                  <button onClick={() => setEditTarget(null)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
                  {/* Stats */}
                  {(() => {
                    const spent = getSpentForBudget(editTarget);
                    const pct = editTarget.limit > 0 ? (spent / editTarget.limit) * 100 : 0;
                    const clampedPct = Math.min(pct, 100);
                    const remaining = editTarget.limit - spent;
                    return (
                      <div className="bg-secondary/30 border border-border/30 rounded-xl p-4 mb-4">
                        <p className="text-[10px] font-medium text-muted-foreground mb-2">Ce mois</p>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Budget</span>
                          <span className="font-mono-amount font-semibold">{formatAmount(editTarget.limit)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span>Dépensé</span>
                          <span className={`font-mono-amount font-semibold ${pct > 100 ? 'text-destructive' : ''}`}>{formatAmount(spent)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-1.5">
                          <div className={`h-full rounded-full ${getProgressColor(pct)}`} style={{ width: `${clampedPct}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{Math.round(pct)}%</span>
                          {remaining >= 0 ? (
                            <span>Reste : <span className="font-mono-amount">{formatAmount(remaining)}</span></span>
                          ) : (
                            <span className="text-destructive">Dépassement : <span className="font-mono-amount">{formatAmount(Math.abs(remaining))}</span></span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Transaction list */}
                  {(() => {
                    const isEpargneBudget = editTarget.category === EPARGNE_CATEGORY;
                    const budgetTx = isEpargneBudget
                      ? monthTx
                          .filter(t => t.type === 'income' && t.accountId && savingsAccountIds.has(t.accountId) && t.category === 'Transfert')
                          .sort((a, b) => b.date.localeCompare(a.date))
                      : monthTx
                          .filter(t => t.type === 'expense' && t.category === editTarget.category)
                          .sort((a, b) => b.date.localeCompare(a.date));
                    if (budgetTx.length === 0) return <div className="bg-secondary/20 rounded-xl p-3 mb-4 text-center text-[10px] text-muted-foreground">Aucune transaction ce mois</div>;
                    return (
                      <div className="mb-4">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Transactions ({budgetTx.length})</p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {budgetTx.map(t => (
                            <div key={t.id} className="flex items-center justify-between text-[11px] bg-secondary/30 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <CategoryIcon category={t.category} size="sm" />
                                <span className="truncate font-medium">{t.label}</span>
                                <span className="text-muted-foreground shrink-0">{formatDateLong(t.date)}</span>
                              </div>
                              <span className={`font-mono-amount font-medium shrink-0 ml-2 ${isEpargneBudget ? 'text-success' : 'text-destructive'}`}>{isEpargneBudget ? '+' : '-'}{formatAmount(t.convertedAmount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Edit fields */}
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium mb-1">Modifier le budget</label>
                      <input type="number" value={editLimit} onChange={e => setEditLimit(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={editIsRecurring} onChange={e => setEditIsRecurring(e.target.checked)} id="editRecurring" className="rounded" />
                      <label htmlFor="editRecurring" className="text-xs">Budget récurrent</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={editAlerts} onChange={e => setEditAlerts(e.target.checked)} id="editAlerts" className="rounded" />
                      <label htmlFor="editAlerts" className="text-xs">Alertes</label>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex gap-2">
                      <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                      <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Enregistrer</button>
                    </div>
                     <button onClick={handleDeleteFromEdit} className="w-full py-2.5 rounded-xl bg-destructive/5 border border-destructive/15 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors flex items-center justify-center gap-1.5">
                       <Trash2 className="w-3.5 h-3.5" /> Supprimer
                     </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete modal */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-sm rounded-2xl border border-border/30 shadow-2xl p-5">
                <h2 className="text-base font-bold mb-1">Supprimer le budget</h2>
                <p className="text-xs text-muted-foreground mb-4"><CategoryIcon category={deleteTarget.category} size="sm" className="inline-block mr-1" /> {deleteTarget.category} — {formatAmount(deleteTarget.limit)}</p>
                {deleteTarget.isRecurring ? (
                  <div className="space-y-2">
                     <button onClick={handleSoftDelete} className="w-full py-3 rounded-xl border border-border/30 bg-secondary/20 text-sm font-medium hover:bg-secondary/40 transition-colors text-left px-4">
                       <p className="font-semibold flex items-center gap-1.5"><StopCircle className="w-3.5 h-3.5 text-muted-foreground" /> Arrêter pour les mois à venir</p>
                       <p className="text-[10px] text-muted-foreground mt-0.5 ml-5">L'historique est conservé</p>
                     </button>
                     <button onClick={handleHardDelete} className="w-full py-3 rounded-xl border border-destructive/20 bg-destructive/5 text-sm font-medium hover:bg-destructive/10 transition-colors text-left px-4">
                       <p className="font-semibold text-destructive flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Supprimer complètement</p>
                       <p className="text-[10px] text-muted-foreground mt-0.5 ml-5">Efface de tous les mois</p>
                     </button>
                    <button onClick={() => setDeleteTarget(null)} className="w-full py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Action irréversible.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                      <button onClick={handleHardDelete} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors">Supprimer</button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Savings target modal */}
        <AnimatePresence>
          {showSavingsTargetEdit && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowSavingsTargetEdit(false)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-sm rounded-2xl border border-border/30 shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Objectif d'épargne</h2>
                  <button onClick={() => setShowSavingsTargetEdit(false)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <p className="text-xs text-muted-foreground">Définis un objectif d'épargne mensuel pour suivre ta progression.</p>
                <div>
                  <label className="block text-xs font-medium mb-1">Montant mensuel</label>
                  <input
                    type="number"
                    value={savingsTargetInput}
                    onChange={e => setSavingsTargetInput(e.target.value)}
                    placeholder="500"
                    className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex gap-2">
                  {savingsTarget && (
                    <button onClick={handleRemoveSavingsTarget} className="py-2.5 px-4 rounded-xl border border-destructive/20 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors">Supprimer</button>
                  )}
                  <button onClick={() => setShowSavingsTargetEdit(false)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                  <button onClick={handleSaveSavingsTarget} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Enregistrer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} feature="les budgets illimités" description="Vous avez atteint la limite de 2 budgets. Passez à Premium pour en créer autant que vous voulez." />
    </Layout>
  );
};

export default Budgets;
