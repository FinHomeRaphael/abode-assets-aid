import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatDate, formatDateLong } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CURRENCIES, CATEGORY_EMOJIS } from '@/types/finance';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import AddTransactionModal from '@/components/AddTransactionModal';
import ConvertedAmount from '@/components/ConvertedAmount';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const Transactions = () => {
  const { transactions, getMemberById, household, getTransactionsForMonth, deleteTransaction, updateTransaction, softDeleteRecurringTransaction } = useApp();
  const { formatAmount, currency } = useCurrency();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterMember, setFilterMember] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<typeof transactions[0] | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editMemberId, setEditMemberId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsRecurring, setEditIsRecurring] = useState(false);

  // Delete recurring modal
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
    setEditDate(new Date(t.date));
    setEditMemberId(t.memberId);
    setEditNotes(t.notes || '');
    setEditIsRecurring(!!t.isRecurring);
  };

  const handleSaveEdit = () => {
    if (!editTarget || !editLabel.trim() || !editAmount || !editCategory) return;
    const day = editDate.getDate();
    updateTransaction(editTarget.id, {
      label: editLabel.trim(),
      amount: parseFloat(editAmount),
      category: editCategory,
      date: editDate.toISOString().split('T')[0],
      memberId: editMemberId,
      notes: editNotes.trim() || undefined,
      emoji: CATEGORY_EMOJIS[editCategory] || editTarget.emoji,
      isRecurring: editIsRecurring,
      recurrenceDay: editIsRecurring ? day : undefined,
    });
    toast.success('Transaction modifiée ✓');
    setEditTarget(null);
  };

  const handleDeleteFromEdit = () => {
    if (!editTarget) return;
    // If it's a recurring template OR a generated recurring instance, show recurring delete modal
    if (editTarget.isRecurring || editTarget.recurringSourceId) {
      // Find the actual template for generated instances
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

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Transactions</h1>
          <button onClick={() => setShowAddModal(true)} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            + Créer
          </button>
        </div>
        <div className="flex justify-center">
          <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />
        </div>

        {/* Month totals */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-elevated p-3.5 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Revenus</p>
            <p className="font-mono-amount font-bold text-success text-sm">+{formatAmount(monthIncome)}</p>
          </div>
          <div className="card-elevated p-3.5 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Dépenses</p>
            <p className="font-mono-amount font-bold text-destructive text-sm">-{formatAmount(monthExpense)}</p>
          </div>
          <div className="card-elevated p-3.5 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Solde</p>
            <p className={`font-mono-amount font-bold text-sm ${monthIncome - monthExpense >= 0 ? 'text-success' : 'text-destructive'}`}>
              {monthIncome - monthExpense >= 0 ? '+' : ''}{formatAmount(monthIncome - monthExpense)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="grid grid-cols-3 gap-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="w-full px-2 py-2.5 rounded-xl border border-input bg-card text-sm truncate">
              <option value="all">Tous types</option>
              <option value="income">Revenus</option>
              <option value="expense">Dépenses</option>
            </select>
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="w-full px-2 py-2.5 rounded-xl border border-input bg-card text-sm truncate">
              <option value="all">Membres</option>
              {household.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-2 py-2.5 rounded-xl border border-input bg-card text-sm truncate">
              <option value="all">Catégories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="card-elevated divide-y divide-border/50 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Aucune transaction trouvée</div>
          ) : (
            filtered.map(t => {
              const member = getMemberById(t.memberId);
              const isRecTemplate = t.isRecurring && !t.recurringSourceId;
              const isRecGenerated = !!t.recurringSourceId;
              const isStopped = isRecTemplate && !!t.recurringEndMonth;
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => openEditModal(t)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-lg">{t.emoji}</div>
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        {t.label}
                        {(isRecTemplate || isRecGenerated) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary font-medium">🔄</span>
                        )}
                        {isStopped && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-muted text-muted-foreground font-medium">⏹️</span>
                        )}
                        {(t as any).isAutoGenerated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-accent/20 text-accent-foreground font-medium">🔄 Auto</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.category} · {member?.name} · {formatDate(t.date)}
                        {isStopped && t.recurringEndMonth && (
                          <span className="ml-1 text-muted-foreground"> · Arrêtée en {formatMonth(t.recurringEndMonth)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <ConvertedAmount transaction={t} />
                </div>
              );
            })
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center">{filtered.length} transaction(s)</p>
      </motion.div>

      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setEditTarget(null)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-card-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">{editTarget.emoji} Modifier la transaction</h2>
                  <button onClick={() => setEditTarget(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Libellé</label>
                    <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Montant</label>
                      <input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Devise</label>
                      <input value={editTarget.currency} disabled className="w-full px-4 py-2.5 rounded-xl border border-input bg-muted text-sm text-muted-foreground" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Catégorie</label>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {allCategories.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring">
                          {format(editDate, 'dd MMMM yyyy', { locale: fr })}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={editDate} onSelect={d => d && setEditDate(d)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Membre</label>
                    <div className="flex gap-2">
                      {household.members.map(m => (
                        <button key={m.id} onClick={() => setEditMemberId(m.id)} className={`px-3 py-2 rounded-xl border text-sm transition-all ${editMemberId === m.id ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>{m.name}</button>
                      ))}
                    </div>
                  </div>

                  {/* Recurring toggle */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl border border-border bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">🔄 Transaction récurrente</p>
                      <p className="text-xs text-muted-foreground">Se répète chaque mois le {editDate.getDate()}</p>
                    </div>
                    <button
                      onClick={() => setEditIsRecurring(!editIsRecurring)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${editIsRecurring ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editIsRecurring ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">Notes</label>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                  </div>

                  {/* Info lines */}
                  <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Créée le {formatDateLong(editTarget.date)}</p>
                    {editTarget.currency !== editTarget.baseCurrency && (
                      <p className="text-xs text-muted-foreground">Taux de change appliqué : {editTarget.exchangeRate.toFixed(4)} ({editTarget.currency} → {editTarget.baseCurrency})</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex gap-3">
                    <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                    <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Sauvegarder</button>
                  </div>
                  <button onClick={handleDeleteFromEdit} className="w-full py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors">
                    🗑️ Supprimer cette transaction
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Recurring Transaction Modal */}
      <AnimatePresence>
        {deleteRecTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDeleteRecTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card w-full max-w-sm rounded-2xl shadow-card-lg p-6"
            >
              <h2 className="text-lg font-bold mb-2">Supprimer la transaction récurrente</h2>
              <p className="text-sm text-muted-foreground mb-5">{deleteRecTarget.emoji} {deleteRecTarget.label} — {formatAmount(deleteRecTarget.amount)}</p>
              <div className="space-y-3">
                <button onClick={handleSoftDeleteRec} className="w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors text-left px-4">
                  <p className="font-semibold">⏹️ Supprimer pour les mois à venir</p>
                  <p className="text-xs text-muted-foreground mt-0.5">L'historique est conservé dans les mois passés</p>
                </button>
                <button onClick={handleHardDeleteRec} className="w-full py-3 rounded-xl border border-destructive/30 text-sm font-medium hover:bg-destructive/5 transition-colors text-left px-4">
                  <p className="font-semibold text-destructive">🗑️ Supprimer de tous les mois</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Suppression totale et définitive</p>
                </button>
                <button onClick={() => setDeleteRecTarget(null)} className="w-full py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default Transactions;
