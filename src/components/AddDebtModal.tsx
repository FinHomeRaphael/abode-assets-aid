import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEBT_TYPES, PAYMENT_FREQUENCIES } from '@/types/debt';
import { EXPENSE_CATEGORIES, CATEGORY_EMOJIS } from '@/types/finance';
import { getPeriodsPerYear } from '@/types/debt';
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
  const { householdId, household, customCategories, getActiveAccounts } = useApp();
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
    return (parseFloat(paymentAmount) || 0) + calculatedInterest;
  }, [paymentAmount, calculatedInterest]);

  const reset = () => {
    setType('mortgage'); setName(''); setLender(''); setInitialAmount(''); setRemainingAmount('');
    setInterestRate(''); setDurationYears(''); setStartDate(new Date()); setPaymentFrequency('monthly');
    setPaymentDay('1'); setPaymentAmount(''); setCategoryId(''); setAccountId(''); setNextPaymentDate(new Date());
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
      start_date: startDate.toISOString().split('T')[0],
      payment_frequency: paymentFrequency,
      payment_day: Math.max(1, Math.min(28, parseInt(paymentDay) || 1)),
      payment_amount: parseFloat(paymentAmount),
      category_id: categoryId || null,
      account_id: accountId || null,
      next_payment_date: nextPaymentDate.toISOString().split('T')[0],
    };

    const { data: insertedDebt, error } = await supabase.from('debts').insert(debtData as any).select().single();
    if (error) { console.error('Insert debt error:', error); toast.error('Erreur lors de l\'ajout'); setSaving(false); return; }

    // Auto-generate all future payment transactions
    const debtId = insertedDebt.id;
    const currency = household.currency;
    const ppYear = getPeriodsPerYear(paymentFrequency as any);
    const ratePerPeriod = (parseFloat(interestRate) || 0) / 100 / ppYear;
    const principal = parseFloat(paymentAmount);
    let remaining = parseFloat(remainingAmount);
    let currentDate = new Date(nextPaymentDate);
    const cat = categoryId || null;
    const accId = accountId || null;

    const allTransactions: any[] = [];

    while (remaining > 0) {
      const interest = Math.round(remaining * ratePerPeriod * 100) / 100;
      const actualPrincipal = Math.round(Math.min(principal, remaining) * 100) / 100;
      const dateStr = currentDate.toISOString().split('T')[0];

      // Interest transaction
      if (interest > 0) {
        allTransactions.push({
          household_id: householdId,
          type: 'expense',
          label: `Intérêts - ${name.trim()}`,
          amount: interest,
          currency,
          base_currency: currency,
          exchange_rate: 1,
          converted_amount: interest,
          category: cat,
          emoji: '🏦',
          date: dateStr,
          is_auto_generated: true,
          debt_id: debtId,
          debt_payment_type: 'interest',
          account_id: accId,
        });
      }

      // Principal transaction
      allTransactions.push({
        household_id: householdId,
        type: 'expense',
        label: `Amortissement - ${name.trim()}`,
        amount: actualPrincipal,
        currency,
        base_currency: currency,
        exchange_rate: 1,
        converted_amount: actualPrincipal,
        category: cat,
        emoji: '🏦',
        date: dateStr,
        is_auto_generated: true,
        debt_id: debtId,
        debt_payment_type: 'principal',
        account_id: accId,
      });

      remaining -= actualPrincipal;

      // Advance to next period
      if (paymentFrequency === 'monthly') currentDate.setMonth(currentDate.getMonth() + 1);
      else if (paymentFrequency === 'quarterly') currentDate.setMonth(currentDate.getMonth() + 3);
      else if (paymentFrequency === 'semi-annual') currentDate.setMonth(currentDate.getMonth() + 6);
      else currentDate.setFullYear(currentDate.getFullYear() + 1);
    }

    // Insert all transactions in batches of 100
    for (let i = 0; i < allTransactions.length; i += 100) {
      const batch = allTransactions.slice(i, i + 100);
      const { error: txError } = await supabase.from('transactions').insert(batch);
      if (txError) console.error('Batch insert error:', txError);
    }

    toast.success(`Dette ajoutée avec ${allTransactions.length} échéances générées`);
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

                {/* Amortissement (principal) */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Amortissement</label>
                  <input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="Montant du remboursement du capital"
                    className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>

                {/* Auto-calculated interest + total */}
                <div className="rounded-xl border border-border bg-muted/50 p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Intérêts (auto)</span>
                    <span className="font-mono font-medium">{calculatedInterest.toFixed(2)} {household.currency}</span>
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
