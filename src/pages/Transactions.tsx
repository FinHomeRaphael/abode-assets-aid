import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import AddTransactionModal from '@/components/AddTransactionModal';
import ConvertedAmount from '@/components/ConvertedAmount';
import { toast } from 'sonner';

const Transactions = () => {
  const { transactions, getMemberById, household, getTransactionsForMonth, deleteTransaction } = useApp();
  const { formatAmount, currency } = useCurrency();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterMember, setFilterMember] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<typeof transactions[0] | null>(null);

  // Swipe state
  const [swipedId, setSwipedId] = useState<string | null>(null);

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

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteTransaction(deleteTarget.id);
    toast.success('Transaction supprimée');
    setDeleteTarget(null);
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
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." className="px-3.5 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-[200px]" />
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-3.5 py-2.5 rounded-xl border border-input bg-card text-sm">
            <option value="all">Tous types</option>
            <option value="income">Revenus</option>
            <option value="expense">Dépenses</option>
          </select>
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="px-3.5 py-2.5 rounded-xl border border-input bg-card text-sm">
            <option value="all">Tous membres</option>
            {household.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3.5 py-2.5 rounded-xl border border-input bg-card text-sm">
            <option value="all">Toutes catégories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
              const isSwiped = swipedId === t.id;
              return (
                <div
                  key={t.id}
                  className="relative overflow-hidden"
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    (e.currentTarget as any)._startX = touch.clientX;
                  }}
                  onTouchEnd={(e) => {
                    const startX = (e.currentTarget as any)._startX;
                    const endX = e.changedTouches[0].clientX;
                    const diff = startX - endX;
                    if (diff > 60) {
                      setSwipedId(t.id);
                    } else if (diff < -30) {
                      setSwipedId(null);
                    }
                  }}
                >
                  {/* Delete button behind (mobile swipe) */}
                  <div className="absolute inset-y-0 right-0 flex items-center sm:hidden">
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="h-full px-6 bg-destructive text-destructive-foreground text-sm font-semibold"
                    >
                      Supprimer
                    </button>
                  </div>

                  <div
                    className={`flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-all bg-card relative ${isSwiped ? '-translate-x-28 sm:translate-x-0' : 'translate-x-0'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-lg">{t.emoji}</div>
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          {t.label}
                          {(isRecTemplate || isRecGenerated) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary font-medium">🔄</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{t.category} · {member?.name} · {formatDate(t.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConvertedAmount transaction={t} />
                      {/* Desktop delete menu */}
                      <div className="hidden sm:block relative group">
                        <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          ⋮
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[140px]">
                          <button
                            onClick={() => setDeleteTarget(t)}
                            className="w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10 text-left transition-colors"
                          >
                            🗑️ Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center">{filtered.length} transaction(s)</p>
      </motion.div>

      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card w-full max-w-sm rounded-2xl shadow-card-lg p-6"
            >
              <h2 className="text-lg font-bold mb-4">Supprimer cette transaction ?</h2>
              <div className="bg-muted/50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-lg">{deleteTarget.emoji}</div>
                  <div>
                    <p className="text-sm font-semibold">{deleteTarget.label}</p>
                    <p className="text-xs text-muted-foreground">{deleteTarget.category} · {formatDate(deleteTarget.date)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <ConvertedAmount transaction={deleteTarget} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">Cette action est irréversible.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                <button onClick={handleConfirmDelete} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors">Supprimer</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default Transactions;
