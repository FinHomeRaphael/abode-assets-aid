import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { EXPENSE_CATEGORIES, CATEGORY_EMOJIS } from '@/types/finance';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddBudgetModal = ({ open, onClose }: Props) => {
  const { addBudget } = useApp();
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [alerts, setAlerts] = useState(true);
  const [isRecurring, setIsRecurring] = useState(true);
  const isDebtCategory = category === 'Dettes';

  const handleCreate = () => {
    if (!category || !limit) { toast.error('Remplissez tous les champs'); return; }
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const effectiveRecurring = isDebtCategory ? false : isRecurring;
    addBudget({
      category,
      limit: parseFloat(limit),
      period,
      emoji: CATEGORY_EMOJIS[category] || '📌',
      alertsEnabled: alerts,
      recurring: effectiveRecurring,
      isRecurring: effectiveRecurring,
      monthYear: effectiveRecurring ? undefined : monthYear,
    });
    // silent
    onClose();
    setCategory(''); setLimit('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="relative w-full max-w-md mx-4 mb-4 md:mb-0 card-elevated p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Nouveau budget</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Catégorie</label>
              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {EXPENSE_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all truncate ${category === cat ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                  >
                    {CATEGORY_EMOJIS[cat]} {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Montant limite</label>
              <input type="number" value={limit} onChange={e => setLimit(e.target.value)} placeholder="500" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Période</label>
              <div className="flex bg-muted rounded-xl p-1">
                <button onClick={() => setPeriod('monthly')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${period === 'monthly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Mensuel</button>
                <button onClick={() => setPeriod('yearly')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${period === 'yearly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>Annuel</button>
              </div>
            </div>

            {isDebtCategory ? (
              <div className="bg-muted/50 border border-border rounded-xl px-3 py-2">
                <p className="text-xs text-muted-foreground">💡 Le budget Dettes s'adapte automatiquement chaque mois selon vos échéances. Il ne peut pas être récurrent.</p>
              </div>
            ) : (
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-6 rounded-full transition-colors ${isRecurring ? 'bg-primary' : 'bg-muted'} relative`} onClick={() => setIsRecurring(!isRecurring)}>
                  <div className={`w-4 h-4 bg-card rounded-full absolute top-1 transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm">Récurrent chaque mois</span>
              </label>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-10 h-6 rounded-full transition-colors ${alerts ? 'bg-primary' : 'bg-muted'} relative`} onClick={() => setAlerts(!alerts)}>
                <div className={`w-4 h-4 bg-card rounded-full absolute top-1 transition-transform ${alerts ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm">Alertes activées</span>
            </label>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
              <button onClick={handleCreate} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm">Créer</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddBudgetModal;