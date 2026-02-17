import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { CATEGORY_EMOJIS } from '@/types/finance';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

const MERCHANTS = ['Carrefour', 'Leclerc', 'Amazon', 'SNCF', 'Auchan', 'Lidl', 'Decathlon', 'Ikea'];
const CATEGORIES = ['Alimentation', 'Shopping', 'Transport', 'Services', 'Restaurants', 'Santé'];

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function recentDate() {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * 7));
  return d.toISOString().split('T')[0];
}

const ScanTicketModal = ({ open, onClose }: Props) => {
  const { addTransaction, household } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'loading' | 'review'>('upload');
  const [preview, setPreview] = useState<string | null>(null);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setStep('loading');
      setTimeout(() => {
        const m = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
        const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        setMerchant(m);
        setAmount(String(randomBetween(10, 200)));
        setDate(recentDate());
        setCategory(cat);
        setStep('review');
      }, 2000);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleSubmit = () => {
    if (!merchant || !amount || !category) {
      toast.error('Remplissez tous les champs');
      return;
    }
    addTransaction({
      type: 'expense',
      label: merchant,
      amount: parseFloat(amount),
      currency: household.currency,
      category,
      memberId: household.members[0]?.id || '1',
      date,
      emoji: CATEGORY_EMOJIS[category] || '📌',
    });
    toast.success('Ticket enregistré ✓');
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setPreview(null);
    setMerchant('');
    setAmount('');
    setDate('');
    setCategory('');
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-lg border border-border shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📸 Scanner un ticket</h2>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>

          {step === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <span className="text-4xl block mb-3">📷</span>
              <p className="text-sm font-medium mb-1">Glissez une image ici</p>
              <p className="text-xs text-muted-foreground">ou cliquez pour sélectionner un fichier</p>
            </div>
          )}

          {step === 'loading' && (
            <div className="py-12 text-center">
              {preview && <img src={preview} alt="ticket" className="w-32 h-32 object-cover rounded-lg mx-auto mb-4 opacity-60" />}
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm font-medium">Analyse en cours...</p>
              <p className="text-xs text-muted-foreground mt-1">Extraction des informations du ticket</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {preview && <img src={preview} alt="ticket" className="w-full h-32 object-cover rounded-lg mb-2" />}
              <div>
                <label className="block text-sm font-medium mb-1.5">Commerçant</label>
                <input value={merchant} onChange={e => setMerchant(e.target.value)} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Montant</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Catégorie suggérée</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">Annuler</button>
                <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Valider</button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScanTicketModal;
