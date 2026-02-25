import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { CATEGORY_EMOJIS, EXPENSE_CATEGORIES } from '@/types/finance';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatLocalDate } from '@/utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
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
  const [currency, setCurrency] = useState(household.currency);
  const [dragOver, setDragOver] = useState(false);

  const processFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);
      setStep('loading');

      try {
        const { data, error } = await supabase.functions.invoke('analyze-ticket', {
          body: { imageBase64: base64 },
        });

        if (error) throw error;

        if (data.error) {
          throw new Error(data.error);
        }

        setMerchant(data.merchant || 'Inconnu');
        setAmount(String(data.amount || 0));
        setDate(data.date || formatLocalDate(new Date()));
        setCategory(data.category || 'Alimentation');
        setCurrency(data.currency || household.currency);
        setStep('review');
      } catch (err: any) {
        console.error('AI analysis error:', err);
        toast.error("Erreur d'analyse. Remplissez manuellement.");
        // Fallback to empty review
        setMerchant('');
        setAmount('');
        setDate(formatLocalDate(new Date()));
        setCategory('Alimentation');
        setStep('review');
      }
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
      currency,
      category,
      memberId: household.members[0]?.id || '1',
      date,
      emoji: CATEGORY_EMOJIS[category] || '📌',
    });
    // silent
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
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-md rounded-2xl border border-border shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📸 Scanner un ticket</h2>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>

          {step === 'upload' && (
            <div className="space-y-3">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <span className="text-4xl block mb-3">🖼️</span>
                <p className="text-sm font-medium mb-1">Choisir depuis la photothèque</p>
                <p className="text-xs text-muted-foreground">ou glissez une image ici</p>
              </div>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.capture = 'environment';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) processFile(file);
                  };
                  input.click();
                }}
                className="w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <span>📷</span> Prendre une photo
              </button>
              <p className="text-xs text-muted-foreground text-center">L'IA analysera automatiquement le ticket</p>
            </div>
          )}

          {step === 'loading' && (
            <div className="py-12 text-center">
              {preview && <img src={preview} alt="ticket" className="w-32 h-32 object-cover rounded-xl mx-auto mb-4 opacity-60" />}
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm font-medium">Analyse IA en cours...</p>
              <p className="text-xs text-muted-foreground mt-1">Extraction du montant, commerçant et devise</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {preview && <img src={preview} alt="ticket" className="w-full h-32 object-cover rounded-xl mb-2" />}
              <div>
                <label className="block text-sm font-medium mb-1.5">Commerçant</label>
                <input value={merchant} onChange={e => setMerchant(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Montant</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Devise</label>
                  <input value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Catégorie suggérée</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Valider</button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScanTicketModal;
