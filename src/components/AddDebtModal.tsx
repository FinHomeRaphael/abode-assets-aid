import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEBT_TYPES, PAYMENT_FREQUENCIES, DebtType, MortgageSystem, RateType, SwissAmortizationType } from '@/types/debt';
import { formatLocalDate, formatAmount } from '@/utils/format';
import { EXPENSE_CATEGORIES, CATEGORY_EMOJIS, CURRENCIES, CURRENCY_SYMBOLS } from '@/types/finance';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateAmortizationSchedule } from '@/utils/debtSchedule';
import MoneyInput from '@/components/ui/money-input';
import { ArrowLeft } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

type Step = 'type' | 'mortgage_system' | 'form';

const AddDebtModal = ({ open, onClose, onAdded }: Props) => {
  const { householdId, household, customCategories, getActiveAccounts, financeScope, session } = useApp();
  
  // Step state
  const [step, setStep] = useState<Step>('type');
  
  // Debt fields
  const [type, setType] = useState<DebtType>('mortgage');
  const [mortgageSystem, setMortgageSystem] = useState<MortgageSystem | null>(null);
  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [durationYears, setDurationYears] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [paymentFrequency, setPaymentFrequency] = useState('monthly');
  const [paymentDay, setPaymentDay] = useState('1');
  const [endOfMonth, setEndOfMonth] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amortizationType, setAmortizationType] = useState<'fixed_annuity' | 'fixed_capital'>('fixed_annuity');
  const [nextPaymentDate, setNextPaymentDate] = useState<Date>(new Date());
  const [debtCurrency, setDebtCurrency] = useState(household.currency);
  const [saving, setSaving] = useState(false);
  
  // Mortgage-specific fields
  const [rateType, setRateType] = useState<RateType>('fixed');
  const [rateEndDate, setRateEndDate] = useState<Date | null>(null);
  const [propertyValue, setPropertyValue] = useState('');
  const [annualAmortization, setAnnualAmortization] = useState('');
  const [swissAmortizationType, setSwissAmortizationType] = useState<SwissAmortizationType>('direct');
  const [includeMaintenance, setIncludeMaintenance] = useState(false);
  const [durationMonths, setDurationMonths] = useState('');

  const activeAccounts = getActiveAccounts();
  const allExpenseCategories = [...EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type === 'expense').map(c => c.name)];

  const isMortgage = type === 'mortgage';
  const isSwiss = isMortgage && mortgageSystem === 'swiss';
  const isEurope = isMortgage && mortgageSystem === 'europe';

  const periodsPerYear = useMemo(() => {
    switch (paymentFrequency) {
      case 'monthly': return 12;
      case 'quarterly': return 4;
      case 'semi-annual': return 2;
      case 'annual': return 1;
      default: return 12;
    }
  }, [paymentFrequency]);

  const frequencyLabel = useMemo(() => {
    switch (paymentFrequency) {
      case 'quarterly': return 'trimestriel';
      case 'semi-annual': return 'semestriel';
      case 'annual': return 'annuel';
      default: return 'mensuel';
    }
  }, [paymentFrequency]);

  const frequencyLabelFem = useMemo(() => {
    switch (paymentFrequency) {
      case 'quarterly': return 'trimestrielle';
      case 'semi-annual': return 'semestrielle';
      case 'annual': return 'annuelle';
      default: return 'mensuelle';
    }
  }, [paymentFrequency]);

  // Swiss calculations — adapted to frequency
  const swissPeriodicInterest = useMemo(() => {
    const rem = parseFloat(remainingAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    return (rem * rate / 100) / periodsPerYear;
  }, [remainingAmount, interestRate, periodsPerYear]);

  const swissPeriodicAmortization = useMemo(() => {
    if (swissAmortizationType === 'none') return 0;
    return (parseFloat(annualAmortization) || 0) / periodsPerYear;
  }, [annualAmortization, swissAmortizationType, periodsPerYear]);

  const swissPeriodicMaintenance = useMemo(() => {
    if (!includeMaintenance) return 0;
    return ((parseFloat(propertyValue) || 0) * 0.01) / periodsPerYear;
  }, [propertyValue, includeMaintenance, periodsPerYear]);

  const swissTotalPeriodic = swissPeriodicInterest + swissPeriodicAmortization + swissPeriodicMaintenance;

  // Europe calculations — user enters payment manually, interest auto-calculated
  const europePeriodicPayment = useMemo(() => parseFloat(paymentAmount) || 0, [paymentAmount]);

  const europeCurrentInterest = useMemo(() => {
    const rem = parseFloat(remainingAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    if (rate === 0) return 0;
    return rem * (rate / 100 / periodsPerYear);
  }, [remainingAmount, interestRate, periodsPerYear]);

  const europeCurrentCapital = europePeriodicPayment > 0 ? Math.max(europePeriodicPayment - europeCurrentInterest, 0) : 0;

  // Standard (non-mortgage) calculations
  const calculatedInterest = useMemo(() => {
    const rem = parseFloat(remainingAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    return rem * (rate / 100) / periodsPerYear;
  }, [remainingAmount, interestRate, periodsPerYear]);

  const totalPayment = useMemo(() => {
    if (amortizationType === 'fixed_annuity') return parseFloat(paymentAmount) || 0;
    return (parseFloat(paymentAmount) || 0) + calculatedInterest;
  }, [paymentAmount, calculatedInterest, amortizationType]);

  const displayedCapital = useMemo(() => {
    if (amortizationType === 'fixed_annuity') return Math.max((parseFloat(paymentAmount) || 0) - calculatedInterest, 0);
    return parseFloat(paymentAmount) || 0;
  }, [paymentAmount, calculatedInterest, amortizationType]);

  const reset = () => {
    setStep('type');
    setType('mortgage'); setMortgageSystem(null); setName(''); setLender(''); setInitialAmount(''); setRemainingAmount('');
    setInterestRate(''); setDurationYears(''); setStartDate(new Date()); setPaymentFrequency('monthly');
    setPaymentDay('1'); setEndOfMonth(false); setPaymentAmount(''); setCategoryId(''); setAccountId('');
    setAmortizationType('fixed_annuity'); setNextPaymentDate(new Date()); setDebtCurrency(household.currency);
    setRateType('fixed'); setRateEndDate(null); setPropertyValue(''); setAnnualAmortization('');
    setSwissAmortizationType('direct'); setIncludeMaintenance(false); setDurationMonths('');
  };

  const handleTypeSelect = (t: DebtType) => {
    setType(t);
    if (t === 'mortgage') {
      setStep('mortgage_system');
    } else {
      setMortgageSystem(null);
      setStep('form');
    }
  };

  const handleMortgageSystemSelect = (system: MortgageSystem) => {
    setMortgageSystem(system);
    if (system === 'swiss') {
      setDebtCurrency('CHF');
      setAmortizationType('fixed_capital');
    } else {
      setDebtCurrency('EUR');
      setAmortizationType('fixed_annuity');
    }
    setStep('form');
  };

  const getEffectivePaymentAmount = () => {
    if (isSwiss) {
      // For Swiss, payment_amount = annual_amortization / 12 (capital portion)
      return swissAmortizationType !== 'none' ? swissPeriodicAmortization : 0;
    }
    if (isEurope) {
      return parseFloat(paymentAmount) || 0;
    }
    return parseFloat(paymentAmount) || 0;
  };

  const getEffectiveDurationYears = () => {
    return parseFloat(durationYears) || 0;
  };

  const handleSubmit = async () => {
    if (!name.trim() || !initialAmount || !remainingAmount) return;
    if (!isMortgage && (!paymentAmount || !durationYears)) return;
    if (isEurope && (!paymentAmount || !durationYears)) return;
    
    setSaving(true);

    const nextDateStr = formatLocalDate(nextPaymentDate);
    const day = Math.max(1, Math.min(31, parseInt(paymentDay) || 1));
    const effectivePayment = getEffectivePaymentAmount();
    const effectiveDuration = getEffectiveDurationYears();

    const debtData: any = {
      household_id: householdId,
      type,
      name: name.trim(),
      lender: lender.trim() || null,
      initial_amount: parseFloat(initialAmount),
      remaining_amount: parseFloat(remainingAmount),
      currency: debtCurrency,
      interest_rate: parseFloat(interestRate) || 0,
      duration_years: effectiveDuration,
      start_date: formatLocalDate(startDate),
      payment_frequency: paymentFrequency,
      payment_day: day,
      payment_amount: effectivePayment,
      category_id: categoryId || null,
      account_id: accountId || null,
      amortization_type: isSwiss ? 'fixed_capital' : isEurope ? 'fixed_annuity' : amortizationType,
      next_payment_date: nextDateStr,
      scope: financeScope,
      created_by: session?.user?.id,
      // Mortgage fields
      mortgage_system: isMortgage ? mortgageSystem : null,
      rate_type: rateType,
      rate_end_date: rateEndDate ? formatLocalDate(rateEndDate) : null,
      property_value: isSwiss ? (parseFloat(propertyValue) || null) : null,
      annual_amortization: isSwiss ? (parseFloat(annualAmortization) || null) : null,
      swiss_amortization_type: isSwiss ? swissAmortizationType : null,
      include_maintenance: isSwiss ? includeMaintenance : false,
    };

    const { data: insertedDebt, error } = await supabase.from('debts').insert(debtData).select('id').single();
    if (error || !insertedDebt) {
      console.error('Insert debt error:', error);
      toast.error("Erreur lors de l'ajout");
      setSaving(false);
      return;
    }

    // Generate amortization schedule
    const schedulePayment = isSwiss
      ? swissPeriodicAmortization
      : isEurope
        ? Math.round((parseFloat(paymentAmount) || 0) * 100) / 100
        : parseFloat(paymentAmount);

    const scheduleRows = generateAmortizationSchedule({
      remainingPrincipal: parseFloat(remainingAmount),
      interestRateAnnual: parseFloat(interestRate) || 0,
      frequency: paymentFrequency as any,
      repaymentMode: isSwiss ? 'fixed_capital' : isEurope ? 'fixed_annuity' : amortizationType,
      paymentAmount: schedulePayment,
      startDate: nextDateStr,
      paymentDay: day,
    });

    if (scheduleRows.length > 0) {
      const dbRows = scheduleRows.map(r => ({
        debt_id: insertedDebt.id,
        household_id: householdId,
        due_date: r.due_date,
        period_number: r.period_number,
        capital_before: r.capital_before,
        capital_after: r.capital_after,
        interest_amount: r.interest_amount,
        principal_amount: r.principal_amount,
        total_amount: r.total_amount,
        status: 'prevu',
      }));

      for (let i = 0; i < dbRows.length; i += 500) {
        const batch = dbRows.slice(i, i + 500);
        const { error: schedError } = await supabase.from('debt_schedules').insert(batch as any);
        if (schedError) console.error('Insert schedule error:', schedError);
      }
    }

    toast.success(`Dette ajoutée avec ${scheduleRows.length} échéances`);
    setSaving(false);
    reset();
    onAdded();
  };

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const monoInputClass = `${inputClass} font-mono`;

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
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  {step !== 'type' && (
                    <button onClick={() => setStep(step === 'form' && isMortgage ? 'mortgage_system' : 'type')} className="p-1 rounded-lg hover:bg-muted">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <h2 className="text-lg font-bold">
                    {step === 'type' ? '➕ Type de dette' : step === 'mortgage_system' ? '🏠 Système de remboursement' : '➕ Ajouter une dette'}
                  </h2>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
              </div>

              {/* Step 1: Type selection */}
              {step === 'type' && (
                <div className="space-y-2">
                  {DEBT_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => handleTypeSelect(dt.value)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <span className="text-2xl">{dt.emoji}</span>
                      <div>
                        <p className="font-semibold text-sm">{dt.label === 'Immobilier' ? 'Crédit immobilier' : dt.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {dt.value === 'mortgage' ? 'Hypothèque, prêt immobilier' :
                           dt.value === 'auto' ? 'Leasing, financement véhicule' :
                           dt.value === 'consumer' ? 'Crédit à la consommation' :
                           dt.value === 'student' ? 'Prêt études' : 'Autre type de dette'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2: Mortgage system selection */}
              {step === 'mortgage_system' && (
                <div className="space-y-3">
                  <button
                    onClick={() => handleMortgageSystemSelect('swiss')}
                    className="w-full flex items-start gap-3 px-4 py-4 rounded-xl border border-border hover:border-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all text-left"
                  >
                    <span className="text-2xl">🇨🇭</span>
                    <div>
                      <p className="font-semibold text-sm">Suisse</p>
                      <p className="text-xs text-muted-foreground">Amortissement constant</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">La charge mensuelle diminue avec le temps</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleMortgageSystemSelect('europe')}
                    className="w-full flex items-start gap-3 px-4 py-4 rounded-xl border border-border hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-left"
                  >
                    <span className="text-2xl">🇪🇺</span>
                    <div>
                      <p className="font-semibold text-sm">Europe</p>
                      <p className="text-xs text-muted-foreground">Mensualité fixe</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Tu paies le même montant chaque mois</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 3: Form */}
              {step === 'form' && (
                <div className="space-y-4">
                  {/* System badge for mortgage */}
                  {isMortgage && (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      isSwiss ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                    }`}>
                      {isSwiss ? '🇨🇭 Système suisse' : '🇪🇺 Système européen'}
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{isMortgage ? 'Nom du bien' : 'Nom du crédit'}</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder={isMortgage ? 'Ex: Appartement Lausanne' : 'Ex: Crédit auto'}
                      className={inputClass} />
                  </div>

                  {/* Lender */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Banque / Prêteur <span className="text-muted-foreground">(optionnel)</span></label>
                    <input value={lender} onChange={e => setLender(e.target.value)} placeholder="Ex: UBS, Crédit Agricole"
                      className={inputClass} />
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Devise</label>
                    <select value={debtCurrency} onChange={e => setDebtCurrency(e.target.value)} className={inputClass}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} — {c}</option>)}
                    </select>
                  </div>

                  {/* Swiss: Property value */}
                  {isSwiss && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Valeur du bien</label>
                      <MoneyInput value={propertyValue} onChange={setPropertyValue} className={monoInputClass} />
                    </div>
                  )}

                  {/* Amounts */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">{isSwiss ? "Montant de l'hypothèque" : 'Montant emprunté'}</label>
                      <MoneyInput value={initialAmount} onChange={setInitialAmount} className={monoInputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Capital restant dû</label>
                      <MoneyInput value={remainingAmount} onChange={setRemainingAmount} className={monoInputClass} />
                    </div>
                  </div>

                  {/* Rate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Taux d'intérêt (%)</label>
                      <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} className={monoInputClass} />
                    </div>
                    {isMortgage ? (
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Type de taux</label>
                        <select value={rateType} onChange={e => setRateType(e.target.value as RateType)} className={inputClass}>
                          <option value="fixed">Fixe</option>
                          <option value="variable">{isSwiss ? 'Variable (SARON)' : 'Variable'}</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Durée (années)</label>
                        <input type="number" step="1" value={durationYears} onChange={e => setDurationYears(e.target.value)} className={monoInputClass} />
                      </div>
                    )}
                  </div>

                  {/* Rate end date for fixed mortgage */}
                  {isMortgage && rateType === 'fixed' && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Date de fin du taux <span className="text-muted-foreground">(optionnel)</span></label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={`${inputClass} text-left`}>
                            {rateEndDate ? format(rateEndDate, 'dd MMMM yyyy', { locale: fr }) : 'Non définie'}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={rateEndDate || undefined} onSelect={d => setRateEndDate(d || null)} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Europe: Duration in years + payment amount */}
                  {isEurope && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Durée (années)</label>
                        <input type="number" step="1" value={durationYears} onChange={e => setDurationYears(e.target.value)} placeholder="Ex: 20" className={monoInputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Échéance {frequencyLabelFem} fixe</label>
                        <MoneyInput value={paymentAmount} onChange={setPaymentAmount} placeholder="Montant de l'échéance" className={monoInputClass} />
                      </div>
                    </>
                  )}

                  {/* Swiss: Amortization type */}
                  {isSwiss && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Durée (années)</label>
                        <input type="number" step="1" value={durationYears} onChange={e => setDurationYears(e.target.value)} className={monoInputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Type d'amortissement</label>
                        <div className="flex gap-2">
                          {[
                            { value: 'none' as const, label: 'Aucun' },
                            { value: 'direct' as const, label: 'Direct' },
                            { value: 'indirect' as const, label: 'Indirect (3a)' },
                          ].map(opt => (
                            <button key={opt.value} onClick={() => setSwissAmortizationType(opt.value)}
                              className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-all ${
                                swissAmortizationType === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'
                              }`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {swissAmortizationType !== 'none' && (
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Amortissement annuel</label>
                          <MoneyInput value={annualAmortization} onChange={setAnnualAmortization} className={monoInputClass} />
                        </div>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={includeMaintenance} onChange={e => setIncludeMaintenance(e.target.checked)} className="rounded border-border" />
                        <span className="text-sm">Inclure frais d'entretien (1%/an de la valeur du bien)</span>
                      </label>
                    </>
                  )}

                  {/* Start date */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date de signature</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`${inputClass} text-left`}>
                          {format(startDate, 'dd MMMM yyyy', { locale: fr })}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Non-mortgage: Frequency, Day, Mode, Payment */}
                  {!isMortgage && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Fréquence</label>
                          <select value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value)} className={inputClass}>
                            {PAYMENT_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Jour de prélèvement</label>
                          <input type="number" min="1" max="31" value={endOfMonth ? '' : paymentDay} disabled={endOfMonth}
                            onChange={e => setPaymentDay(e.target.value)} placeholder={endOfMonth ? 'Fin du mois' : ''}
                            className={`${monoInputClass} disabled:opacity-50`} />
                          <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                            <input type="checkbox" checked={endOfMonth} onChange={e => { setEndOfMonth(e.target.checked); if (e.target.checked) setPaymentDay('31'); }} className="rounded border-border" />
                            <span className="text-xs text-muted-foreground">Fin du mois</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1.5">Mode de remboursement</label>
                        <div className="flex gap-2">
                          <button onClick={() => setAmortizationType('fixed_annuity')}
                            className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-all ${amortizationType === 'fixed_annuity' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                            Mensualité constante
                          </button>
                          <button onClick={() => setAmortizationType('fixed_capital')}
                            className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-all ${amortizationType === 'fixed_capital' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                            Amortissement constant
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {amortizationType === 'fixed_annuity'
                            ? "L'échéance totale reste identique. L'amortissement augmente quand les intérêts baissent."
                            : "Le capital remboursé reste fixe. L'échéance totale diminue au fil du temps."}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1.5">
                          {amortizationType === 'fixed_annuity' ? 'Échéance totale (fixe)' : 'Amortissement (capital fixe)'}
                        </label>
                        <MoneyInput value={paymentAmount} onChange={setPaymentAmount}
                          placeholder={amortizationType === 'fixed_annuity' ? "Montant total de l'échéance" : 'Montant du remboursement du capital'}
                          className={monoInputClass} />
                      </div>
                    </>
                  )}

                  {/* Mortgage: Frequency + Day of payment */}
                  {isMortgage && (
                    <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Fréquence</label>
                        <select value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value)} className={inputClass}>
                          {PAYMENT_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Jour de prélèvement</label>
                        <input type="number" min="1" max="31" value={endOfMonth ? '' : paymentDay} disabled={endOfMonth}
                          onChange={e => setPaymentDay(e.target.value)} placeholder={endOfMonth ? 'Fin du mois' : ''}
                          className={`${monoInputClass} disabled:opacity-50`} />
                        <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                          <input type="checkbox" checked={endOfMonth} onChange={e => { setEndOfMonth(e.target.checked); if (e.target.checked) setPaymentDay('31'); }} className="rounded border-border" />
                          <span className="text-xs text-muted-foreground">Fin du mois</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">1ère échéance</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={`${inputClass} text-left`}>
                              {format(nextPaymentDate, 'dd MMM yyyy', { locale: fr })}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={nextPaymentDate} onSelect={d => d && setNextPaymentDate(d)} className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    </>
                  )}

                  {/* Summary box */}
                  <div className={`rounded-xl border p-3 space-y-1.5 ${
                    isSwiss ? 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10' :
                    isEurope ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/10' :
                    'border-border bg-muted/50'
                  }`}>
                    {isSwiss ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">📉 Intérêts ({frequencyLabel}s)</span>
                          <span className="font-mono font-medium">{formatAmount(swissPeriodicInterest, debtCurrency)}</span>
                        </div>
                        {swissAmortizationType !== 'none' && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">💰 Amortissement {frequencyLabel}</span>
                            <span className="font-mono font-medium">{formatAmount(swissPeriodicAmortization, debtCurrency)}</span>
                          </div>
                        )}
                        {includeMaintenance && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">🔧 Frais d'entretien</span>
                            <span className="font-mono font-medium">{formatAmount(swissPeriodicMaintenance, debtCurrency)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-semibold border-t border-red-200 dark:border-red-900/30 pt-1.5">
                          <span>Charge {frequencyLabelFem} totale</span>
                          <span className="font-mono">{formatAmount(swissTotalPeriodic, debtCurrency)}</span>
                        </div>
                        {propertyValue && parseFloat(remainingAmount) > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            LTV : {Math.round((parseFloat(remainingAmount) / parseFloat(propertyValue)) * 100)}% de la valeur du bien
                          </div>
                        )}
                      </>
                    ) : isEurope ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">📉 Intérêts (période)</span>
                          <span className="font-mono font-medium">{formatAmount(europeCurrentInterest, debtCurrency)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">💰 Capital (période)</span>
                          <span className="font-mono font-medium">{formatAmount(europeCurrentCapital, debtCurrency)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold border-t border-blue-200 dark:border-blue-900/30 pt-1.5">
                          <span>Échéance {frequencyLabelFem} fixe</span>
                          <span className="font-mono">{formatAmount(europePeriodicPayment, debtCurrency)}</span>
                        </div>
                        {durationYears && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            📅 {durationYears} ans — {Math.round(parseFloat(durationYears) * periodsPerYear)} échéances
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Intérêts (1ère échéance)</span>
                          <span className="font-mono font-medium">{formatAmount(calculatedInterest, debtCurrency)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Amortissement</span>
                          <span className="font-mono font-medium">{formatAmount(displayedCapital, debtCurrency)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5">
                          <span>Échéance totale</span>
                          <span className="font-mono">{formatAmount(totalPayment, debtCurrency)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Next payment date (non-mortgage) */}
                  {!isMortgage && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Date de la 1ère échéance</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={`${inputClass} text-left`}>
                            {format(nextPaymentDate, 'dd MMMM yyyy', { locale: fr })}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={nextPaymentDate} onSelect={d => d && setNextPaymentDate(d)} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Account */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Compte de prélèvement</label>
                    <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputClass}>
                      <option value="">Aucun</option>
                      {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Catégorie de dépense</label>
                    <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass}>
                      <option value="">Aucune</option>
                      {allExpenseCategories.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || '📌'} {c}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Submit (only on form step) */}
              {step === 'form' && (
                <div className="mt-6 flex gap-3">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                  <button onClick={handleSubmit}
                    disabled={saving || !name.trim() || !initialAmount || !remainingAmount || (!isMortgage && !paymentAmount) || (isEurope && (!paymentAmount || !durationYears))}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {saving ? 'Génération...' : 'Ajouter'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddDebtModal;
