import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEBT_TYPES, PAYMENT_FREQUENCIES } from '@/types/debt';
import { formatLocalDate } from '@/utils/format';
import { EXPENSE_CATEGORIES, CATEGORY_EMOJIS } from '@/types/finance';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const AddDebtModal = ({ open, onClose, onAdded }: Props) => {
  const { householdId, household, customCategories, getActiveAccounts, financeScope, session } = useApp();
  const [type, setType] = useState('mortgage');
  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [durationYears, setDurationYears] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [paymentFrequency, setPaymentFrequency] = useState('monthly');
  const [paymentDay, setPaymentDay] = useState('1');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amortizationType, setAmortizationType] = useState<'fixed_annuity' | 'fixed_capital'>('fixed_annuity');
  const [nextPaymentDate, setNextPaymentDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  const activeAccounts = getActiveAccounts();
  const allExpenseCategories = [...EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type === 'expense').map(c => c.name)];

  // Auto-calculate interest based on remaining amount, rate and frequency
  const periodsPerYear = useMemo(() => {
    switch (paymentFrequency) {
      case 'monthly': return 12;
      case 'quarterly': return 4;
      case 'semi-annual': return 2;
      case 'annual': return 1;
      default: return 12;
    }
  }, [paymentFrequency]);

  const calculatedInterest = useMemo(() => {
    const rem = parseFloat(remainingAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    return rem * (rate / 100) / periodsPerYear;
  }, [remainingAmount, interestRate, periodsPerYear]);

  const totalPayment = useMemo(() => {
    if (amortizationType === 'fixed_annuity') {
      // Annuité constante: payment_amount = échéance totale fixe
      return parseFloat(paymentAmount) || 0;
    }
    // Capital constant: payment_amount = amortissement fixe, échéance = amortissement + intérêts
    return (parseFloat(paymentAmount) || 0) + calculatedInterest;
  }, [paymentAmount, calculatedInterest, amortizationType]);

  const displayedCapital = useMemo(() => {
    if (amortizationType === 'fixed_annuity') {
      return Math.max((parseFloat(paymentAmount) || 0) - calculatedInterest, 0);
    }
    return parseFloat(paymentAmount) || 0;
  }, [paymentAmount, calculatedInterest, amortizationType]);

  const reset = () => {
    setType('mortgage'); setName(''); setLender(''); setInitialAmount(''); setRemainingAmount('');
    setInterestRate(''); setDurationYears(''); setStartDate(new Date()); setPaymentFrequency('monthly');
    setPaymentDay('1'); setPaymentAmount(''); setCategoryId(''); setAccountId(''); setAmortizationType('fixed_annuity'); setNextPaymentDate(new Date());
  };

  const handleSubmit = async () => {
    if (!name.trim() || !initialAmount || !remainingAmount || !paymentAmount || !durationYears) return;
    setSaving(true);

    const debtData = {
      household_id: householdId,
      type,
      name: name.trim(),
      lender: lender.trim() || null,
      initial_amount: parseFloat(initialAmount),
      remaining_amount: parseFloat(remainingAmount),
      currency: household.currency,
      interest_rate: parseFloat(interestRate) || 0,
      duration_years: parseFloat(durationYears),
      start_date: formatLocalDate(startDate),
      payment_frequency: paymentFrequency,
      payment_day: Math.max(1, Math.min(28, parseInt(paymentDay) || 1)),
      payment_amount: parseFloat(paymentAmount),
      category_id: categoryId || null,
      account_id: accountId || null,
      amortization_type: amortizationType,
      next_payment_date: formatLocalDate(nextPaymentDate),
      scope: financeScope,
      created_by: session?.user?.id,
    };

    const { error } = await supabase.from('debts').insert(debtData as any);
    if (error) { console.error('Insert debt error:', error); toast.error('Erreur lors de l\'ajout'); setSaving(false); return; }

    toast.success('Dette ajoutée');
    setSaving(false);
    reset();
    onAdded();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-card-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">➕ Ajouter une dette</h2>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
              </div>

              <div className="space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Type de crédit</label>
                  <div className="flex flex-wrap gap-2">
                    {DEBT_TYPES.map(dt => (
                      <button key={dt.value} onClick={() => setType(dt.value)}
                        className={`px-3 py-2 rounded-xl border text-sm transition-all ${type === dt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                        {dt.emoji} {dt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nom du crédit</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Crédit maison"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>

                {/* Lender */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Organisme prêteur <span className="text-muted-foreground">(optionnel)</span></label>
                  <input value={lender} onChange={e => setLender(e.target.value)} placeholder="Ex: BNP Paribas"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>

                {/* Amounts */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Montant emprunté</label>
                    <input type="number" step="0.01" value={initialAmount} onChange={e => setInitialAmount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Capital restant dû</label>
                    <input type="number" step="0.01" value={remainingAmount} onChange={e => setRemainingAmount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>

                {/* Rate & Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Taux d'intérêt (%)</label>
                    <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Durée (années)</label>
                    <input type="number" step="1" value={durationYears} onChange={e => setDurationYears(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>

                {/* Start date */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Date de signature</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-left">
                        {format(startDate, 'dd MMMM yyyy', { locale: fr })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Frequency & Day */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Fréquence</label>
                    <select value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {PAYMENT_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Jour de prélèvement</label>
                    <input type="number" min="1" max="28" value={paymentDay} onChange={e => setPaymentDay(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>

                {/* Amortization type */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Mode de remboursement</label>
                  <div className="flex gap-2">
                    <button onClick={() => setAmortizationType('fixed_annuity')}
                      className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-all ${amortizationType === 'fixed_annuity' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                      Échéance fixe
                    </button>
                    <button onClick={() => setAmortizationType('fixed_capital')}
                      className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-all ${amortizationType === 'fixed_capital' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                      Capital fixe
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {amortizationType === 'fixed_annuity'
                      ? 'L\'échéance totale reste identique chaque mois. L\'amortissement augmente quand les intérêts baissent.'
                      : 'Le capital remboursé reste identique chaque mois. L\'échéance totale diminue quand les intérêts baissent.'}
                  </p>
                </div>

                {/* Payment amount */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {amortizationType === 'fixed_annuity' ? 'Échéance totale (fixe)' : 'Amortissement (capital fixe)'}
                  </label>
                  <input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                    placeholder={amortizationType === 'fixed_annuity' ? 'Montant total de l\'échéance' : 'Montant du remboursement du capital'}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>

                {/* Auto-calculated summary */}
                <div className="rounded-xl border border-border bg-muted/50 p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Intérêts (auto)</span>
                    <span className="font-mono font-medium">{calculatedInterest.toFixed(2)} {household.currency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amortissement</span>
                    <span className="font-mono font-medium">{displayedCapital.toFixed(2)} {household.currency}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5">
                    <span>Échéance totale</span>
                    <span className="font-mono">{totalPayment.toFixed(2)} {household.currency}</span>
                  </div>
                </div>

                {/* Next payment date */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Prochaine échéance</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm text-left">
                        {format(nextPaymentDate, 'dd MMMM yyyy', { locale: fr })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={nextPaymentDate} onSelect={d => d && setNextPaymentDate(d)} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Account */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Compte pour les dépenses</label>
                  <select value={accountId} onChange={e => setAccountId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Aucun</option>
                    {activeAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Catégorie pour les dépenses</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Aucune</option>
                    {allExpenseCategories.map(c => (
                      <option key={c} value={c}>{CATEGORY_EMOJIS[c] || '📌'} {c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                <button onClick={handleSubmit} disabled={saving || !name.trim() || !initialAmount || !remainingAmount || !paymentAmount}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddDebtModal;
