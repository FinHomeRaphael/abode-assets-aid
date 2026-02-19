import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { CATEGORY_EMOJIS, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/types/finance';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface CSVRow {
  [key: string]: string;
}

interface MappedTransaction {
  date: string;
  label: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  selected: boolean;
}

type ColumnMapping = {
  date: string;
  label: string;
  amount: string;
  type: string;
};

const STEPS = ['upload', 'mapping', 'preview'] as const;
type Step = typeof STEPS[number];

const guessColumn = (headers: string[], keywords: string[]): string => {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const kw of keywords) {
    const idx = lower.findIndex(h => h.includes(kw));
    if (idx !== -1) return headers[idx];
  }
  return '';
};

const parseCSVLine = (line: string, separator: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
};

const detectSeparator = (text: string): string => {
  const firstLine = text.split('\n')[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
};

const parseDate = (raw: string): string | null => {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/['"]/g, '');
  // Try ISO format: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.slice(0, 10);
  // Try DD/MM/YYYY or DD-MM-YYYY
  const euMatch = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (euMatch) return `${euMatch[3]}-${euMatch[2].padStart(2, '0')}-${euMatch[1].padStart(2, '0')}`;
  // Try MM/DD/YYYY
  const usMatch = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (usMatch) {
    const m = parseInt(usMatch[1]), d = parseInt(usMatch[2]);
    if (m > 12) return `${usMatch[3]}-${usMatch[2].padStart(2, '0')}-${usMatch[1].padStart(2, '0')}`;
  }
  return null;
};

const parseAmount = (raw: string): number => {
  if (!raw) return 0;
  let cleaned = raw.trim().replace(/['"€$£\s]/g, '');
  // Handle French format: 1.234,56 → 1234.56
  if (/\d+\.\d{3}/.test(cleaned) && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(',', '.');
  }
  return parseFloat(cleaned) || 0;
};

const guessCategory = (label: string): string => {
  const l = label.toLowerCase();
  if (/carrefour|leclerc|lidl|aldi|intermarché|courses|supermarché|monoprix|picard/.test(l)) return 'Alimentation';
  if (/loyer|edf|engie|eau|electricité|charges|syndic/.test(l)) return 'Logement';
  if (/sncf|ratp|essence|parking|péage|uber|taxi|blabla/.test(l)) return 'Transport';
  if (/pharmacie|médecin|docteur|hopital|mutuelle|santé/.test(l)) return 'Santé';
  if (/netflix|spotify|disney|canal|amazon prime|abonnement/.test(l)) return 'Abonnements';
  if (/restaurant|mcdonald|burger|kebab|sushi|pizza|deliveroo|uber eat/.test(l)) return 'Restaurants';
  if (/zara|h&m|nike|adidas|fnac|darty|amazon|cdiscount/.test(l)) return 'Shopping';
  if (/cinema|concert|spectacle|sport|loisir|jeux/.test(l)) return 'Loisirs';
  if (/salaire|paie|virement employeur/.test(l)) return 'Salaire';
  if (/freelance|facture|honoraire|prestation/.test(l)) return 'Freelance';
  return 'Autre';
};

const ImportCSVModal = ({ open, onClose }: Props) => {
  const { addTransaction, household, getActiveAccounts } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: '', label: '', amount: '', type: '' });
  const [mapped, setMapped] = useState<MappedTransaction[]>([]);
  const [accountId, setAccountId] = useState('');
  const [importing, setImporting] = useState(false);

  const activeAccounts = getActiveAccounts();

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({ date: '', label: '', amount: '', type: '' });
    setMapped([]);
    setAccountId('');
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const sep = detectSeparator(text);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('Le fichier semble vide ou invalide');
        return;
      }
      const hdrs = parseCSVLine(lines[0], sep);
      const dataRows = lines.slice(1).map(line => {
        const vals = parseCSVLine(line, sep);
        const obj: CSVRow = {};
        hdrs.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      }).filter(r => Object.values(r).some(v => v.trim()));

      setHeaders(hdrs);
      setRows(dataRows);

      // Auto-guess mapping
      setMapping({
        date: guessColumn(hdrs, ['date', 'jour', 'day', 'valeur', 'opération']),
        label: guessColumn(hdrs, ['libellé', 'libelle', 'label', 'description', 'désignation', 'intitulé', 'motif', 'reference']),
        amount: guessColumn(hdrs, ['montant', 'amount', 'somme', 'débit', 'crédit', 'valeur']),
        type: guessColumn(hdrs, ['type', 'sens', 'direction', 'catégorie']),
      });
      setStep('mapping');
      toast.success(`${dataRows.length} lignes détectées`);
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const applyMapping = () => {
    if (!mapping.date || !mapping.label || !mapping.amount) {
      toast.error('Veuillez mapper au minimum la date, le libellé et le montant');
      return;
    }

    const result: MappedTransaction[] = rows.map(row => {
      const rawAmount = parseAmount(row[mapping.amount]);
      const rawType = mapping.type ? row[mapping.type]?.toLowerCase().trim() : '';
      const isIncome = rawType.includes('revenu') || rawType.includes('income') || rawType.includes('crédit') || rawType.includes('credit') || rawAmount > 0;
      const amount = Math.abs(rawAmount);
      const type: 'income' | 'expense' = rawAmount > 0 || isIncome ? 'income' : 'expense';
      const label = row[mapping.label]?.trim() || 'Sans libellé';
      const date = parseDate(row[mapping.date]) || new Date().toISOString().split('T')[0];
      const category = guessCategory(label);

      return { date, label, amount, type, category, selected: amount > 0 };
    }).filter(t => t.amount > 0);

    setMapped(result);
    setStep('preview');
  };

  const toggleAll = (val: boolean) => {
    setMapped(prev => prev.map(t => ({ ...t, selected: val })));
  };

  const toggleOne = (idx: number) => {
    setMapped(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  const handleImport = async () => {
    const selected = mapped.filter(t => t.selected);
    if (selected.length === 0) {
      toast.error('Aucune transaction sélectionnée');
      return;
    }
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
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">📥 Importer un relevé bancaire</h2>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            {/* Steps indicator */}
            <div className="flex items-center gap-2 mb-6">
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <div className={`h-2 flex-1 rounded-full transition-colors ${STEPS.indexOf(step) >= i ? 'bg-primary' : 'bg-muted'}`} />
                </React.Fragment>
              ))}
            </div>

            {/* Step 1: Upload */}
            {step === 'upload' && (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <div className="text-4xl mb-3">📄</div>
                <p className="font-semibold mb-1">Glisse ton fichier CSV ici</p>
                <p className="text-sm text-muted-foreground mb-3">ou clique pour sélectionner un fichier</p>
                <p className="text-xs text-muted-foreground">Formats acceptés : CSV, TSV • Séparateurs auto-détectés (virgule, point-virgule, tab)</p>
              </div>
            )}

            {/* Step 2: Column Mapping */}
            {step === 'mapping' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{rows.length} lignes trouvées. Associe les colonnes de ton fichier :</p>

                {(['date', 'label', 'amount', 'type'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium mb-1">
                      {field === 'date' && '📅 Date *'}
                      {field === 'label' && '📝 Libellé *'}
                      {field === 'amount' && '💰 Montant *'}
                      {field === 'type' && '↕️ Type (optionnel)'}
                    </label>
                    <select
                      value={mapping[field]}
                      onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">{field === 'type' ? 'Auto-détection (+ = revenu, - = dépense)' : 'Sélectionner une colonne...'}</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    {/* Preview first value */}
                    {mapping[field] && rows[0] && (
                      <p className="text-xs text-muted-foreground mt-1">Aperçu : "{rows[0][mapping[field]]}"</p>
                    )}
                  </div>
                ))}

                {/* Account selection */}
                {activeAccounts.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">🏦 Compte de destination</label>
                    <select
                      value={accountId}
                      onChange={e => setAccountId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Aucun (devise du foyer)</option>
                      {activeAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button onClick={() => setStep('upload')} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">← Retour</button>
                  <button onClick={applyMapping} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Prévisualiser →</button>
                </div>
              </div>
            )}

            {/* Step 3: Preview & Import */}
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
                      <span className="text-xs px-1.5 py-0.5 rounded-lg bg-muted">{t.category}</span>
                      <span className={`font-mono text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('mapping')} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">← Retour</button>
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
