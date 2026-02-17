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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">🎯 Budgets</h1>
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            + Créer un budget
          </button>
        </div>

        {/* Period toggle + Month selector */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex bg-secondary rounded-md p-1">
            <button onClick={() => setViewPeriod('monthly')} className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-colors ${viewPeriod === 'monthly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Mensuel</button>
            <button onClick={() => setViewPeriod('yearly')} className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-colors ${viewPeriod === 'yearly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Annuel</button>
          </div>
          {viewPeriod === 'monthly' && <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />}
          {viewPeriod === 'yearly' && <span className="text-sm text-muted-foreground">Année {currentMonth.getFullYear()}</span>}
        </div>

        {filteredBudgets.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
            Aucun budget {viewPeriod === 'monthly' ? 'mensuel' : 'annuel'} créé
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredBudgets.map(b => {
              const spent = getBudgetSpent(b, currentMonth);
              const status = getBudgetStatus(spent, b.limit);
              const pct = Math.min((spent / b.limit) * 100, 100);
              return (
                <div key={b.id} className="bg-card border border-border rounded-lg p-5 card-hover group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">{b.emoji} {b.category}</span>
                    <div className="flex items-center gap-2">
                      {(b.recurring ?? true) && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary" title="Budget récurrent">🔄</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{b.period === 'monthly' ? '/ mois' : '/ an'}</span>
                      {status === 'over' && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Dépassé</span>}
                      {status === 'warning' && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">Attention</span>}
                      <button
                        onClick={() => { deleteBudget(b.id); toast.success('Budget supprimé'); }}
                        className="text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="h-3 bg-secondary rounded-full overflow-hidden mb-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${status === 'ok' ? 'bg-success' : status === 'warning' ? 'bg-warning' : 'bg-destructive'}`} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono">{formatAmount(spent)} / {formatAmount(b.limit)}</span>
                    <span className="text-muted-foreground">{Math.round(pct)}%</span>
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
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-lg border border-border shadow-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Créer un budget</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Catégorie</label>
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm">
                      <option value="">Sélectionner...</option>
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Montant limite</label>
                    <input type="number" value={newLimit} onChange={e => setNewLimit(e.target.value)} placeholder="500" className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Période</label>
                    <div className="flex gap-2">
                      <button onClick={() => setNewPeriod('monthly')} className={`flex-1 py-2.5 rounded-md border text-sm font-medium transition-colors ${newPeriod === 'monthly' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-secondary'}`}>📅 Mensuel</button>
                      <button onClick={() => setNewPeriod('yearly')} className={`flex-1 py-2.5 rounded-md border text-sm font-medium transition-colors ${newPeriod === 'yearly' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-secondary'}`}>📆 Annuel</button>
                    </div>
                  </div>

                  {/* Recurring toggle */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-md border border-border bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">🔄 Budget récurrent</p>
                      <p className="text-xs text-muted-foreground">Se renouvelle automatiquement chaque {newPeriod === 'monthly' ? 'mois' : 'année'}</p>
                    </div>
                    <button
                      onClick={() => setNewRecurring(!newRecurring)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${newRecurring ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${newRecurring ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={newAlerts} onChange={e => setNewAlerts(e.target.checked)} id="alerts" className="rounded" />
                    <label htmlFor="alerts" className="text-sm">Activer les alertes</label>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">Annuler</button>
                  <button onClick={handleCreate} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Créer</button>
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
