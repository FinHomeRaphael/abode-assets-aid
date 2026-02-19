import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { CATEGORY_EMOJIS } from '@/types/finance';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface MappedTransaction {
  date: string;
  label: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  selected: boolean;
}

const STEPS = ['upload', 'preview'] as const;
type Step = typeof STEPS[number];

const ImportCSVModal = ({ open, onClose }: Props) => {
  const { addTransaction, household, getActiveAccounts } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [mapped, setMapped] = useState<MappedTransaction[]>([]);
  const [accountId, setAccountId] = useState('');
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const activeAccounts = getActiveAccounts();

  const reset = () => {
    setStep('upload');
    setMapped([]);
    setAccountId('');
    setImporting(false);
    setAnalyzing(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  // Convert file to base64 data URL
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  };

  const handleFile = useCallback(async (file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    setAnalyzing(true);
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');
      
      let fileContent: string;
      let fileType: string;

      if (isPdf || isImage) {
        fileContent = await fileToBase64(file);
        fileType = 'pdf';
      } else {
        // CSV / text
        fileContent = await fileToText(file);
        fileType = 'csv';
      }

      const { data, error } = await supabase.functions.invoke('parse-bank-statement', {
        body: { fileContent, fileType },
      });

      if (error) throw new Error(error.message || 'Erreur lors de l\'analyse');

      if (!data?.transactions || !Array.isArray(data.transactions) || data.transactions.length === 0) {
        toast.error('Aucune transaction détectée dans le fichier');
        setAnalyzing(false);
        return;
      }

      const result: MappedTransaction[] = data.transactions.map((t: any) => {
        const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0;
        const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense';
        return {
          date: t.date || new Date().toISOString().split('T')[0],
          label: t.label || 'Sans libellé',
          amount: Math.abs(amount),
          type,
          category: t.category || 'Autre',
          selected: Math.abs(amount) > 0,
        };
      }).filter((t: MappedTransaction) => t.amount > 0);

      setMapped(result);
      setStep('preview');
      toast.success(`${result.length} transaction(s) détectée(s) par l'IA`);
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(err.message || 'Erreur lors de l\'analyse du fichier');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const toggleAll = (val: boolean) => setMapped(prev => prev.map(t => ({ ...t, selected: val })));
  const toggleOne = (idx: number) => setMapped(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));

  const handleImport = async () => {
    const selected = mapped.filter(t => t.selected);
    if (selected.length === 0) { toast.error('Aucune transaction sélectionnée'); return; }
    setImporting(true);

    const account = activeAccounts.find(a => a.id === accountId);
    const currency = account?.currency || household.currency;

    for (const t of selected) {
      addTransaction({
        type: t.type,
        label: t.label,
        amount: t.amount,
        currency,
        category: t.category,
        memberId: household.members[0]?.id || '',
        date: t.date,
        emoji: CATEGORY_EMOJIS[t.category] || '📌',
        isRecurring: false,
        accountId: accountId || undefined,
      });
    }

    toast.success(`${selected.length} transaction(s) importée(s) ✓`);
    handleClose();
  };

  if (!open) return null;

  const selectedCount = mapped.filter(t => t.selected).length;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={handleClose}>
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl border border-border shadow-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">📥 Importer un relevé bancaire</h2>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            {/* Steps indicator */}
            <div className="flex items-center gap-2 mb-6">
              {STEPS.map((s, i) => (
                <div key={s} className={`h-2 flex-1 rounded-full transition-colors ${STEPS.indexOf(step) >= i ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>

            {/* Step 1: Upload */}
            {step === 'upload' && !analyzing && (
              <div className="space-y-4">
                {/* Account selection FIRST */}
                {activeAccounts.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">🏦 Compte débité *</label>
                    <select
                      value={accountId}
                      onChange={e => setAccountId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Sélectionner un compte...</option>
                      {activeAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer ${activeAccounts.length > 0 && !accountId ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="font-semibold mb-1">
                    {activeAccounts.length > 0 && !accountId ? 'Choisis d\'abord un compte ci-dessus' : 'Glisse ton relevé bancaire ici'}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">ou clique pour sélectionner un fichier</p>
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 rounded-lg bg-muted">PDF</span>
                    <span className="px-2 py-1 rounded-lg bg-muted">CSV</span>
                    <span className="px-2 py-1 rounded-lg bg-muted">Image</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">L'IA analyse ton fichier et extrait automatiquement les transactions</p>
                </div>
              </div>
            )}

            {/* Analyzing spinner */}
            {analyzing && (
              <div className="py-16 text-center">
                <div className="inline-block w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                <p className="font-semibold">L'IA analyse ton relevé…</p>
                <p className="text-sm text-muted-foreground mt-1">Extraction des transactions en cours</p>
              </div>
            )}

            {/* Step 2: Preview & Import */}
            {step === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{selectedCount}/{mapped.length} sélectionnées</p>
                  <div className="flex gap-2">
                    <button onClick={() => toggleAll(true)} className="text-xs text-primary hover:underline">Tout cocher</button>
                    <button onClick={() => toggleAll(false)} className="text-xs text-muted-foreground hover:underline">Tout décocher</button>
                  </div>
                </div>

                <div className="border border-border rounded-xl divide-y divide-border/50 max-h-[40vh] overflow-y-auto">
                  {mapped.map((t, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${t.selected ? '' : 'opacity-40'}`}>
                      <input type="checkbox" checked={t.selected} onChange={() => toggleOne(i)} className="rounded border-input" />
                      <span className="text-xs text-muted-foreground w-20 shrink-0">{t.date}</span>
                      <span className="flex-1 truncate">{t.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-lg bg-muted shrink-0">{t.category}</span>
                      <span className={`font-mono text-sm font-semibold shrink-0 ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Account selection in preview */}
                {activeAccounts.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">🏦 Compte débité</label>
                    <select
                      value={accountId}
                      onChange={e => setAccountId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Aucun (devise du foyer)</option>
                      {activeAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => { setStep('upload'); setMapped([]); }} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">← Retour</button>
                  <button onClick={handleImport} disabled={importing || selectedCount === 0} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {importing ? 'Import en cours...' : `Importer ${selectedCount} transaction(s)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImportCSVModal;
