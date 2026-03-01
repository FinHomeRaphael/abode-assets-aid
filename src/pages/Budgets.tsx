import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatDateLong } from '@/utils/format';
import { getBudgetStatus } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_EMOJIS } from '@/types/finance';
import { toast } from 'sonner';
import { PaywallModal } from '@/components/PremiumPaywall';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { Plus, X, ChevronDown, ChevronUp, TrendingUp, Wallet, AlertTriangle, CheckCircle, PieChart, Lightbulb, ArrowRight, Target, Pencil, PartyPopper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const Budgets = () => {
  const { scopedBudgets: budgets, addBudget, updateBudget, getBudgetSpent, deleteBudget, softDeleteBudget, getBudgetsForMonth, getTransactionsForMonth, getMemberById, householdId, currentUser, customCategories, scopedAccounts: accounts, household } = useApp();
  const { canAdd } = useSubscription(householdId, currentUser?.id);
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);

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

  // Available to budget = income - abs(savings net) - budgeted
  const totalSavingsDeducted = Math.abs(monthSavingsNet);
  const availableAfterSavings = totalIncome - totalSavingsDeducted;
  const remainingToBudget = availableAfterSavings - totalBudgeted;
  const budgetPercentage = availableAfterSavings > 0 ? Math.min((totalBudgeted / availableAfterSavings) * 100, 100) : 0;

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
    // Épargne is handled separately via savings deduction, not as a budget category
    return Array.from(catSpent.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, spent]) => ({ category: cat, spent, emoji: CATEGORY_EMOJIS[cat] || '📌' }));
  }, [monthTx, budgetedCategories, monthSavingsAmount]);

  // === Available categories for create modal (exclude already budgeted) ===
  const availableCategories = allExpenseCategories.filter(c => !budgetedCategories.has(c));

  // === Handlers ===
  const handleAddIncome = () => {
    navigate('/transactions', { state: { openModal: true, preselectedType: 'income' } });
  };

  const handleCreate = () => {
    if (!newCategory || !newLimit) { toast.error('Remplissez tous les champs'); return; }
    const monthYear = newIsRecurring ? undefined : currentMonthYear;
    addBudget({
      category: newCategory,
      limit: parseFloat(newLimit),
      period: 'monthly',
      emoji: CATEGORY_EMOJIS[newCategory] || '📌',
      alertsEnabled: newAlerts,
      recurring: newIsRecurring,
      isRecurring: newIsRecurring,
      monthYear,
      startMonth: currentMonthYear,
    });
    setShowCreate(false);
    setNewCategory('');
    setNewLimit('');
  };

  const handleCreateFromSuggestion = (category: string) => {
    setNewCategory(category);
    setNewLimit('');
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
    if (pct > 100) return '🔴';
    if (pct >= 80) return '⚠️';
    return '✅';
  };

  const formatMonth = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(parseInt(y), parseInt(m) - 1));
  };

  return (
    <Layout>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 via-transparent to-transparent h-64" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Budgets</h1>
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

        {/* Section 1: Income Summary */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setIncomeExpanded(!incomeExpanded)}
            className="w-full px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground font-medium">Revenus du mois</p>
                <p className="text-lg font-bold font-mono-amount">{formatAmount(totalIncome)}</p>
              </div>
            </div>
            {incomeExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
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
                <div className="px-5 pb-4 space-y-2">
                  {incomeByCategory.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Aucun revenu ce mois</p>
                  ) : (
                    incomeByCategory.map(([cat, { emoji, total }]) => (
                      <div key={cat} className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2.5">
                        <span className="text-sm">{emoji} {cat}</span>
                        <span className="text-sm font-mono-amount font-semibold">{formatAmount(total)}</span>
                      </div>
                    ))
                  )}
                  <button
                    onClick={handleAddIncome}
                    className="w-full py-2.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-secondary/30 hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter du revenu
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 2: Budget Allocation Summary */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <PieChart className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Répartition</span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total revenus</span>
            <span className="font-mono-amount font-medium text-foreground">{formatAmount(totalIncome)}</span>
          </div>

          {/* Total épargné + objectif */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span>Total épargné</span>
                <button
                  onClick={() => { setSavingsTargetInput(savingsTarget ? String(savingsTarget) : ''); setShowSavingsTargetEdit(true); }}
                  className="text-primary hover:text-primary/80 transition-colors"
                  title="Définir un objectif d'épargne"
                >
                  {savingsTarget ? <Pencil className="w-3 h-3" /> : <Target className="w-3 h-3" />}
                </button>
              </div>
              <span className={`font-mono-amount font-medium ${monthSavingsNet >= 0 ? 'text-success' : 'text-destructive'}`}>
                {monthSavingsNet >= 0 ? '-' : '+'}{formatAmount(totalSavingsDeducted)}
              </span>
            </div>

            {/* Savings target progress */}
            {savingsTarget && savingsTarget > 0 && (
              <>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((monthSavingsNet / savingsTarget) * 100, 100)}%` }}
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
                    <p className="text-[11px] text-success font-medium">Bravo ! Vous avez atteint votre objectif d'épargne ce mois-ci 🎉</p>
                  </div>
                )}
              </>
            )}
          </div>

          {monthSavingsNet < 0 && (
            <button
              onClick={() => navigate('/transactions')}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors text-left"
            >
              <span>⚠️</span>
              <span className="flex-1">Vous puisez dans vos économies ce mois-ci. Pensez à faire un transfert vers votre épargne.</span>
              <ArrowRight className="w-3 h-3 flex-shrink-0" />
            </button>
          )}

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Total budgété</span>
              <span className="font-mono-amount font-semibold">{formatAmount(totalBudgeted)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full rounded-full ${remainingToBudget < 0 ? 'bg-destructive' : 'bg-primary'}`}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right mt-1">{Math.round(budgetPercentage)}%</p>
          </div>

          {/* Remaining / Overshoot */}
          {remainingToBudget > 0 ? (
            <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-xl px-4 py-2.5">
              <CheckCircle className="w-4 h-4 text-success shrink-0" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm font-medium text-success">Reste à budgéter</span>
                <span className="text-sm font-mono-amount font-bold text-success">{formatAmount(remainingToBudget)}</span>
              </div>
            </div>
          ) : remainingToBudget === 0 && totalIncome > 0 ? (
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5">
              <CheckCircle className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium text-primary">Tout est budgété !</span>
            </div>
          ) : totalIncome > 0 ? (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-destructive">Dépassement</span>
                  <span className="text-sm font-mono-amount font-bold text-destructive">{formatAmount(Math.abs(remainingToBudget))}</span>
                </div>
                <p className="text-[10px] text-destructive/70">Tu as budgété plus que tes revenus !</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Section 3: Budget List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Tes budgets</h2>
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
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              Aucun budget pour ce mois
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBudgets.map(b => {
                const spent = getSpentForBudget(b);
                const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
                const clampedPct = Math.min(pct, 100);
                const remaining = b.limit - spent;
                const isStopped = !!b.endMonth && b.endMonth <= currentMonthYear;

                return (
                  <div
                    key={b.id}
                    className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.99]"
                    onClick={() => openEditModal(b)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{b.emoji} {b.category}</span>
                      <span className="text-lg">{getStatusIcon(pct)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Budget : <span className="font-mono-amount text-foreground">{formatAmount(b.limit)}</span></span>
                      <span>Dépensé : <span className={`font-mono-amount font-semibold ${pct > 100 ? 'text-destructive' : 'text-foreground'}`}>{formatAmount(spent)}</span></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-1.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${clampedPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={`h-full rounded-full ${getProgressColor(pct)}`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono-amount text-muted-foreground">{Math.round(pct)}%</span>
                      {remaining >= 0 ? (
                        <span className="text-muted-foreground">Reste : <span className="font-mono-amount">{formatAmount(remaining)}</span></span>
                      ) : (
                        <span className="text-destructive font-semibold">Dépassement : <span className="font-mono-amount">{formatAmount(Math.abs(remaining))}</span></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie Chart - collapsible */}
        {filteredBudgets.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setChartExpanded(!chartExpanded)}
              className="w-full px-5 py-3.5 flex items-center justify-between"
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
                      const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a855f7'];
                      const budgetData = filteredBudgets.map((b, i) => ({
                        name: `${b.emoji} ${b.category}`,
                        value: b.limit,
                        color: COLORS[i % COLORS.length],
                      }));
                      const remaining = Math.max(remainingToBudget, 0);
                      const chartData = remaining > 0
                        ? [...budgetData, { name: '💡 Restant à budgéter', value: remaining, color: 'hsl(var(--muted-foreground) / 0.25)' }]
                        : budgetData;
                      const chartTotal = chartData.reduce((s, d) => s + d.value, 0);
                      return (
                        <div className="space-y-3">
                          <ResponsiveContainer width="100%" height={200}>
                            <RechartsPieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => formatAmount(value)}
                                contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }}
                              />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                          <div className="grid grid-cols-2 gap-1.5">
                            {chartData.map((item, i) => {
                              const pct = chartTotal > 0 ? Math.round((item.value / chartTotal) * 100) : 0;
                              return (
                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                  <span className="truncate text-muted-foreground">{item.name}</span>
                                  <span className="font-mono-amount ml-auto shrink-0">{pct}%</span>
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
          </div>
        )}

        {/* Section 4: Categories without budget */}
        {categoriesWithoutBudget.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h2 className="text-base font-bold">Catégories sans budget</h2>
            </div>
            <div className="space-y-2">
              {categoriesWithoutBudget.map(({ category, spent, emoji }) => (
                <div key={category} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{emoji} {category}</span>
                    <p className="text-xs text-muted-foreground">Dépensé : <span className="font-mono-amount">{formatAmount(spent)}</span></p>
                  </div>
                  <button
                    onClick={() => handleCreateFromSuggestion(category)}
                    className="h-7 px-3 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    Créer un budget
                  </button>
                </div>
              ))}
            </div>
          </div>
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
                          {CATEGORY_EMOJIS[c] || '📌'} {c}
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

                  <div>
                    <label className="block text-xs font-medium mb-1">Type</label>
                    <div className="flex gap-2">
                      <button onClick={() => setNewIsRecurring(true)} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${newIsRecurring ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}>🔄 Récurrent</button>
                      <button onClick={() => setNewIsRecurring(false)} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${!newIsRecurring ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}>📌 Ponctuel</button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{newIsRecurring ? 'Actif tous les mois.' : 'Ce mois uniquement.'}</p>
                  </div>
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
                  <h2 className="text-base font-bold">{editTarget.emoji} {editTarget.category}</h2>
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
                                <span>{t.emoji}</span>
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
                    <button onClick={handleDeleteFromEdit} className="w-full py-2.5 rounded-xl bg-destructive/5 border border-destructive/15 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors">
                      🗑️ Supprimer
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
                <p className="text-xs text-muted-foreground mb-4">{deleteTarget.emoji} {deleteTarget.category} — {formatAmount(deleteTarget.limit)}</p>
                {deleteTarget.isRecurring ? (
                  <div className="space-y-2">
                    <button onClick={handleSoftDelete} className="w-full py-3 rounded-xl border border-border/30 bg-secondary/20 text-sm font-medium hover:bg-secondary/40 transition-colors text-left px-4">
                      <p className="font-semibold">⏹️ Arrêter pour les mois à venir</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">L'historique est conservé</p>
                    </button>
                    <button onClick={handleHardDelete} className="w-full py-3 rounded-xl border border-destructive/20 bg-destructive/5 text-sm font-medium hover:bg-destructive/10 transition-colors text-left px-4">
                      <p className="font-semibold text-destructive">🗑️ Supprimer complètement</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Efface de tous les mois</p>
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
