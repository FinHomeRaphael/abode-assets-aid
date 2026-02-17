import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatAmount, getBudgetStatus } from '@/utils/format';
import { EXPENSE_CATEGORIES, CATEGORY_EMOJIS } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import MonthSelector from '@/components/MonthSelector';

const Budgets = () => {
  const { budgets, addBudget, getBudgetSpent, deleteBudget } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newPeriod, setNewPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [newAlerts, setNewAlerts] = useState(true);
  const [newRecurring, setNewRecurring] = useState(true);
  const [viewPeriod, setViewPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handleCreate = () => {
    if (!newCategory || !newLimit) { toast.error('Remplissez tous les champs'); return; }
    addBudget({
      category: newCategory,
      limit: parseFloat(newLimit),
      period: newPeriod,
      emoji: CATEGORY_EMOJIS[newCategory] || '📌',
      alertsEnabled: newAlerts,
      recurring: newRecurring,
    });
    toast.success('Budget créé ✓');
    setShowCreate(false);
    setNewCategory('');
    setNewLimit('');
  };

  const filteredBudgets = budgets.filter(b => b.period === viewPeriod);

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Budgets</h1>
          <button onClick={() => setShowCreate(true)} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            + Créer
          </button>
        </div>

        {/* Period toggle + Month selector */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex bg-muted rounded-xl p-1">
            <button onClick={() => setViewPeriod('monthly')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewPeriod === 'monthly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Mensuel</button>
            <button onClick={() => setViewPeriod('yearly')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewPeriod === 'yearly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Annuel</button>
          </div>
          {viewPeriod === 'monthly' && <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />}
          {viewPeriod === 'yearly' && <span className="text-sm text-muted-foreground">Année {currentMonth.getFullYear()}</span>}
        </div>

        {filteredBudgets.length === 0 ? (
          <div className="card-elevated p-8 text-center text-muted-foreground text-sm">
            Aucun budget {viewPeriod === 'monthly' ? 'mensuel' : 'annuel'} créé
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredBudgets.map(b => {
              const spent = getBudgetSpent(b, currentMonth);
              const status = getBudgetStatus(spent, b.limit);
              const pct = Math.min((spent / b.limit) * 100, 100);
              return (
                <div key={b.id} className="card-elevated p-5 card-hover group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{b.emoji} {b.category}</span>
                    <div className="flex items-center gap-2">
                      {(b.recurring ?? true) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary font-medium">🔄</span>
                      )}
                      {status === 'over' && <span className="text-[10px] px-2 py-1 rounded-lg bg-destructive/10 text-destructive font-semibold">Dépassé</span>}
                      {status === 'warning' && <span className="text-[10px] px-2 py-1 rounded-lg bg-warning/10 text-warning font-semibold">Attention</span>}
                      <button
                        onClick={() => { deleteBudget(b.id); toast.success('Budget supprimé'); }}
                        className="text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${status === 'ok' ? 'bg-primary' : status === 'warning' ? 'bg-warning' : 'bg-destructive'}`} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono-amount text-muted-foreground">{formatAmount(spent)} / {formatAmount(b.limit)}</span>
                    <span className="font-semibold">{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl shadow-card-lg p-6">
                <h2 className="text-lg font-bold mb-5">Créer un budget</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Catégorie</label>
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm">
                      <option value="">Sélectionner...</option>
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Montant limite</label>
                    <input type="number" value={newLimit} onChange={e => setNewLimit(e.target.value)} placeholder="500" className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Période</label>
                    <div className="flex gap-2">
                      <button onClick={() => setNewPeriod('monthly')} className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${newPeriod === 'monthly' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>📅 Mensuel</button>
                      <button onClick={() => setNewPeriod('yearly')} className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${newPeriod === 'yearly' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>📆 Annuel</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">🔄 Récurrent</p>
                      <p className="text-xs text-muted-foreground">Se renouvelle chaque {newPeriod === 'monthly' ? 'mois' : 'année'}</p>
                    </div>
                    <button onClick={() => setNewRecurring(!newRecurring)} className={`relative w-11 h-6 rounded-full transition-colors ${newRecurring ? 'bg-primary' : 'bg-border'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform ${newRecurring ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={newAlerts} onChange={e => setNewAlerts(e.target.checked)} id="alerts" className="rounded" />
                    <label htmlFor="alerts" className="text-sm">Activer les alertes</label>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                  <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Créer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
};

export default Budgets;
