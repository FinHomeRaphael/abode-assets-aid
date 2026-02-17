import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CURRENCIES, CATEGORY_EMOJIS } from '@/types/finance';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddTransactionModal = ({ open, onClose }: Props) => {
  const { addTransaction, household } = useApp();
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(household.currency);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [memberId, setMemberId] = useState(household.members[0]?.id || '');
  const [notes, setNotes] = useState('');

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSubmit = () => {
    if (!label.trim() || !amount || !category) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    addTransaction({
      type,
      label: label.trim(),
      amount: parseFloat(amount),
      currency,
      category,
      memberId,
      date: date.toISOString().split('T')[0],
      notes: notes.trim() || undefined,
      emoji: CATEGORY_EMOJIS[category] || '📌',
    });
    toast.success('Transaction ajoutée ✓');
    resetAndClose();
  };

  const resetAndClose = () => {
    setLabel('');
    setAmount('');
    setCategory('');
    setNotes('');
    setDate(new Date());
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={resetAndClose}
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-lg border border-border shadow-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Nouvelle transaction</h2>
              <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            {/* Type toggle */}
            <div className="flex mb-5 bg-secondary rounded-md p-1">
              <button onClick={() => { setType('expense'); setCategory(''); }} className={`flex-1 py-2 rounded-sm text-sm font-medium transition-colors ${type === 'expense' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                Dépense
              </button>
              <button onClick={() => { setType('income'); setCategory(''); }} className={`flex-1 py-2 rounded-sm text-sm font-medium transition-colors ${type === 'income' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                Revenu
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Libellé *</label>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Courses Carrefour" className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Montant *</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Devise</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Catégorie *</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Sélectionner...</option>
                  {categories.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring">
                      {format(date, 'dd MMMM yyyy', { locale: fr })}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Membre</label>
                <div className="flex gap-2">
                  {household.members.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMemberId(m.id)}
                      className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                        memberId === m.id ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-secondary'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes optionnelles..." rows={2} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={resetAndClose} className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">
                Annuler
              </button>
              <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                Enregistrer
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AddTransactionModal;
