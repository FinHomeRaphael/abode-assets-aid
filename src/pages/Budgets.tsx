import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatAmount, getBudgetStatus } from '@/utils/format';
import { EXPENSE_CATEGORIES, CATEGORY_EMOJIS } from '@/types/finance';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

const Budgets = () => {
  const { budgets, addBudget } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newAlerts, setNewAlerts] = useState(true);

  const handleCreate = () => {
    if (!newCategory || !newLimit) { toast.error('Remplissez tous les champs'); return; }
    addBudget({
      category: newCategory,
      limit: parseFloat(newLimit),
      spent: 0,
      emoji: CATEGORY_EMOJIS[newCategory] || '📌',
      alertsEnabled: newAlerts,
    });
    toast.success('Budget créé ✓');
    setShowCreate(false);
    setNewCategory('');
    setNewLimit('');
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">🎯 Budgets</h1>
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            + Créer un budget
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {budgets.map(b => {
            const status = getBudgetStatus(b.spent, b.limit);
            const pct = Math.min((b.spent / b.limit) * 100, 100);
            return (
              <div key={b.id} className="bg-card border border-border rounded-lg p-5 card-hover">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">{b.emoji} {b.category}</span>
                  {status === 'over' && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Dépassé</span>}
                  {status === 'warning' && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">Attention</span>}
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden mb-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      status === 'ok' ? 'bg-success' : status === 'warning' ? 'bg-warning' : 'bg-destructive'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono">{formatAmount(b.spent)} / {formatAmount(b.limit)}</span>
                  <span className="text-muted-foreground">{Math.round(pct)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowCreate(false)}
            >
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
