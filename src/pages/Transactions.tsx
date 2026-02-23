import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatDate, formatDateLong, formatLocalDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CURRENCIES, CATEGORY_EMOJIS } from '@/types/finance';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import AddTransactionModal from '@/components/AddTransactionModal';
import AddTransferModal from '@/components/AddTransferModal';
import ImportCSVModal from '@/components/ImportCSVModal';
import ConvertedAmount from '@/components/ConvertedAmount';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Wallet, Search, Plus, ArrowLeftRight, Download, CheckSquare, X, Trash2 } from 'lucide-react';

const Transactions = () => {
  const { scopedTransactions: transactions, getMemberById, household, getTransactionsForMonth, deleteTransaction, updateTransaction, softDeleteRecurringTransaction, accounts, financeScope } = useApp();
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

  const [deleteRecTarget, setDeleteRecTarget] = useState<typeof transactions[0] | null>(null);

  const monthTx = useMemo(() => getTransactionsForMonth(currentMonth), [currentMonth, getTransactionsForMonth]);
  const categories = [...new Set(monthTx.map(t => t.category))].sort();

  const filtered = monthTx.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterMember !== 'all' && t.memberId !== filterMember) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (search && !t.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const monthIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.convertedAmount, 0);
  const monthExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.convertedAmount, 0);

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
  };

  const handleSaveEdit = () => {
    if (!editTarget || !editLabel.trim() || !editAmount || !editCategory) return;
    const day = editDate.getDate();
    updateTransaction(editTarget.id, {
      label: editLabel.trim(),
      amount: parseFloat(editAmount),
      category: editCategory,
      date: formatLocalDate(editDate),
      memberId: editMemberId,
      notes: editNotes.trim() || undefined,
      emoji: CATEGORY_EMOJIS[editCategory] || editTarget.emoji,
      isRecurring: editIsRecurring,
      recurrenceDay: editIsRecurring ? day : undefined,
      accountId: editAccountId || undefined,
    });
    toast.success('Transaction modifiée ✓');
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
      toast.success('Transaction supprimée');
      setEditTarget(null);
    }
  };

  const handleSoftDeleteRec = () => {
    if (!deleteRecTarget) return;
    const monthYear = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    softDeleteRecurringTransaction(deleteRecTarget.id, monthYear);
    toast.success('Transaction arrêtée à partir de ce mois');
    setDeleteRecTarget(null);
  };

  const handleHardDeleteRec = () => {
    if (!deleteRecTarget) return;
    deleteTransaction(deleteRecTarget.id);
    toast.success('Transaction supprimée définitivement');
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
    toast.success(`${selectedIds.size} transaction(s) supprimée(s)`);
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
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
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-success/5 border border-success/15 rounded-xl p-3 text-center">
            <TrendingUp className="w-3.5 h-3.5 text-success mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground mb-0.5">Revenus</p>
            <p className="font-mono-amount font-bold text-success text-sm">+{formatAmount(monthIncome)}</p>
          </div>
          <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-3 text-center">
            <TrendingDown className="w-3.5 h-3.5 text-destructive mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground mb-0.5">Dépenses</p>
            <p className="font-mono-amount font-bold text-destructive text-sm">-{formatAmount(monthExpense)}</p>
          </div>
          <div className={`border rounded-xl p-3 text-center ${monthIncome - monthExpense >= 0 ? 'bg-success/5 border-success/15' : 'bg-destructive/5 border-destructive/15'}`}>
            <Wallet className={`w-3.5 h-3.5 mx-auto mb-1 ${monthIncome - monthExpense >= 0 ? 'text-success' : 'text-destructive'}`} />
            <p className="text-[10px] text-muted-foreground mb-0.5">Solde</p>
            <p className={`font-mono-amount font-bold text-sm ${monthIncome - monthExpense >= 0 ? 'text-success' : 'text-destructive'}`}>
              {monthIncome - monthExpense >= 0 ? '+' : ''}{formatAmount(monthIncome - monthExpense)}
            </p>
          </div>
        </div>

        {/* Filters */}
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
        <div className="bg-secondary/20 border border-border/30 rounded-2xl divide-y divide-border/30 overflow-hidden">
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
                  onClick={() => selectMode ? toggleSelect(t.id) : openEditModal(t)}
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
    </Layout>
  );
};

export default Transactions;
