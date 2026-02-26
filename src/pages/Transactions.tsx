import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatDate, formatDateLong, formatLocalDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CURRENCIES, CATEGORY_EMOJIS, ACCOUNT_TYPES } from '@/types/finance';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import AddTransactionModal from '@/components/AddTransactionModal';
import AddTransferModal from '@/components/AddTransferModal';
import ImportCSVModal from '@/components/ImportCSVModal';
import ConvertedAmount from '@/components/ConvertedAmount';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Wallet, Search, Plus, ArrowLeftRight, Download, CheckSquare, X, Trash2, Eye, ChevronDown } from 'lucide-react';
import { recalculateScheduleFromRow } from '@/utils/recalculateSchedule';
import { getPeriodsPerYear } from '@/types/debt';
import { useNavigate, Link } from 'react-router-dom';

const Transactions = () => {
  const { scopedTransactions: transactions, getMemberById, household, householdId, getTransactionsForMonth, deleteTransaction, updateTransaction, softDeleteRecurringTransaction, scopedAccounts: accounts, financeScope, customAccountTypes } = useApp();
  const { formatAmount, currency } = useCurrency();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterMember, setFilterMember] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [editTarget, setEditTarget] = useState<typeof transactions[0] | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editMemberId, setEditMemberId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editAccountId, setEditAccountId] = useState('');
  const [editDebtInterest, setEditDebtInterest] = useState('');
  const [editDebtPrincipal, setEditDebtPrincipal] = useState('');

  const [deleteRecTarget, setDeleteRecTarget] = useState<typeof transactions[0] | null>(null);
  const [viewDebtTarget, setViewDebtTarget] = useState<typeof transactions[0] | null>(null);
  const [expandedCard, setExpandedCard] = useState<'income' | 'expense' | 'savings' | 'balance' | null>(null);

  const monthTx = useMemo(() => getTransactionsForMonth(currentMonth), [currentMonth, getTransactionsForMonth]);
  const categories = [...new Set(monthTx.map(t => t.category))].sort();

  const filtered = monthTx.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterMember !== 'all' && t.memberId !== filterMember) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (search && !t.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const savingsAccountIds = new Set(accounts.filter(a => a.type === 'epargne').map(a => a.id));
  const isSavingsTx = (t: typeof transactions[0]) => !!(t.accountId && savingsAccountIds.has(t.accountId));

  // Find transfer IDs where at least one side is a savings account
  const transferIdRegex = /\[?Transfert\s+#([^\]\s]+)\]?/i;
  const savingsTransferIds = new Set<string>();
  monthTx.forEach(t => {
    if (isSavingsTx(t) && t.category === 'Transfert' && t.notes) {
      const match = t.notes.match(transferIdRegex);
      if (match) savingsTransferIds.add(match[1]);
    }
  });
  const isSavingsTransferCounterpart = (t: typeof transactions[0]) => {
    if (t.category !== 'Transfert' || !t.notes) return false;
    const match = t.notes.match(transferIdRegex);
    return match ? savingsTransferIds.has(match[1]) : false;
  };
  const isAnySavingsTx = (t: typeof transactions[0]) => isSavingsTx(t) || isSavingsTransferCounterpart(t);

  // Épargne nette = revenus d'épargne - dépenses d'épargne (sans double comptage des transferts)
  const savingsTransferIn = monthTx.filter(t => t.type === 'income' && isSavingsTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const savingsTransferOut = monthTx.filter(t => t.type === 'expense' && isSavingsTx(t) && t.category === 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const savingsDirectIncome = monthTx.filter(t => t.type === 'income' && isSavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const savingsDirectExpenses = monthTx.filter(t => t.type === 'expense' && isSavingsTx(t) && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const savingsIncomeTotal = savingsTransferIn + savingsDirectIncome;
  const savingsExpenseTotal = savingsTransferOut + savingsDirectExpenses;
  const monthSavingsNet = savingsIncomeTotal - savingsExpenseTotal;

  const monthIncome = filtered.filter(t => t.type === 'income' && t.category !== 'Transfert').reduce((s, t) => s + t.convertedAmount, 0);
  const monthExpense = filtered.filter(t => t.type === 'expense' && !isAnySavingsTx(t)).reduce((s, t) => s + t.convertedAmount, 0);

  const allAccountTypes = [...ACCOUNT_TYPES, ...customAccountTypes.map(t => ({ value: t.value, label: t.label, emoji: t.emoji }))];

  const getAccountLabel = (accountId: string | null | undefined) => {
    if (!accountId) return { name: 'Sans compte', emoji: '📌' };
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return { name: 'Compte inconnu', emoji: '❓' };
    const typeInfo = allAccountTypes.find(t => t.value === acc.type);
    return { name: acc.name, emoji: typeInfo?.emoji || '📁' };
  };

  const breakdownByAccount = useMemo(() => {
    const incomeByAccount: Record<string, number> = {};
    const expenseByAccount: Record<string, number> = {};
    const savingsByAccount: Record<string, number> = {};

    // Income: same filter as monthIncome
    filtered.filter(t => t.type === 'income' && t.category !== 'Transfert').forEach(t => {
      const key = t.accountId || '__none__';
      incomeByAccount[key] = (incomeByAccount[key] || 0) + t.convertedAmount;
    });

    // Expenses: same filter as monthExpense
    filtered.filter(t => t.type === 'expense' && !isAnySavingsTx(t)).forEach(t => {
      const key = t.accountId || '__none__';
      expenseByAccount[key] = (expenseByAccount[key] || 0) + t.convertedAmount;
    });

    // Savings: split by income and expense per account
    const savingsIncByAccount: Record<string, number> = {};
    const savingsExpByAccount: Record<string, number> = {};
    monthTx.filter(t => isSavingsTx(t)).forEach(t => {
      const key = t.accountId || '__none__';
      if (t.type === 'income') {
        savingsIncByAccount[key] = (savingsIncByAccount[key] || 0) + t.convertedAmount;
      } else {
        savingsExpByAccount[key] = (savingsExpByAccount[key] || 0) + t.convertedAmount;
      }
    });

    const toSorted = (map: Record<string, number>) =>
      Object.entries(map)
        .map(([id, amount]) => ({ id, amount, ...getAccountLabel(id === '__none__' ? null : id) }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return { income: toSorted(incomeByAccount), expense: toSorted(expenseByAccount), savingsIncome: toSorted(savingsIncByAccount), savingsExpense: toSorted(savingsExpByAccount) };
  }, [filtered, monthTx, accounts, allAccountTypes]);


  const openEditModal = (t: typeof transactions[0]) => {
    setEditTarget(t);
    setEditLabel(t.label);
    setEditAmount(String(t.amount));
    setEditCategory(t.category);
    setEditDate((() => { const [y,m,d] = t.date.split('-').map(Number); return new Date(y, m-1, d); })());
    setEditMemberId(t.memberId);
    setEditNotes(t.notes || '');
    setEditIsRecurring(!!t.isRecurring);
    setEditAccountId(t.accountId || '');
    // Parse debt payment info from notes
    const isDebtTx = !!(t as any).debtId || !!(t as any).debt_id;
    if (isDebtTx && t.notes) {
      const match = t.notes.match(/Amortissement\s+([\d.]+)\s*\+\s*Intérêts\s+([\d.]+)/);
      if (match) {
        setEditDebtPrincipal(match[1]);
        setEditDebtInterest(match[2]);
      } else {
        setEditDebtPrincipal('');
        setEditDebtInterest('');
      }
    } else {
      setEditDebtPrincipal('');
      setEditDebtInterest('');
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget || !editLabel.trim() || !editAmount || !editCategory) return;
    const day = editDate.getDate();
    const isDebtTx = !!(editTarget as any).debtId || !!(editTarget as any).debt_id;
    const debtId = (editTarget as any).debtId || (editTarget as any).debt_id;
    const isVirtual = editTarget.id.startsWith('debt-');

    // If debt transaction with interest/principal edited, update notes and amount
    let finalAmount = parseFloat(editAmount);
    let finalNotes = editNotes.trim() || undefined;
    if (isDebtTx) {
      const interest = parseFloat(editDebtInterest) || 0;
      const principal = parseFloat(editDebtPrincipal) || 0;
      finalAmount = interest + principal;
      finalNotes = `Amortissement ${principal.toFixed(2)} + Intérêts ${interest.toFixed(2)}`;

      // Sync with debt_schedules: find the schedule row and recalculate
      if (debtId) {
        try {
          // Fetch all schedule rows for this debt
          const { data: schedData } = await supabase
            .from('debt_schedules')
            .select('*')
            .eq('debt_id', debtId)
            .order('period_number', { ascending: true });

          // Fetch debt info
          const { data: debtData } = await supabase
            .from('debts')
            .select('interest_rate, payment_frequency, amortization_type, payment_amount')
            .eq('id', debtId)
            .single();

          if (schedData && debtData) {
            const schedRows = schedData.map((r: any) => ({
              id: r.id,
              due_date: r.due_date,
              period_number: Number(r.period_number),
              capital_before: Number(r.capital_before),
              capital_after: Number(r.capital_after),
              interest_amount: Number(r.interest_amount),
              principal_amount: Number(r.principal_amount),
              total_amount: Number(r.total_amount),
              status: r.status,
              transaction_id: r.transaction_id,
            }));

            // Find the matching schedule row by date
            const txDate = formatLocalDate(editDate);
            let schedIdx = schedRows.findIndex(r => r.due_date === txDate);
            // Fallback: match by transaction_id for paid rows
            if (schedIdx === -1 && !isVirtual) {
              schedIdx = schedRows.findIndex(r => r.transaction_id === editTarget.id);
            }
            // Fallback: match by schedule id for virtual rows
            if (schedIdx === -1 && isVirtual) {
              const schedId = editTarget.id.replace('debt-sched-', '');
              schedIdx = schedRows.findIndex(r => r.id === schedId);
            }

            if (schedIdx !== -1) {
              await recalculateScheduleFromRow(
                schedRows, schedIdx, interest, principal,
                debtId,
                Number(debtData.interest_rate),
                debtData.payment_frequency,
                debtData.amortization_type,
                Number(debtData.payment_amount),
              );
            }
          }
        } catch (err) {
          console.error('Sync schedule from transaction error:', err);
        }
      }
    }

    // Only update the real transaction if it's not a virtual one
    if (!isVirtual) {
      updateTransaction(editTarget.id, {
        label: editLabel.trim(),
        amount: finalAmount,
        category: editCategory,
        date: formatLocalDate(editDate),
        memberId: editMemberId,
        notes: finalNotes,
        emoji: CATEGORY_EMOJIS[editCategory] || editTarget.emoji,
        isRecurring: editIsRecurring,
        recurrenceDay: editIsRecurring ? day : undefined,
        accountId: editAccountId || undefined,
      });
    }

    // silent
    setEditTarget(null);
  };

  const handleDeleteFromEdit = () => {
    if (!editTarget) return;
    if (editTarget.isRecurring || editTarget.recurringSourceId) {
      const templateId = editTarget.recurringSourceId || editTarget.id;
      const template = transactions.find(t => t.id === templateId) || editTarget;
      setDeleteRecTarget({ ...template, id: templateId });
      setEditTarget(null);
    } else {
      deleteTransaction(editTarget.id);
      // silent
      setEditTarget(null);
    }
  };

  const handleSoftDeleteRec = () => {
    if (!deleteRecTarget) return;
    const monthYear = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    softDeleteRecurringTransaction(deleteRecTarget.id, monthYear);
    // silent
    setDeleteRecTarget(null);
  };

  const handleHardDeleteRec = () => {
    if (!deleteRecTarget) return;
    deleteTransaction(deleteRecTarget.id);
    // silent
    setDeleteRecTarget(null);
  };

  const allCategories = editTarget?.type === 'income' ? [...INCOME_CATEGORIES] : [...EXPENSE_CATEGORIES];

  const formatMonth = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(t => t.id)));
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => deleteTransaction(id));
    // silent
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  return (
    <Layout>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 via-transparent to-transparent h-64" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative space-y-4">
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Transactions</h1>
          <div className="flex gap-2 flex-wrap">
            {selectMode ? (
              <>
                <button onClick={exitSelectMode} className="h-9 px-3 rounded-xl border border-border/30 bg-secondary/30 text-sm font-medium hover:bg-secondary/50 transition-colors flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" /> Annuler
                </button>
                <button onClick={toggleSelectAll} className="h-9 px-3 rounded-xl border border-border/30 bg-secondary/30 text-sm font-medium hover:bg-secondary/50 transition-colors flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" /> {selectedIds.size === filtered.length ? 'Désélect.' : 'Tout'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setSelectMode(true)} className="h-9 px-3 rounded-xl border border-border/30 bg-secondary/30 text-sm font-medium hover:bg-secondary/50 transition-colors">
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setShowTransferModal(true)} className="h-9 px-3 rounded-xl border border-border/30 bg-secondary/30 text-sm font-medium hover:bg-secondary/50 transition-colors flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Transfert
                </button>
                <button onClick={() => setShowImportModal(true)} className="h-9 px-3 rounded-xl border border-border/30 bg-secondary/30 text-sm font-medium hover:bg-secondary/50 transition-colors flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Import
                </button>
                <button onClick={() => setShowAddModal(true)} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Créer
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

        {/* Month totals */}
        <div className="grid grid-cols-4 gap-1.5">
          <button onClick={() => setExpandedCard(expandedCard === 'income' ? null : 'income')} className="bg-success/5 border border-success/15 rounded-xl p-2 text-center transition-colors hover:bg-success/10 relative">
            <TrendingUp className="w-3 h-3 text-success mx-auto mb-0.5" />
            <p className="text-[9px] text-muted-foreground mb-0.5">Revenus</p>
            <p className="font-mono-amount font-bold text-success text-xs">+{formatAmount(monthIncome)}</p>
            <ChevronDown className={`w-3 h-3 text-success mx-auto mt-0.5 transition-transform ${expandedCard === 'income' ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => setExpandedCard(expandedCard === 'expense' ? null : 'expense')} className="bg-destructive/5 border border-destructive/15 rounded-xl p-2 text-center transition-colors hover:bg-destructive/10 relative">
            <TrendingDown className="w-3 h-3 text-destructive mx-auto mb-0.5" />
            <p className="text-[9px] text-muted-foreground mb-0.5">Dépenses</p>
            <p className="font-mono-amount font-bold text-destructive text-xs">-{formatAmount(monthExpense)}</p>
            <ChevronDown className={`w-3 h-3 text-destructive mx-auto mt-0.5 transition-transform ${expandedCard === 'expense' ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => setExpandedCard(expandedCard === 'savings' ? null : 'savings')} className={`border rounded-xl p-2 text-center transition-colors hover:bg-muted/30 ${monthSavingsNet > 0 ? 'bg-success/5 border-success/15' : monthSavingsNet < 0 ? 'bg-destructive/5 border-destructive/15' : 'bg-secondary/5 border-border/15'}`}>
            <Wallet className={`w-3 h-3 mx-auto mb-0.5 ${monthSavingsNet > 0 ? 'text-success' : monthSavingsNet < 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            <p className="text-[9px] text-muted-foreground mb-0.5">Épargne</p>
            <p className={`font-mono-amount font-bold text-xs ${monthSavingsNet > 0 ? 'text-success' : monthSavingsNet < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{monthSavingsNet > 0 ? '+' : monthSavingsNet < 0 ? '-' : ''}{formatAmount(Math.abs(monthSavingsNet))}</p>
            <ChevronDown className={`w-3 h-3 mx-auto mt-0.5 transition-transform ${expandedCard === 'savings' ? 'rotate-180' : ''} ${monthSavingsNet > 0 ? 'text-success' : monthSavingsNet < 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </button>
          <button onClick={() => setExpandedCard(expandedCard === 'balance' ? null : 'balance')} className={`border rounded-xl p-2 text-center transition-colors hover:bg-muted/30 ${monthIncome - monthExpense + Math.min(monthSavingsNet, 0) >= 0 ? 'bg-success/5 border-success/15' : 'bg-destructive/5 border-destructive/15'}`}>
            <Wallet className={`w-3 h-3 mx-auto mb-0.5 ${monthIncome - monthExpense + Math.min(monthSavingsNet, 0) >= 0 ? 'text-success' : 'text-destructive'}`} />
            <p className="text-[9px] text-muted-foreground mb-0.5">Solde</p>
            <p className={`font-mono-amount font-bold text-xs ${monthIncome - monthExpense + Math.min(monthSavingsNet, 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {monthIncome - monthExpense + Math.min(monthSavingsNet, 0) >= 0 ? '+' : ''}{formatAmount(monthIncome - monthExpense + Math.min(monthSavingsNet, 0))}
            </p>
            <ChevronDown className={`w-3 h-3 mx-auto mt-0.5 transition-transform ${expandedCard === 'balance' ? 'rotate-180' : ''} ${monthIncome - monthExpense + Math.min(monthSavingsNet, 0) >= 0 ? 'text-success' : 'text-destructive'}`} />
          </button>
        </div>

        {/* Breakdown by account */}
        <AnimatePresence>
          {expandedCard && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
                {expandedCard === 'balance' ? (
                  <>
                    <p className="text-xs font-semibold mb-2">📊 Détail du solde</p>
                    <div className="flex items-center justify-between py-1 border-b border-border/30">
                      <span className="text-xs flex items-center gap-1.5">💰 Revenus</span>
                      <span className="font-mono-amount text-xs font-semibold text-success">+{formatAmount(monthIncome)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-border/30">
                      <span className="text-xs flex items-center gap-1.5">💸 Dépenses</span>
                      <span className="font-mono-amount text-xs font-semibold text-destructive">-{formatAmount(monthExpense)}</span>
                    </div>
                    {monthSavingsNet < 0 && (
                      <div className="flex items-center justify-between py-1 border-b border-border/30">
                        <span className="text-xs flex items-center gap-1.5">🏦 Épargne nette</span>
                        <span className="font-mono-amount text-xs font-semibold text-destructive">{formatAmount(monthSavingsNet)}</span>
                      </div>
                    )}
                    <div className={`flex items-center justify-between pt-2 mt-1 border-t-2 border-border`}>
                      <span className="text-xs font-bold">Solde</span>
                      <span className={`font-mono-amount text-xs font-bold ${monthIncome - monthExpense + Math.min(monthSavingsNet, 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {monthIncome - monthExpense + Math.min(monthSavingsNet, 0) >= 0 ? '+' : ''}{formatAmount(monthIncome - monthExpense + Math.min(monthSavingsNet, 0))}
                      </span>
                    </div>
                  </>
                ) : expandedCard !== 'savings' ? (
                  <>
                    <p className="text-xs font-semibold mb-2">
                      {expandedCard === 'income' ? '💰 Revenus par compte' : '💸 Dépenses par compte'}
                    </p>
                    {(expandedCard === 'income' ? breakdownByAccount.income : breakdownByAccount.expense).map(item => (
                      <div key={item.id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                        <span className="text-xs flex items-center gap-1.5">
                          <span>{item.emoji}</span>
                          <span className="truncate max-w-[150px]">{item.name}</span>
                        </span>
                        <span className={`font-mono-amount text-xs font-semibold ${expandedCard === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {expandedCard === 'income' ? '+' : '-'}{formatAmount(item.amount)}
                        </span>
                      </div>
                    ))}
                    {(expandedCard === 'income' ? breakdownByAccount.income : breakdownByAccount.expense).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Aucune donnée</p>
                    )}
                    <div className={`flex items-center justify-between mt-2 px-2 py-1.5 rounded-lg ${expandedCard === 'income' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                      <span className={`text-[11px] ${expandedCard === 'income' ? 'text-success' : 'text-destructive'}`}>Total</span>
                      <span className={`font-mono-amount text-xs ${expandedCard === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {expandedCard === 'income' ? `+${formatAmount(monthIncome)}` : `-${formatAmount(monthExpense)}`}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Savings Income by account */}
                    <p className="text-xs font-semibold mb-1">💰 Revenus épargne par compte</p>
                    {breakdownByAccount.savingsIncome.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-1">Aucun revenu</p>
                    ) : breakdownByAccount.savingsIncome.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                        <span className="text-xs flex items-center gap-1.5">
                          <span>{item.emoji}</span>
                          <span className="truncate max-w-[150px]">{item.name}</span>
                        </span>
                        <span className="font-mono-amount text-xs font-semibold text-success">+{formatAmount(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between mt-2 px-2 py-1.5 rounded-lg bg-success/10">
                      <span className="text-[11px] text-success">Sous-total revenus</span>
                      <span className="font-mono-amount text-xs text-success">+{formatAmount(savingsIncomeTotal)}</span>
                    </div>

                    {/* Savings Expense by account */}
                    <p className="text-xs font-semibold mt-3 mb-1">💸 Dépenses épargne par compte</p>
                    {breakdownByAccount.savingsExpense.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-1">Aucune dépense</p>
                    ) : breakdownByAccount.savingsExpense.map(item => (
                      <div key={`exp-${item.id}`} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                        <span className="text-xs flex items-center gap-1.5">
                          <span>{item.emoji}</span>
                          <span className="truncate max-w-[150px]">{item.name}</span>
                        </span>
                        <span className="font-mono-amount text-xs font-semibold text-destructive">-{formatAmount(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between mt-2 px-2 py-1.5 rounded-lg bg-destructive/10">
                      <span className="text-[11px] text-destructive">Sous-total dépenses</span>
                      <span className="font-mono-amount text-xs text-destructive">-{formatAmount(savingsExpenseTotal)}</span>
                    </div>

                    {/* Net total */}
                    <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-border">
                      <span className="text-xs font-bold">Épargne nette</span>
                      <span className={`font-mono-amount text-xs font-bold ${monthSavingsNet >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {monthSavingsNet >= 0 ? '+' : ''}{formatAmount(monthSavingsNet)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {monthIncome - monthExpense + Math.min(monthSavingsNet, 0) < 0 && (
          <div className="flex items-start gap-2 bg-destructive/5 border border-destructive/15 rounded-xl px-3 py-2.5">
            <TrendingDown className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              Vos dépenses dépassent vos revenus ce mois-ci. Essayez de réduire certaines dépenses pour ne pas puiser dans vos économies.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="w-full px-2 py-2 rounded-xl border border-border/30 bg-secondary/20 text-sm truncate">
              <option value="all">Tous types</option>
              <option value="income">Revenus</option>
              <option value="expense">Dépenses</option>
            </select>
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-border/30 bg-secondary/20 text-sm truncate">
              <option value="all">Membres</option>
              {household.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-border/30 bg-secondary/20 text-sm truncate">
              <option value="all">Catégories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Aucune transaction trouvée</div>
          ) : (
            filtered.map(t => {
              const member = getMemberById(t.memberId);
              const isRecTemplate = t.isRecurring && !t.recurringSourceId;
              const isRecGenerated = !!t.recurringSourceId;
              const isStopped = isRecTemplate && !!t.recurringEndMonth;
              const isSelected = selectedIds.has(t.id);
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
                  onClick={() => {
                    const isDebtTx = !!(t as any).debtId || t.id.startsWith('debt-sched-');
                    if (isDebtTx && !selectMode) {
                      setViewDebtTarget(t);
                      return;
                    }
                    selectMode ? toggleSelect(t.id) : openEditModal(t);
                  }}
                >
                  {selectMode && (
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                      {isSelected && <span className="text-primary-foreground text-xs font-bold">✓</span>}
                    </div>
                  )}
                  <div className="w-9 h-9 rounded-xl bg-card border border-border/30 flex items-center justify-center text-base shrink-0">{t.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      <span className="truncate">{t.label}</span>
                      {(isRecTemplate || isRecGenerated) && (
                        <span className="text-[9px] px-1 py-0.5 rounded-lg bg-primary/10 text-primary font-medium shrink-0">🔄</span>
                      )}
                      {isStopped && (
                        <span className="text-[9px] px-1 py-0.5 rounded-lg bg-muted text-muted-foreground font-medium shrink-0">⏹️</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {t.category} · {member?.name} · {formatDate(t.date)}
                      {isStopped && t.recurringEndMonth && (
                        <span> · Arrêtée en {formatMonth(t.recurringEndMonth)}</span>
                      )}
                    </p>
                  </div>
                  <ConvertedAmount transaction={t} className="shrink-0" />
                </div>
              );
            })
          )}
        </div>
        <p className="text-[10px] text-muted-foreground text-center">{filtered.length} transaction(s)</p>

        {/* Bulk delete bar */}
        <AnimatePresence>
          {selectMode && selectedIds.size > 0 && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-auto sm:bottom-8 sm:w-full sm:max-w-md sm:mx-auto z-40 flex items-center justify-between bg-destructive text-destructive-foreground rounded-2xl px-5 py-3 shadow-lg"
              style={{ left: '50%', transform: 'translateX(-50%)' }}
            >
              <span className="text-sm font-semibold">{selectedIds.size} sélectionnée(s)</span>
              <button onClick={handleBulkDelete} className="px-4 py-2 rounded-xl bg-destructive-foreground/20 text-sm font-bold hover:bg-destructive-foreground/30 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <AddTransferModal open={showTransferModal} onClose={() => setShowTransferModal(false)} />
      <ImportCSVModal open={showImportModal} onClose={() => setShowImportModal(false)} />

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setEditTarget(null)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border/30 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-base">{editTarget.emoji}</div>
                    <h2 className="text-base font-bold">Modifier</h2>
                  </div>
                  <button onClick={() => setEditTarget(null)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium mb-1">Libellé</label>
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>

                  {/* Debt transaction: show interest/principal fields */}
                  {(() => {
                    const isDebtTx = !!(editTarget as any).debtId || !!(editTarget as any).debt_id;
                    if (isDebtTx) {
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium mb-1">Intérêts</label>
                            <input type="number" step="0.01" value={editDebtInterest} onChange={e => setEditDebtInterest(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Amortissement</label>
                            <input type="number" step="0.01" value={editDebtPrincipal} onChange={e => setEditDebtPrincipal(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] text-muted-foreground">Total : {((parseFloat(editDebtInterest) || 0) + (parseFloat(editDebtPrincipal) || 0)).toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Standard amount (hidden for debt tx with breakdown) */}
                  {(() => {
                    const isDebtTx = !!(editTarget as any).debtId || !!(editTarget as any).debt_id;
                    if (isDebtTx) return null;
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium mb-1">Montant</label>
                          <input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Devise</label>
                          <input value={editTarget.currency} disabled className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-muted text-sm text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-xs font-medium mb-1">Catégorie</label>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {allCategories.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring">
                          {format(editDate, 'dd MMMM yyyy', { locale: fr })}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={editDate} onSelect={d => d && setEditDate(d)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Membre</label>
                    <div className="flex gap-2">
                      {household.members.map(m => (
                        <button key={m.id} onClick={() => setEditMemberId(m.id)} className={`px-3 py-2 rounded-xl border text-sm transition-all ${editMemberId === m.id ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}>{m.name}</button>
                      ))}
                    </div>
                  </div>

                  {accounts.filter(a => !a.isArchived).length > 0 && (
                    <div>
                      <label className="block text-xs font-medium mb-1">Compte</label>
                      <select value={editAccountId} onChange={e => setEditAccountId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="">Aucun compte</option>
                        {accounts.filter(a => !a.isArchived).map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-border/30 bg-secondary/20">
                    <div>
                      <p className="text-sm font-medium">🔄 Récurrente</p>
                      <p className="text-[10px] text-muted-foreground">Chaque mois le {editDate.getDate()}</p>
                    </div>
                    <button
                      onClick={() => setEditIsRecurring(!editIsRecurring)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${editIsRecurring ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editIsRecurring ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Notes</label>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                  </div>

                  <div className="bg-secondary/30 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground">Créée le {formatDateLong(editTarget.date)}</p>
                    {editTarget.currency !== editTarget.baseCurrency && (
                      <p className="text-[10px] text-muted-foreground">Taux : {editTarget.exchangeRate.toFixed(4)} ({editTarget.currency} → {editTarget.baseCurrency})</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                    <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Sauvegarder</button>
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

      {/* Delete Recurring Modal */}
      <AnimatePresence>
        {deleteRecTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setDeleteRecTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="bg-card w-full max-w-sm rounded-2xl border border-border/30 shadow-2xl p-5"
            >
              <h2 className="text-base font-bold mb-1">Supprimer la récurrence</h2>
              <p className="text-xs text-muted-foreground mb-4">{deleteRecTarget.emoji} {deleteRecTarget.label} — {formatAmount(deleteRecTarget.amount)}</p>
              <div className="space-y-2">
                <button onClick={handleSoftDeleteRec} className="w-full py-3 rounded-xl border border-border/30 bg-secondary/20 text-sm font-medium hover:bg-secondary/40 transition-colors text-left px-4">
                  <p className="font-semibold">⏹️ Arrêter pour les mois à venir</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">L'historique est conservé</p>
                </button>
                <button onClick={handleHardDeleteRec} className="w-full py-3 rounded-xl border border-destructive/20 bg-destructive/5 text-sm font-medium hover:bg-destructive/10 transition-colors text-left px-4">
                  <p className="font-semibold text-destructive">🗑️ Supprimer de tous les mois</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Suppression définitive</p>
                </button>
                <button onClick={() => setDeleteRecTarget(null)} className="w-full py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Read-only Debt Schedule Detail Modal */}
      <AnimatePresence>
        {viewDebtTarget && (() => {
          const t = viewDebtTarget;
          const member = getMemberById(t.memberId);
          const interestMatch = t.notes?.match(/Amortissement\s+([\d.]+)\s*\+\s*Intérêts\s+([\d.]+)/);
          const principal = interestMatch ? parseFloat(interestMatch[1]) : 0;
          const interest = interestMatch ? parseFloat(interestMatch[2]) : 0;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setViewDebtTarget(null)}
            >
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border/30 shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-base">{t.emoji}</div>
                      <div>
                        <h2 className="text-base font-bold">Détail échéance</h2>
                        <p className="text-[10px] text-muted-foreground">Consultation uniquement</p>
                      </div>
                    </div>
                    <button onClick={() => setViewDebtTarget(null)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center">
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-muted/50 rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Libellé</p>
                      <p className="text-sm font-medium">{t.label}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Montant total</p>
                        <p className="text-sm font-mono-amount font-semibold text-destructive">-{formatAmount(t.amount)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Date</p>
                        <p className="text-sm font-medium">{formatDateLong(t.date)}</p>
                      </div>
                    </div>

                    {(interest > 0 || principal > 0) && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/50 rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Intérêts</p>
                          <p className="text-sm font-mono-amount font-medium">{formatAmount(interest)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Amortissement</p>
                          <p className="text-sm font-mono-amount font-medium">{formatAmount(principal)}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Catégorie</p>
                        <p className="text-sm font-medium">{t.category}</p>
                      </div>
                      <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Membre</p>
                        <p className="text-sm font-medium">{member?.name || '—'}</p>
                      </div>
                    </div>

                    {t.notes && (
                      <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Notes</p>
                        <p className="text-sm">{t.notes}</p>
                      </div>
                    )}

                    <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 flex items-start gap-2">
                      <Eye className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-xs text-warning">Pour modifier cette échéance, rendez-vous dans l'onglet <Link to="/debts" className="underline font-semibold text-warning hover:text-warning/80">Dettes</Link>.</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <button onClick={() => setViewDebtTarget(null)} className="w-full py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Fermer</button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </Layout>
  );
};

export default Transactions;
