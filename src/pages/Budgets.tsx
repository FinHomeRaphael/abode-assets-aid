import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatDateLong } from '@/utils/format';
import { getBudgetStatus } from '@/utils/format';
import { useCurrency } from '@/hooks/useCurrency';
import { EXPENSE_CATEGORIES, CATEGORY_EMOJIS } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';
import { useSubscription } from '@/hooks/useSubscription';
import { Target, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';

const Budgets = () => {
  const { scopedBudgets: budgets, addBudget, updateBudget, getBudgetSpent, deleteBudget, softDeleteBudget, getBudgetsForMonth, getTransactionsForMonth, getMemberById, householdId, currentUser } = useApp();
  const { canAdd } = useSubscription(householdId, currentUser?.id);
  const { formatAmount } = useCurrency();
  const [showCreate, setShowCreate] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newPeriod, setNewPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [newAlerts, setNewAlerts] = useState(true);
  const [newIsRecurring, setNewIsRecurring] = useState(true);
  const [viewPeriod, setViewPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [editTarget, setEditTarget] = useState<typeof budgets[0] | null>(null);
  const [editLimit, setEditLimit] = useState('');
  const [editIsRecurring, setEditIsRecurring] = useState(true);
  const [editAlerts, setEditAlerts] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<typeof budgets[0] | null>(null);

  const handleCreate = () => {
    if (!newCategory || !newLimit) { toast.error('Remplissez tous les champs'); return; }
    const monthYear = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    addBudget({ category: newCategory, limit: parseFloat(newLimit), period: newPeriod, emoji: CATEGORY_EMOJIS[newCategory] || '📌', alertsEnabled: newAlerts, recurring: newIsRecurring, isRecurring: newIsRecurring, monthYear: newIsRecurring ? undefined : monthYear });
    toast.success('Budget créé ✓');
    setShowCreate(false); setNewCategory(''); setNewLimit('');
  };

  const filteredBudgets = useMemo(() => {
    const monthBudgets = getBudgetsForMonth(currentMonth);
    return monthBudgets.filter(b => b.period === viewPeriod);
  }, [getBudgetsForMonth, currentMonth, viewPeriod]);

  const currentMonthYear = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  const openEditModal = (b: typeof budgets[0]) => { setEditTarget(b); setEditLimit(String(b.limit)); setEditIsRecurring(b.isRecurring); setEditAlerts(b.alertsEnabled); };

  const handleSaveEdit = () => {
    if (!editTarget || !editLimit) return;
    updateBudget(editTarget.id, { limit: parseFloat(editLimit), isRecurring: editIsRecurring, alertsEnabled: editAlerts });
    toast.success('Budget modifié ✓'); setEditTarget(null);
  };

  const handleDeleteFromEdit = () => { if (!editTarget) return; setDeleteTarget(editTarget); setEditTarget(null); };
  const handleSoftDelete = () => { if (!deleteTarget) return; softDeleteBudget(deleteTarget.id); toast.success('Budget arrêté'); setDeleteTarget(null); };
  const handleHardDelete = () => { if (!deleteTarget) return; deleteBudget(deleteTarget.id); toast.success('Budget supprimé'); setDeleteTarget(null); };

  const formatMonth = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(parseInt(y), parseInt(m) - 1));
  };

  return (
    <Layout>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 via-transparent to-transparent h-64" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative space-y-4">
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Budgets</h1>
          <button onClick={() => setShowCreate(true)} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Créer
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex bg-secondary/30 border border-border/30 rounded-xl p-1">
            <button onClick={() => setViewPeriod('monthly')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewPeriod === 'monthly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Mensuel</button>
            <button onClick={() => setViewPeriod('yearly')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewPeriod === 'yearly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Annuel</button>
          </div>
          {viewPeriod === 'monthly' && <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />}
          {viewPeriod === 'yearly' && (
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth()))} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors">
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-sm font-medium min-w-[4rem] text-center">{currentMonth.getFullYear()}</span>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth()))} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {filteredBudgets.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
            Aucun budget {viewPeriod === 'monthly' ? 'mensuel' : 'annuel'} pour ce mois
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {filteredBudgets.map(b => {
              const spent = getBudgetSpent(b, currentMonth);
              const status = getBudgetStatus(spent, b.limit);
              const pct = Math.min((spent / b.limit) * 100, 100);
              const isStopped = !!b.endMonth && b.endMonth <= currentMonthYear;
              return (
                <div key={b.id} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]" onClick={() => openEditModal(b)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{b.emoji} {b.category}</span>
                    <div className="flex items-center gap-1.5">
                      {b.isRecurring && !isStopped && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary font-medium">🔄</span>
                      )}
                      {isStopped && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-muted text-muted-foreground font-medium">⏹️</span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                        status === 'ok' ? 'bg-success/10 text-success' : status === 'warning' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                      }`}>
                        {status === 'ok' ? '✓ OK' : status === 'warning' ? '⚠️' : '❌'}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${status === 'ok' ? 'bg-success' : status === 'warning' ? 'bg-warning' : 'bg-destructive'}`} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono-amount text-muted-foreground">{formatAmount(spent)} / {formatAmount(b.limit)}</span>
                    <span className="font-mono-amount font-semibold">{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl border border-border/30 shadow-2xl overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-border/30 flex items-center justify-between">
                  <h2 className="text-base font-bold">Créer un budget</h2>
                  <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium mb-1">Catégorie</label>
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm">
                      <option value="">Sélectionner...</option>
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Montant limite</label>
                    <input type="number" value={newLimit} onChange={e => setNewLimit(e.target.value)} placeholder="500" className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Période</label>
                    <div className="flex gap-2">
                      <button onClick={() => setNewPeriod('monthly')} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${newPeriod === 'monthly' ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}>📅 Mensuel</button>
                      <button onClick={() => setNewPeriod('yearly')} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${newPeriod === 'yearly' ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}>📆 Annuel</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Type</label>
                    <div className="flex gap-2">
                      <button onClick={() => setNewIsRecurring(true)} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${newIsRecurring ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}>🔄 Récurrent</button>
                      <button onClick={() => setNewIsRecurring(false)} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${!newIsRecurring ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'}`}>📌 Ponctuel</button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{newIsRecurring ? 'Actif tous les mois.' : 'Mois en cours uniquement.'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={newAlerts} onChange={e => setNewAlerts(e.target.checked)} id="alerts" className="rounded" />
                    <label htmlFor="alerts" className="text-xs">Alertes activées</label>
                  </div>
                </div>
                <div className="px-5 pb-5 flex gap-2">
                  <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                  <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Créer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit modal */}
        <AnimatePresence>
          {editTarget && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setEditTarget(null)}>
              <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl border border-border/30 shadow-2xl overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-border/30 flex items-center justify-between">
                  <h2 className="text-base font-bold">{editTarget.emoji} {editTarget.category}</h2>
                  <button onClick={() => setEditTarget(null)} className="w-8 h-8 rounded-xl bg-secondary/50 flex items-center justify-center"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="p-5">
                  {/* Stats */}
                  {(() => {
                    const spent = getBudgetSpent(editTarget, currentMonth);
                    const status = getBudgetStatus(spent, editTarget.limit);
                    const pct = Math.min((spent / editTarget.limit) * 100, 100);
                    const remaining = Math.max(editTarget.limit - spent, 0);
                    return (
                      <div className="bg-secondary/30 border border-border/30 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">Dépensé</span>
                          <span className="font-mono-amount font-semibold">{formatAmount(spent)} / {formatAmount(editTarget.limit)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                          <div className={`h-full rounded-full ${status === 'ok' ? 'bg-success' : status === 'warning' ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{Math.round(pct)}% utilisé</span>
                          <span>Reste : {formatAmount(remaining)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Transaction history */}
                  {(() => {
                    const monthTx = getTransactionsForMonth(currentMonth);
                    const budgetTx = monthTx.filter(t => t.type === 'expense' && t.category === editTarget.category).sort((a, b) => b.date.localeCompare(a.date));
                    if (budgetTx.length === 0) return <div className="bg-secondary/20 rounded-xl p-3 mb-4 text-center text-[10px] text-muted-foreground">Aucune transaction ce mois</div>;
                    return (
                      <div className="mb-4">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Transactions ({budgetTx.length})</p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {budgetTx.map(t => {
                            const member = getMemberById(t.memberId);
                            return (
                              <div key={t.id} className="flex items-center justify-between text-[11px] bg-secondary/30 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span>{t.emoji}</span>
                                  <span className="truncate font-medium">{t.label}</span>
                                  <span className="text-muted-foreground shrink-0">{formatDateLong(t.date)}</span>
                                </div>
                                <span className="font-mono-amount font-medium text-destructive shrink-0 ml-2">-{formatAmount(t.convertedAmount)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium mb-1">Montant limite</label>
                      <input type="number" value={editLimit} onChange={e => setEditLimit(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border/30 bg-secondary/20 text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Type</label>
                      <div className="flex gap-2">
                        <button onClick={() => setEditIsRecurring(true)} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${editIsRecurring ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20'}`}>🔄 Récurrent</button>
                        <button onClick={() => setEditIsRecurring(false)} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${!editIsRecurring ? 'border-primary bg-primary/5 text-primary' : 'border-border/30 bg-secondary/20'}`}>📌 Ponctuel</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={editAlerts} onChange={e => setEditAlerts(e.target.checked)} id="editAlerts" className="rounded" />
                      <label htmlFor="editAlerts" className="text-xs">Alertes</label>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex gap-2">
                      <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 rounded-xl border border-border/30 text-sm font-medium hover:bg-secondary/30 transition-colors">Annuler</button>
                      <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Sauvegarder</button>
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
      </motion.div>
    </Layout>
  );
};

export default Budgets;
