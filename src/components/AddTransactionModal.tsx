import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CURRENCIES, CATEGORY_EMOJIS, EMOJI_LIST } from '@/types/finance';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { formatLocalDate } from '@/utils/format';
import MoneyInput from '@/components/ui/money-input';
import { useSubscription, FREEMIUM_LIMITS } from '@/hooks/useSubscription';
import { Lock } from 'lucide-react';
import { trackCustomEvent } from '@/utils/metaPixel';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultType?: 'income' | 'expense';
}

const AddTransactionModal = ({ open, onClose, defaultType }: Props) => {
  const { addTransaction, household, customCategories, addCustomCategory, getActiveAccounts, currentUser, scopedTransactions } = useApp();
  const navigate = useNavigate();
  const [type, setType] = useState<'income' | 'expense'>(defaultType || 'expense');

  // Sync type with defaultType when modal opens
  React.useEffect(() => {
    if (open && defaultType) {
      setType(defaultType);
    }
  }, [open, defaultType]);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(household.currency);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const memberId = currentUser?.id || household.members[0]?.id || '';
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [accountId, setAccountId] = useState('');
  const { plan } = useSubscription();

  const recurringCount = useMemo(() =>
    scopedTransactions.filter(t => t.isRecurring && !t.recurringSourceId).length,
    [scopedTransactions]
  );
  const canAddRecurring = plan !== 'free' || recurringCount < FREEMIUM_LIMITS.recurringTransactions;

  // Custom category creation
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📌');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');

  const baseCategories = type === 'expense' ? [...EXPENSE_CATEGORIES] : [...INCOME_CATEGORIES];
  const customs = customCategories.filter(c => c.type === type);
  const allCategories = [...baseCategories, ...customs.map(c => c.name)];
  const activeAccounts = getActiveAccounts();

  const handleSubmit = () => {
    if (!label.trim() || !amount || !category) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (activeAccounts.length > 0 && !accountId) {
      toast.error('Veuillez sélectionner un compte');
      return;
    }
    const customCat = customCategories.find(c => c.name === category);
    const day = date.getDate();
    addTransaction({
      type,
      label: label.trim(),
      amount: parseFloat(amount),
      currency,
      category,
      memberId,
      date: formatLocalDate(date),
      notes: notes.trim() || undefined,
      emoji: customCat?.emoji || CATEGORY_EMOJIS[category] || '📌',
      isRecurring,
      recurrenceDay: isRecurring ? day : undefined,
      accountId: accountId || undefined,
    });
    trackCustomEvent('AddTransaction', { type, category, currency, amount: parseFloat(amount) });
    resetAndClose();
  };

  const handleCreateCategory = () => {
    if (!newCatName.trim() || newCatName.length > 30) {
      toast.error('Nom invalide (max 30 caractères)');
      return;
    }
    if (allCategories.includes(newCatName.trim())) {
      toast.error('Cette catégorie existe déjà');
      return;
    }
    addCustomCategory({ name: newCatName.trim(), emoji: newCatEmoji, type: newCatType });
    setCategory(newCatName.trim());
    setShowCreateCat(false);
    setNewCatName('');
    // silent
  };

  const resetAndClose = () => {
    setLabel('');
    setAmount('');
    setCategory('');
    setNotes('');
    setDate(new Date());
    setIsRecurring(false);
    setAccountId('');
    setShowCreateCat(false);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={resetAndClose}>
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-lg border border-border shadow-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Nouvelle transaction</h2>
              <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="flex mb-5 bg-secondary rounded-md p-1">
              <button onClick={() => { setType('expense'); setCategory(''); }} className={`flex-1 py-2 rounded-sm text-sm font-medium transition-colors ${type === 'expense' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>Dépense</button>
              <button onClick={() => { setType('income'); setCategory(''); }} className={`flex-1 py-2 rounded-sm text-sm font-medium transition-colors ${type === 'income' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>Revenu</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Libellé *</label>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Courses Carrefour" className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Montant *</label>
                  <MoneyInput value={amount} onChange={setAmount} placeholder="0,00" className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Devise</label>
                  {accountId ? (
                    <div className="w-full px-4 py-2.5 rounded-md border border-input bg-muted text-sm text-muted-foreground cursor-not-allowed">
                      {currency} (devise du compte)
                    </div>
                  ) : (
                    <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Catégorie *</label>
                <select value={category} onChange={e => {
                  if (e.target.value === '__create__') { setShowCreateCat(true); }
                  else setCategory(e.target.value);
                }} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Sélectionner...</option>
                  {baseCategories.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c]} {c}</option>)}
                  {customs.length > 0 && <option disabled>── Personnalisées ──</option>}
                  {customs.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
                  <option value="__create__">➕ Créer une catégorie</option>
                </select>
              </div>

              {/* Account selector */}
              {activeAccounts.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Compte *</label>
                  <select value={accountId} onChange={e => {
                    const selectedId = e.target.value;
                    setAccountId(selectedId);
                    if (selectedId) {
                      const acc = activeAccounts.find(a => a.id === selectedId);
                      if (acc) setCurrency(acc.currency);
                    }
                  }} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Sélectionner un compte...</option>
                    {activeAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 rounded-md border border-border bg-muted/50 text-sm text-muted-foreground">
                  💡 Tu peux <button type="button" onClick={() => { resetAndClose(); navigate('/savings'); }} className="text-primary underline">créer un compte</button> dans l'onglet Comptes bancaires pour suivre tes soldes.
                </div>
              )}

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

              {currentUser && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Membre</label>
                  <div className="px-4 py-2.5 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                    {currentUser.name}
                  </div>
                </div>
              )}

              {/* Recurring toggle */}
              <div className={`flex items-center justify-between py-2 px-3 rounded-md border border-border bg-secondary/30 ${!canAddRecurring && !isRecurring ? 'opacity-60' : ''}`}>
                <div>
                  <p className="text-sm font-medium">🔄 Transaction récurrente</p>
                  <p className="text-xs text-muted-foreground">
                    {!canAddRecurring && !isRecurring
                      ? `Limite atteinte (${FREEMIUM_LIMITS.recurringTransactions} récurrente max en gratuit)`
                      : `Se répète automatiquement chaque mois le ${date.getDate()}`}
                  </p>
                </div>
                {!canAddRecurring && !isRecurring ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                    <Lock className="w-3 h-3" />
                    <span>Premium</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${isRecurring ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-5' : ''}`} />
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes optionnelles..." rows={2} className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={resetAndClose} className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">Annuler</button>
              <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Enregistrer</button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Create category mini-modal */}
      {showCreateCat && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-foreground/30 flex items-center justify-center p-4" onClick={() => setShowCreateCat(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()} className="bg-card w-full max-w-sm rounded-lg border border-border shadow-lg p-5">
            <h3 className="font-semibold mb-4">Créer une catégorie</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nom (max 30 car.)</label>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value.slice(0, 30))} placeholder="Ma catégorie" className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Emoji</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-secondary/50 rounded-md">
                  {EMOJI_LIST.map(e => (
                    <button key={e} onClick={() => setNewCatEmoji(e)} className={`w-8 h-8 rounded flex items-center justify-center text-lg transition-colors ${newCatEmoji === e ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-secondary'}`}>{e}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <div className="flex gap-2">
                  <button onClick={() => setNewCatType('expense')} className={`flex-1 py-2 rounded-md border text-sm ${newCatType === 'expense' ? 'border-primary bg-primary/5 text-primary' : 'border-border'}`}>Dépense</button>
                  <button onClick={() => setNewCatType('income')} className={`flex-1 py-2 rounded-md border text-sm ${newCatType === 'income' ? 'border-primary bg-primary/5 text-primary' : 'border-border'}`}>Revenu</button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowCreateCat(false)} className="flex-1 py-2 rounded-md border border-border text-sm font-medium hover:bg-secondary">Annuler</button>
              <button onClick={handleCreateCategory} className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Créer</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddTransactionModal;
