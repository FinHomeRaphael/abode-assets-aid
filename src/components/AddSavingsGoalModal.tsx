import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { EMOJI_LIST, CURRENCIES, CURRENCY_SYMBOLS } from '@/types/finance';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddSavingsGoalModal = ({ open, onClose }: Props) => {
  const { addSavingsGoal, household } = useApp();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [currency, setCurrency] = useState(household.currency);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleCreate = () => {
    if (!name.trim() || !target) { toast.error('Remplissez les champs obligatoires'); return; }
    addSavingsGoal({ name: name.trim(), emoji, target: parseFloat(target), currency, targetDate: date || undefined });
    toast.success('Objectif créé ✓');
    onClose();
    setName(''); setTarget(''); setDate('');
    setCurrency(household.currency);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="relative w-full max-w-md mx-4 mb-4 md:mb-0 card-elevated p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Nouvel objectif d'épargne</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Emoji</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl hover:bg-accent transition-colors">
                  {emoji}
                </button>
                <span className="text-sm text-muted-foreground">Clique pour changer</span>
              </div>
              {showEmojiPicker && (
                <div className="mt-2 flex flex-wrap gap-1.5 p-3 bg-muted rounded-xl max-h-32 overflow-y-auto">
                  {EMOJI_LIST.map(e => (
                    <button key={e} onClick={() => { setEmoji(e); setShowEmojiPicker(false); }} className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg hover:bg-accent transition-colors ${emoji === e ? 'bg-primary/20 ring-2 ring-primary' : ''}`}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Nom de l'objectif</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Vacances, Voiture..." className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Montant cible</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="5000" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Devise</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} — {c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Date cible (optionnel)</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

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

export default AddSavingsGoalModal;