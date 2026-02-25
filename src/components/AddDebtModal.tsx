import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEBT_TYPES, PAYMENT_FREQUENCIES, DebtType, MortgageSystem, RateType, SwissAmortizationType, VehicleType, ConsumerType, DeferralType } from '@/types/debt';
import { formatLocalDate, formatAmount } from '@/utils/format';
import { EXPENSE_CATEGORIES, CATEGORY_EMOJIS, CURRENCIES, CURRENCY_SYMBOLS } from '@/types/finance';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateAmortizationSchedule } from '@/utils/debtSchedule';
import MoneyInput from '@/components/ui/money-input';
import { ArrowLeft } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

type Step = 'type' | 'mortgage_system' | 'vehicle_type' | 'consumer_type' | 'form';

const VEHICLE_TYPES: { value: VehicleType; label: string; emoji: string; desc: string }[] = [
  { value: 'credit', label: 'Crédit auto', emoji: '💰', desc: "Tu empruntes et rembourses — La voiture est à toi dès le départ" },
  { value: 'leasing', label: 'Leasing (LOA)', emoji: '🔄', desc: "Location avec option d'achat — Tu peux racheter la voiture à la fin" },
  { value: 'lld', label: 'Location longue durée (LLD)', emoji: '📋', desc: "Tu loues, tu rends à la fin — Souvent entretien et services inclus" },
];

const LLD_SERVICES = [
  { value: 'maintenance', label: 'Entretien et révisions', emoji: '🔧' },
  { value: 'insurance', label: 'Assurance tous risques', emoji: '🛡️' },
  { value: 'assistance', label: 'Assistance 24h/24', emoji: '📞' },
  { value: 'replacement', label: 'Véhicule de remplacement', emoji: '🚗' },
  { value: 'winter_tires', label: 'Pneus hiver', emoji: '❄️' },
  { value: 'fuel_card', label: 'Carte carburant', emoji: '⛽' },
];

const CONSUMER_TYPES: { value: ConsumerType; label: string; emoji: string; desc: string }[] = [
  { value: 'personal', label: 'Prêt personnel', emoji: '💰', desc: "Somme fixe empruntée, mensualités fixes — Ex: travaux, voyage, mariage" },
  { value: 'revolving', label: 'Crédit revolving', emoji: '🔄', desc: "Réserve d'argent utilisable à tout moment — Ex: carte de crédit avec réserve" },
  { value: 'purchase', label: 'Achat à crédit', emoji: '🛒', desc: "Financement d'un achat spécifique — Ex: électroménager, meuble, électronique" },
];

const AddDebtModal = ({ open, onClose, onAdded }: Props) => {
  const { householdId, household, customCategories, getActiveAccounts, financeScope, session } = useApp();
  
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
  
  // Mortgage-specific
  const [rateType, setRateType] = useState<RateType>('fixed');
  const [rateEndDate, setRateEndDate] = useState<Date | null>(null);
  const [propertyValue, setPropertyValue] = useState('');
  const [annualAmortization, setAnnualAmortization] = useState('');
  const [swissAmortizationType, setSwissAmortizationType] = useState<SwissAmortizationType>('direct');
  const [includeMaintenance, setIncludeMaintenance] = useState(false);
  const [durationMonths, setDurationMonths] = useState('');

  // Vehicle-specific
  const [vehicleType, setVehicleType] = useState<VehicleType>('credit');
  const [vehicleName, setVehicleName] = useState('');
  const [vehiclePrice, setVehiclePrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [annualKm, setAnnualKm] = useState('');
  const [residualValue, setResidualValue] = useState('');
  const [excessKmCost, setExcessKmCost] = useState('');
  const [servicesIncluded, setServicesIncluded] = useState<string[]>([]);
  const [vehicleDurationMonths, setVehicleDurationMonths] = useState('');

  // Consumer-specific
  const [consumerType, setConsumerType] = useState<ConsumerType>('personal');
  const [creditLimit, setCreditLimit] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');

  // Student-specific
  const [hasDeferral, setHasDeferral] = useState(false);
  const [deferralEndDate, setDeferralEndDate] = useState<Date | null>(null);
  const [deferralType, setDeferralType] = useState<DeferralType>('total');
  const [durationMonthsConsumer, setDurationMonthsConsumer] = useState('');

  // Other-specific
  const [hasInterest, setHasInterest] = useState(true);
  const [hasSchedule, setHasSchedule] = useState(true);
  const [notes, setNotes] = useState('');

  const activeAccounts = getActiveAccounts();
  const allExpenseCategories = [...EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type === 'expense').map(c => c.name)];

  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    if (newAccountId) {
      const account = activeAccounts.find(a => a.id === newAccountId);
      if (account) {
        setDebtCurrency(account.currency);
      }
    }
  };

  const isMortgage = type === 'mortgage';
  const isSwiss = isMortgage && mortgageSystem === 'swiss';
  const isEurope = isMortgage && mortgageSystem === 'europe';
  const isVehicle = type === 'auto';
  const isConsumer = type === 'consumer';
  const isStudent = type === 'student';
  const isOther = type === 'other';

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

  // Swiss calculations
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

  // Europe calculations
  const europePeriodicPayment = useMemo(() => parseFloat(paymentAmount) || 0, [paymentAmount]);
  const europeCurrentInterest = useMemo(() => {
    const rem = parseFloat(remainingAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    if (rate === 0) return 0;
    return rem * (rate / 100 / periodsPerYear);
  }, [remainingAmount, interestRate, periodsPerYear]);
  const europeCurrentCapital = europePeriodicPayment > 0 ? Math.max(europePeriodicPayment - europeCurrentInterest, 0) : 0;

  // Standard calculations
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

  // Vehicle credit calculations
  const vehicleLoanAmount = useMemo(() => {
    return (parseFloat(vehiclePrice) || 0) - (parseFloat(downPayment) || 0);
  }, [vehiclePrice, downPayment]);

  const vehicleMonthlyPayment = useMemo(() => {
    if (vehicleType !== 'credit') return parseFloat(paymentAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const n = parseInt(vehicleDurationMonths) || 0;
    if (vehicleLoanAmount <= 0 || n <= 0) return 0;
    if (rate === 0) return vehicleLoanAmount / n;
    const monthlyRate = rate / 100 / 12;
    return vehicleLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  }, [vehicleType, vehicleLoanAmount, interestRate, vehicleDurationMonths, paymentAmount]);

  const vehicleTotalCost = useMemo(() => {
    if (vehicleType === 'credit') {
      const n = parseInt(vehicleDurationMonths) || 0;
      return (vehicleMonthlyPayment * n) + (parseFloat(downPayment) || 0);
    }
    if (vehicleType === 'leasing') {
      const n = parseInt(vehicleDurationMonths) || 0;
      return (parseFloat(downPayment) || 0) + ((parseFloat(paymentAmount) || 0) * n) + (parseFloat(residualValue) || 0);
    }
    // LLD
    const n = parseInt(vehicleDurationMonths) || 0;
    return (parseFloat(paymentAmount) || 0) * n;
  }, [vehicleType, vehicleMonthlyPayment, vehicleDurationMonths, downPayment, paymentAmount, residualValue]);

  const vehicleContractEndDate = useMemo(() => {
    const n = parseInt(vehicleDurationMonths) || 0;
    if (n <= 0) return null;
    return addMonths(startDate, n);
  }, [startDate, vehicleDurationMonths]);

  // Consumer credit calculations
  const consumerLoanAmount = useMemo(() => {
    if (consumerType === 'purchase') return (parseFloat(purchasePrice) || 0) - (parseFloat(downPayment) || 0);
    return parseFloat(initialAmount) || 0;
  }, [consumerType, purchasePrice, downPayment, initialAmount]);

  const consumerMonthlyPayment = useMemo(() => {
    if (consumerType === 'revolving') return parseFloat(minimumPayment) || 0;
    const rate = parseFloat(interestRate) || 0;
    const n = parseInt(durationMonthsConsumer) || 0;
    const amount = consumerType === 'purchase' ? consumerLoanAmount : (parseFloat(initialAmount) || 0);
    if (amount <= 0 || n <= 0) return 0;
    if (rate === 0) return amount / n;
    const monthlyRate = rate / 100 / 12;
    return amount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  }, [consumerType, consumerLoanAmount, initialAmount, interestRate, durationMonthsConsumer, minimumPayment]);

  const reset = () => {
    setStep('type');
    setType('mortgage'); setMortgageSystem(null); setName(''); setLender(''); setInitialAmount(''); setRemainingAmount('');
    setInterestRate(''); setDurationYears(''); setStartDate(new Date()); setPaymentFrequency('monthly');
    setPaymentDay('1'); setEndOfMonth(false); setPaymentAmount(''); setCategoryId(''); setAccountId('');
    setAmortizationType('fixed_annuity'); setNextPaymentDate(new Date()); setDebtCurrency(household.currency);
    setRateType('fixed'); setRateEndDate(null); setPropertyValue(''); setAnnualAmortization('');
    setSwissAmortizationType('direct'); setIncludeMaintenance(false); setDurationMonths('');
    setVehicleType('credit'); setVehicleName(''); setVehiclePrice(''); setDownPayment('');
    setAnnualKm(''); setResidualValue(''); setExcessKmCost(''); setServicesIncluded([]);
    setVehicleDurationMonths('');
    setConsumerType('personal'); setCreditLimit(''); setCurrentBalance(''); setMinimumPayment('');
    setPurchasePrice('');
    setHasDeferral(false); setDeferralEndDate(null); setDeferralType('total'); setDurationMonthsConsumer('');
    setHasInterest(true); setHasSchedule(true); setNotes('');
  };

  const handleTypeSelect = (t: DebtType) => {
    setType(t);
    if (t === 'mortgage') {
      setStep('mortgage_system');
    } else if (t === 'auto') {
      setStep('vehicle_type');
    } else if (t === 'consumer') {
      setStep('consumer_type');
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

  const handleVehicleTypeSelect = (vt: VehicleType) => {
    setVehicleType(vt);
    setAmortizationType('fixed_annuity');
    setPaymentFrequency('monthly');
    setStep('form');
  };

  const handleConsumerTypeSelect = (ct: ConsumerType) => {
    setConsumerType(ct);
    setAmortizationType('fixed_annuity');
    setPaymentFrequency('monthly');
    setStep('form');
  };

  const getEffectivePaymentAmount = () => {
    if (isSwiss) return swissAmortizationType !== 'none' ? swissPeriodicAmortization : 0;
    if (isEurope) return parseFloat(paymentAmount) || 0;
    if (isVehicle && vehicleType === 'credit') return vehicleMonthlyPayment;
    if (isVehicle) return parseFloat(paymentAmount) || 0;
    if (isConsumer && consumerType !== 'revolving') return Math.round(consumerMonthlyPayment * 100) / 100;
    if (isConsumer && consumerType === 'revolving') return parseFloat(minimumPayment) || 0;
    if (isStudent) return Math.round(consumerMonthlyPayment * 100) / 100;
    if (isOther && !hasSchedule) return 0;
    return parseFloat(paymentAmount) || 0;
  };

  const getEffectiveDurationYears = () => {
    if (isVehicle) return (parseInt(vehicleDurationMonths) || 0) / 12;
    if ((isConsumer && consumerType !== 'revolving') || isStudent) return (parseInt(durationMonthsConsumer) || 0) / 12;
    if (isOther && !hasSchedule) return 0;
    return parseFloat(durationYears) || 0;
  };

  const toggleService = (svc: string) => {
    setServicesIncluded(prev => prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]);
  };

  const canSubmitVehicle = () => {
    if (!vehicleName.trim()) return false;
    if (vehicleType === 'credit') {
      return vehicleLoanAmount > 0 && vehicleMonthlyPayment > 0 && parseInt(vehicleDurationMonths) > 0;
    }
    if (vehicleType === 'leasing') {
      return parseFloat(paymentAmount) > 0 && parseInt(vehicleDurationMonths) > 0 && parseInt(annualKm) > 0 && parseFloat(residualValue) > 0;
    }
    // LLD
    return parseFloat(paymentAmount) > 0 && parseInt(vehicleDurationMonths) > 0 && parseInt(annualKm) > 0;
  };

  const canSubmitConsumer = () => {
    if (!name.trim()) return false;
    if (consumerType === 'revolving') return parseFloat(creditLimit) > 0 && parseFloat(currentBalance) >= 0 && parseFloat(minimumPayment) > 0;
    if (consumerType === 'purchase') return parseFloat(purchasePrice) > 0 && parseInt(durationMonthsConsumer) > 0 && parseFloat(remainingAmount) > 0;
    return parseFloat(initialAmount) > 0 && parseFloat(remainingAmount) > 0 && parseInt(durationMonthsConsumer) > 0;
  };

  const canSubmitStudent = () => {
    return name.trim() && parseFloat(initialAmount) > 0 && parseFloat(remainingAmount) > 0 && parseInt(durationMonthsConsumer) > 0;
  };

  const canSubmitOther = () => {
    return name.trim() && parseFloat(initialAmount) > 0 && parseFloat(remainingAmount) > 0;
  };

  const handleSubmit = async () => {
    if (isVehicle) {
      if (!canSubmitVehicle()) return;
    } else if (isConsumer) {
      if (!canSubmitConsumer()) return;
    } else if (isStudent) {
      if (!canSubmitStudent()) return;
    } else if (isOther) {
      if (!canSubmitOther()) return;
    } else {
      if (!name.trim() || !initialAmount || !remainingAmount) return;
      if (!isMortgage && (!paymentAmount || !durationYears)) return;
      if (isEurope && (!paymentAmount || !durationYears)) return;
    }
    
    setSaving(true);

    const nextDateStr = formatLocalDate(nextPaymentDate);
    const day = Math.max(1, Math.min(31, parseInt(paymentDay) || 1));
    const effectivePayment = getEffectivePaymentAmount();
    const effectiveDuration = getEffectiveDurationYears();

    // Build debt data
    let debtData: any;

    if (isVehicle) {
      const loanAmt = vehicleType === 'credit' ? vehicleLoanAmount : 0;
      const contractEnd = vehicleContractEndDate ? formatLocalDate(vehicleContractEndDate) : null;
      
      debtData = {
        household_id: householdId,
        type: 'auto',
        name: vehicleName.trim(),
        lender: lender.trim() || null,
        initial_amount: vehicleType === 'credit' ? loanAmt : (parseFloat(vehiclePrice) || parseFloat(paymentAmount) * (parseInt(vehicleDurationMonths) || 0)),
        remaining_amount: vehicleType === 'credit' ? loanAmt : (parseFloat(paymentAmount) || 0) * Math.max((parseInt(vehicleDurationMonths) || 0) - 0, 0),
        currency: debtCurrency,
        interest_rate: parseFloat(interestRate) || 0,
        duration_years: effectiveDuration,
        start_date: formatLocalDate(startDate),
        payment_frequency: 'monthly',
        payment_day: day,
        payment_amount: vehicleType === 'credit' ? Math.round(vehicleMonthlyPayment * 100) / 100 : parseFloat(paymentAmount) || 0,
        category_id: categoryId || null,
        account_id: accountId || null,
        amortization_type: 'fixed_annuity',
        next_payment_date: nextDateStr,
        scope: financeScope,
        created_by: session?.user?.id,
        mortgage_system: null,
        rate_type: 'fixed',
        rate_end_date: null,
        property_value: null,
        annual_amortization: null,
        swiss_amortization_type: null,
        include_maintenance: false,
        // Vehicle fields
        vehicle_type: vehicleType,
        vehicle_name: vehicleName.trim(),
        vehicle_price: parseFloat(vehiclePrice) || null,
        down_payment: parseFloat(downPayment) || null,
        annual_km: parseInt(annualKm) || null,
        residual_value: parseFloat(residualValue) || null,
        excess_km_cost: parseFloat(excessKmCost) || null,
        services_included: servicesIncluded.length > 0 ? servicesIncluded : null,
        contract_end_date: contractEnd,
        current_km: 0,
      };
    } else {
      const effectiveInitial = isConsumer && consumerType === 'purchase' ? consumerLoanAmount :
                               isConsumer && consumerType === 'revolving' ? (parseFloat(currentBalance) || 0) :
                               parseFloat(initialAmount);
      const effectiveRemaining = isConsumer && consumerType === 'revolving' ? (parseFloat(currentBalance) || 0) :
                                  parseFloat(remainingAmount);
      
      debtData = {
        household_id: householdId,
        type,
        name: name.trim(),
        lender: lender.trim() || null,
        initial_amount: effectiveInitial,
        remaining_amount: effectiveRemaining,
        currency: debtCurrency,
        interest_rate: (isOther && !hasInterest) ? 0 : (parseFloat(interestRate) || 0),
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
        mortgage_system: isMortgage ? mortgageSystem : null,
        rate_type: rateType,
        rate_end_date: rateEndDate ? formatLocalDate(rateEndDate) : null,
        property_value: isSwiss ? (parseFloat(propertyValue) || null) : null,
        annual_amortization: isSwiss ? (parseFloat(annualAmortization) || null) : null,
        swiss_amortization_type: isSwiss ? swissAmortizationType : null,
        include_maintenance: isSwiss ? includeMaintenance : false,
        // Consumer fields
        consumer_type: isConsumer ? consumerType : null,
        credit_limit: isConsumer && consumerType === 'revolving' ? (parseFloat(creditLimit) || null) : null,
        current_balance: isConsumer && consumerType === 'revolving' ? (parseFloat(currentBalance) || null) : null,
        minimum_payment: isConsumer && consumerType === 'revolving' ? (parseFloat(minimumPayment) || null) : null,
        purchase_price: isConsumer && consumerType === 'purchase' ? (parseFloat(purchasePrice) || null) : null,
        // Student fields
        has_deferral: isStudent ? hasDeferral : false,
        deferral_end_date: isStudent && hasDeferral && deferralEndDate ? formatLocalDate(deferralEndDate) : null,
        deferral_type: isStudent && hasDeferral ? deferralType : null,
        // Other fields
        has_interest: isOther ? hasInterest : true,
        has_schedule: isOther ? hasSchedule : true,
        notes: (isOther || isStudent) ? (notes.trim() || null) : null,
        // Vehicle - explicitly null for non-vehicle
        down_payment: isConsumer && consumerType === 'purchase' ? (parseFloat(downPayment) || null) : null,
      };
    }

    const { data: insertedDebt, error } = await supabase.from('debts').insert(debtData).select('id').single();
    if (error || !insertedDebt) {
      console.error('Insert debt error:', error);
      toast.error("Erreur lors de l'ajout");
      setSaving(false);
      return;
    }

    // Generate amortization schedule
    const shouldGenerateSchedule = (!isVehicle || vehicleType === 'credit') && 
      !(isConsumer && consumerType === 'revolving') &&
      !(isOther && !hasSchedule);
    
    if (shouldGenerateSchedule) {
      const schedulePayment = isSwiss
        ? swissPeriodicAmortization
        : isEurope
          ? Math.round((parseFloat(paymentAmount) || 0) * 100) / 100
          : isVehicle
            ? Math.round(vehicleMonthlyPayment * 100) / 100
            : (isConsumer || isStudent)
              ? Math.round(consumerMonthlyPayment * 100) / 100
              : parseFloat(paymentAmount);

      const scheduleRemaining = isVehicle ? vehicleLoanAmount : 
        isConsumer && consumerType === 'purchase' ? consumerLoanAmount :
        parseFloat(remainingAmount);

      // For student loans with deferral, schedule starts after deferral end date
      const scheduleStartDate = (isStudent && hasDeferral && deferralEndDate) 
        ? formatLocalDate(deferralEndDate) 
        : nextDateStr;

      const scheduleRows = generateAmortizationSchedule({
        remainingPrincipal: scheduleRemaining,
        interestRateAnnual: parseFloat(interestRate) || 0,
        frequency: (isVehicle ? 'monthly' : paymentFrequency) as any,
        repaymentMode: isSwiss ? 'fixed_capital' : isEurope ? 'fixed_annuity' : amortizationType,
        paymentAmount: schedulePayment,
        startDate: scheduleStartDate,
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

        // silent
      } else {
        // silent
      }
    } else {
      // For leasing/LLD, generate simple schedule (loyer entries without amortization)
      const n = parseInt(vehicleDurationMonths) || 0;
      const monthly = parseFloat(paymentAmount) || 0;
      if (n > 0 && monthly > 0) {
        const rows = [];
        for (let i = 1; i <= n; i++) {
          const dueDate = addMonths(nextPaymentDate, i - 1);
          const remaining = monthly * (n - i);
          rows.push({
            debt_id: insertedDebt.id,
            household_id: householdId,
            due_date: formatLocalDate(dueDate),
            period_number: i,
            capital_before: monthly * (n - i + 1),
            capital_after: remaining,
            interest_amount: 0,
            principal_amount: monthly,
            total_amount: monthly,
            status: 'prevu' as const,
          });
        }
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error: schedError } = await supabase.from('debt_schedules').insert(batch as any);
          if (schedError) console.error('Insert schedule error:', schedError);
        }
        // silent
      } else {
        // silent
      }
    }

    setSaving(false);
    reset();
    onAdded();
  };

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const monoInputClass = `${inputClass} font-mono`;

  const getStepTitle = () => {
    if (step === 'type') return '➕ Type de dette';
    if (step === 'mortgage_system') return '🏠 Système de remboursement';
    if (step === 'vehicle_type') return '🚗 Type de financement';
    if (step === 'consumer_type') return '💳 Type de crédit';
    if (isConsumer) return `💳 ${CONSUMER_TYPES.find(c => c.value === consumerType)?.label || 'Crédit'}`;
    if (isStudent) return '🎓 Prêt étudiant';
    if (isOther) return '📦 Autre dette';
    return '➕ Ajouter une dette';
  };

  const handleBack = () => {
    if (step === 'form' && isVehicle) setStep('vehicle_type');
    else if (step === 'form' && isMortgage) setStep('mortgage_system');
    else if (step === 'form' && isConsumer) setStep('consumer_type');
    else if (step === 'vehicle_type' || step === 'mortgage_system' || step === 'consumer_type') setStep('type');
    else setStep('type');
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
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  {step !== 'type' && (
                    <button onClick={handleBack} className="p-1 rounded-lg hover:bg-muted">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <h2 className="text-lg font-bold">{getStepTitle()}</h2>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
              </div>

              {/* Step 1: Type selection */}
              {step === 'type' && (
                <div className="space-y-2">
                  {[
                    { value: 'mortgage' as const, emoji: '🏠', label: 'Crédit immobilier', desc: 'Hypothèque, prêt immobilier' },
                    { value: 'auto' as const, emoji: '🚗', label: 'Véhicule', desc: 'Crédit auto, leasing, LLD' },
                    { value: 'consumer' as const, emoji: '💳', label: 'Crédit consommation', desc: 'Crédit à la consommation' },
                    { value: 'student' as const, emoji: '🎓', label: 'Prêt étudiant', desc: 'Prêt études' },
                    { value: 'other' as const, emoji: '📦', label: 'Autre', desc: 'Autre type de dette' },
                  ].map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => handleTypeSelect(dt.value)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <span className="text-2xl">{dt.emoji}</span>
                      <div>
                        <p className="font-semibold text-sm">{dt.label}</p>
                        <p className="text-[10px] text-muted-foreground">{dt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2a: Mortgage system */}
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

              {/* Step 2b: Vehicle type selection */}
              {step === 'vehicle_type' && (
                <div className="space-y-3">
                  {VEHICLE_TYPES.map(vt => (
                    <button
                      key={vt.value}
                      onClick={() => handleVehicleTypeSelect(vt.value)}
                      className="w-full flex items-start gap-3 px-4 py-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <span className="text-2xl">{vt.emoji}</span>
                      <div>
                        <p className="font-semibold text-sm">{vt.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{vt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2c: Consumer type selection */}
              {step === 'consumer_type' && (
                <div className="space-y-3">
                  {CONSUMER_TYPES.map(ct => (
                    <button
                      key={ct.value}
                      onClick={() => handleConsumerTypeSelect(ct.value)}
                      className="w-full flex items-start gap-3 px-4 py-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <span className="text-2xl">{ct.emoji}</span>
                      <div>
                        <p className="font-semibold text-sm">{ct.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{ct.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 3: Form */}
              {step === 'form' && (
                <div className="space-y-4">
                  {/* Vehicle badge */}
                  {isVehicle && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      {VEHICLE_TYPES.find(v => v.value === vehicleType)?.emoji} {VEHICLE_TYPES.find(v => v.value === vehicleType)?.label}
                    </div>
                  )}

                  {/* Consumer badge */}
                  {isConsumer && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
                      {CONSUMER_TYPES.find(c => c.value === consumerType)?.emoji} {CONSUMER_TYPES.find(c => c.value === consumerType)?.label}
                    </div>
                  )}

                  {/* Student badge */}
                  {isStudent && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                      🎓 Prêt étudiant
                    </div>
                  )}

                  {/* Other badge */}
                  {isOther && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                      📦 Autre dette
                    </div>
                  )}

                  {/* Mortgage badge */}
                  {isMortgage && (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      isSwiss ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                    }`}>
                      {isSwiss ? '🇨🇭 Système suisse' : '🇪🇺 Système européen'}
                    </div>
                  )}

                  {/* ===== VEHICLE FORMS ===== */}
                  {isVehicle && (
                    <>
                      {/* Vehicle name */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Véhicule</label>
                        <input value={vehicleName} onChange={e => setVehicleName(e.target.value)} 
                          placeholder={vehicleType === 'credit' ? 'Ex: Volkswagen Golf 8' : vehicleType === 'leasing' ? 'Ex: BMW Série 3' : 'Ex: Renault Clio'}
                          className={inputClass} />
                      </div>

                      {/* Lender */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5">
                          {vehicleType === 'credit' ? 'Organisme de crédit' : vehicleType === 'leasing' ? 'Société de leasing' : 'Société de location'} <span className="text-muted-foreground">(optionnel)</span>
                        </label>
                        <input value={lender} onChange={e => setLender(e.target.value)} 
                          placeholder={vehicleType === 'credit' ? 'Ex: Cetelem' : vehicleType === 'leasing' ? 'Ex: BMW Financial Services' : 'Ex: Arval, ALD'}
                          className={inputClass} />
                      </div>

                      {/* Currency */}
                       <div>
                        <label className="block text-sm font-medium mb-1.5">Devise</label>
                        <select value={debtCurrency} onChange={e => { setDebtCurrency(e.target.value); setAccountId(''); }} disabled={!!accountId} className={inputClass}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} — {c}</option>)}
                        </select>
                        {accountId && <p className="text-xs text-muted-foreground mt-1">Devise liée au compte sélectionné</p>}
                      </div>

                      {/* Credit auto specific */}
                      {vehicleType === 'credit' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Prix du véhicule</label>
                            <MoneyInput value={vehiclePrice} onChange={setVehiclePrice} className={monoInputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Apport initial <span className="text-muted-foreground">(optionnel)</span></label>
                            <MoneyInput value={downPayment} onChange={setDownPayment} className={monoInputClass} />
                          </div>
                          <div className="bg-muted/50 rounded-xl p-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Montant emprunté</span>
                              <span className="font-mono font-semibold">{formatAmount(vehicleLoanAmount, debtCurrency)}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Taux d'intérêt (%)</label>
                              <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} className={monoInputClass} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Durée (mois)</label>
                              <input type="number" step="1" value={vehicleDurationMonths} onChange={e => setVehicleDurationMonths(e.target.value)} placeholder="Ex: 48, 60, 72" className={monoInputClass} />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Leasing specific */}
                      {vehicleType === 'leasing' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Prix catalogue</label>
                            <MoneyInput value={vehiclePrice} onChange={setVehiclePrice} className={monoInputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">1er loyer majoré <span className="text-muted-foreground">(optionnel)</span></label>
                            <MoneyInput value={downPayment} onChange={setDownPayment} className={monoInputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Loyer mensuel</label>
                            <MoneyInput value={paymentAmount} onChange={setPaymentAmount} className={monoInputClass} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Durée (mois)</label>
                              <input type="number" step="1" value={vehicleDurationMonths} onChange={e => setVehicleDurationMonths(e.target.value)} placeholder="Ex: 36, 48" className={monoInputClass} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Km annuels</label>
                              <input type="number" step="1000" value={annualKm} onChange={e => setAnnualKm(e.target.value)} placeholder="Ex: 15000" className={monoInputClass} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Valeur résiduelle (rachat)</label>
                            <MoneyInput value={residualValue} onChange={setResidualValue} className={monoInputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Coût km excédentaire <span className="text-muted-foreground">(optionnel)</span></label>
                            <MoneyInput value={excessKmCost} onChange={setExcessKmCost} placeholder="Ex: 0.15" className={monoInputClass} />
                          </div>
                        </>
                      )}

                      {/* LLD specific */}
                      {vehicleType === 'lld' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Loyer mensuel</label>
                            <MoneyInput value={paymentAmount} onChange={setPaymentAmount} className={monoInputClass} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Durée (mois)</label>
                              <input type="number" step="1" value={vehicleDurationMonths} onChange={e => setVehicleDurationMonths(e.target.value)} placeholder="Ex: 24, 36, 48" className={monoInputClass} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Km annuels</label>
                              <input type="number" step="1000" value={annualKm} onChange={e => setAnnualKm(e.target.value)} placeholder="Ex: 20000" className={monoInputClass} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Coût km excédentaire <span className="text-muted-foreground">(optionnel)</span></label>
                            <MoneyInput value={excessKmCost} onChange={setExcessKmCost} placeholder="Ex: 0.12" className={monoInputClass} />
                          </div>
                          {/* Services included */}
                          <div>
                            <label className="block text-sm font-medium mb-2">Services inclus <span className="text-muted-foreground">(optionnel)</span></label>
                            <div className="grid grid-cols-2 gap-2">
                              {LLD_SERVICES.map(svc => (
                                <label key={svc.value} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm ${
                                  servicesIncluded.includes(svc.value) ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'
                                }`}>
                                  <input type="checkbox" checked={servicesIncluded.includes(svc.value)} onChange={() => toggleService(svc.value)} className="sr-only" />
                                  <span>{svc.emoji}</span>
                                  <span className="text-xs">{svc.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Start date */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Date de début</label>
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

                      {/* Payment day + 1st due */}
                      <div className="grid grid-cols-2 gap-3">
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

                      {/* Vehicle summary */}
                      <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/10 p-3 space-y-1.5">
                        {vehicleType === 'credit' && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">💰 Mensualité calculée</span>
                              <span className="font-mono font-semibold">{formatAmount(vehicleMonthlyPayment, debtCurrency)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">📊 Coût total du crédit</span>
                              <span className="font-mono font-medium">{formatAmount(vehicleTotalCost, debtCurrency)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">📉 Total intérêts</span>
                              <span className="font-mono font-medium text-destructive">{formatAmount(vehicleTotalCost - (parseFloat(vehiclePrice) || 0), debtCurrency)}</span>
                            </div>
                          </>
                        )}
                        {vehicleType === 'leasing' && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">🔄 Total des loyers</span>
                              <span className="font-mono font-medium">{formatAmount((parseFloat(downPayment) || 0) + (parseFloat(paymentAmount) || 0) * (parseInt(vehicleDurationMonths) || 0), debtCurrency)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">💰 Coût total si rachat</span>
                              <span className="font-mono font-semibold">{formatAmount(vehicleTotalCost, debtCurrency)}</span>
                            </div>
                            {annualKm && vehicleDurationMonths && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">🛣️ Km total autorisés</span>
                                <span className="font-mono font-medium">{((parseInt(annualKm) || 0) * (parseInt(vehicleDurationMonths) || 0) / 12).toLocaleString('fr-FR')} km</span>
                              </div>
                            )}
                          </>
                        )}
                        {vehicleType === 'lld' && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">📋 Total des loyers</span>
                              <span className="font-mono font-semibold">{formatAmount(vehicleTotalCost, debtCurrency)}</span>
                            </div>
                            {annualKm && vehicleDurationMonths && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">🛣️ Km total autorisés</span>
                                <span className="font-mono font-medium">{((parseInt(annualKm) || 0) * (parseInt(vehicleDurationMonths) || 0) / 12).toLocaleString('fr-FR')} km</span>
                              </div>
                            )}
                            {servicesIncluded.length > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-1">
                                {servicesIncluded.map(s => {
                                  const svc = LLD_SERVICES.find(sv => sv.value === s);
                                  return svc ? <span key={s} className="bg-muted px-1.5 py-0.5 rounded">{svc.emoji} {svc.label}</span> : null;
                                })}
                              </div>
                            )}
                          </>
                        )}
                        {vehicleContractEndDate && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            📅 Fin du contrat : {format(vehicleContractEndDate, 'MMMM yyyy', { locale: fr })}
                          </div>
                        )}
                      </div>

                      {/* Account */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Compte de prélèvement</label>
                        <select value={accountId} onChange={e => handleAccountChange(e.target.value)} className={inputClass}>
                          <option value="">Aucun</option>
                          {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
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
                    </>
                  )}

                  {/* ===== CONSUMER / STUDENT / OTHER / MORTGAGE FORMS ===== */}
                  {!isVehicle && (
                    <>
                      {/* ===== CONSUMER FORMS ===== */}
                      {isConsumer && (
                        <>
                          {/* Name */}
                          <div>
                            <label className="block text-sm font-medium mb-1.5">
                              {consumerType === 'personal' ? 'Objet du prêt' : consumerType === 'revolving' ? 'Nom de la réserve' : 'Article acheté'}
                            </label>
                            <input value={name} onChange={e => setName(e.target.value)} 
                              placeholder={consumerType === 'personal' ? 'Ex: Travaux cuisine' : consumerType === 'revolving' ? 'Ex: Carte Cembra' : 'Ex: MacBook Pro'}
                              className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">{consumerType === 'purchase' ? 'Magasin / Organisme' : 'Organisme'} <span className="text-muted-foreground">(optionnel)</span></label>
                            <input value={lender} onChange={e => setLender(e.target.value)} placeholder="Ex: Cetelem, Apple" className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Devise</label>
                            <select value={debtCurrency} onChange={e => { setDebtCurrency(e.target.value); setAccountId(''); }} disabled={!!accountId} className={inputClass}>
                              {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} — {c}</option>)}
                            </select>
                            {accountId && <p className="text-xs text-muted-foreground mt-1">Devise liée au compte sélectionné</p>}
                          </div>

                          {/* Personal loan */}
                          {consumerType === 'personal' && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Montant emprunté</label>
                                  <MoneyInput value={initialAmount} onChange={setInitialAmount} className={monoInputClass} />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Capital restant dû</label>
                                  <MoneyInput value={remainingAmount} onChange={setRemainingAmount} className={monoInputClass} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Taux (TAEG %)</label>
                                  <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} className={monoInputClass} />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Durée (mois)</label>
                                  <input type="number" step="1" value={durationMonthsConsumer} onChange={e => setDurationMonthsConsumer(e.target.value)} placeholder="Ex: 48, 60" className={monoInputClass} />
                                </div>
                              </div>
                              {consumerMonthlyPayment > 0 && (
                                <div className="rounded-xl border border-purple-200 bg-purple-50/50 dark:border-purple-900/30 dark:bg-purple-950/10 p-3 space-y-1.5">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">💰 Mensualité calculée</span>
                                    <span className="font-mono font-semibold">{formatAmount(consumerMonthlyPayment, debtCurrency)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">📊 Coût total</span>
                                    <span className="font-mono font-medium">{formatAmount(consumerMonthlyPayment * (parseInt(durationMonthsConsumer) || 0), debtCurrency)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">📉 Total intérêts</span>
                                    <span className="font-mono font-medium text-destructive">{formatAmount(consumerMonthlyPayment * (parseInt(durationMonthsConsumer) || 0) - (parseFloat(initialAmount) || 0), debtCurrency)}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* Revolving */}
                          {consumerType === 'revolving' && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Plafond autorisé</label>
                                  <MoneyInput value={creditLimit} onChange={setCreditLimit} className={monoInputClass} />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Solde utilisé actuel</label>
                                  <MoneyInput value={currentBalance} onChange={setCurrentBalance} className={monoInputClass} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Taux (TAEG %)</label>
                                  <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} className={monoInputClass} />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Mensualité minimum</label>
                                  <MoneyInput value={minimumPayment} onChange={setMinimumPayment} className={monoInputClass} />
                                </div>
                              </div>
                              {parseFloat(currentBalance) > 0 && parseFloat(creditLimit) > 0 && (
                                <div className="rounded-xl border border-purple-200 bg-purple-50/50 dark:border-purple-900/30 dark:bg-purple-950/10 p-3 space-y-1.5">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">📊 Utilisation</span>
                                    <span className="font-mono font-semibold">{Math.round((parseFloat(currentBalance) / parseFloat(creditLimit)) * 100)}%</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">💰 Disponible</span>
                                    <span className="font-mono font-medium">{formatAmount((parseFloat(creditLimit) || 0) - (parseFloat(currentBalance) || 0), debtCurrency)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">⚠️ Intérêts estimés/mois</span>
                                    <span className="font-mono font-medium text-destructive">{formatAmount(((parseFloat(currentBalance) || 0) * (parseFloat(interestRate) || 0) / 100) / 12, debtCurrency)}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* Purchase */}
                          {consumerType === 'purchase' && (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Prix d'achat</label>
                                <MoneyInput value={purchasePrice} onChange={setPurchasePrice} className={monoInputClass} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Acompte versé <span className="text-muted-foreground">(optionnel)</span></label>
                                <MoneyInput value={downPayment} onChange={setDownPayment} className={monoInputClass} />
                              </div>
                              <div className="bg-muted/50 rounded-xl p-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Montant financé</span>
                                  <span className="font-mono font-semibold">{formatAmount(consumerLoanAmount, debtCurrency)}</span>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Reste à payer</label>
                                <MoneyInput value={remainingAmount} onChange={setRemainingAmount} className={monoInputClass} />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Taux d'intérêt (%)</label>
                                  <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="0 = sans frais" className={monoInputClass} />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1.5">Nb mensualités</label>
                                  <input type="number" step="1" value={durationMonthsConsumer} onChange={e => setDurationMonthsConsumer(e.target.value)} placeholder="Ex: 12" className={monoInputClass} />
                                </div>
                              </div>
                              {consumerMonthlyPayment > 0 && (
                                <div className="rounded-xl border border-purple-200 bg-purple-50/50 dark:border-purple-900/30 dark:bg-purple-950/10 p-3 space-y-1.5">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">💰 Mensualité</span>
                                    <span className="font-mono font-semibold">{formatAmount(consumerMonthlyPayment, debtCurrency)}</span>
                                  </div>
                                  {(parseFloat(interestRate) || 0) === 0 && (
                                    <div className="text-[10px] text-success font-medium">✅ Sans frais (0%)</div>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {/* Start date */}
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Date de début</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className={`${inputClass} text-left`}>{format(startDate, 'dd MMMM yyyy', { locale: fr })}</button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="p-3 pointer-events-auto" />
                              </PopoverContent>
                            </Popover>
                          </div>

                          {consumerType !== 'revolving' && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Jour de prélèvement</label>
                                <input type="number" min="1" max="31" value={endOfMonth ? '' : paymentDay} disabled={endOfMonth}
                                  onChange={e => setPaymentDay(e.target.value)} className={`${monoInputClass} disabled:opacity-50`} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">1ère échéance</label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className={`${inputClass} text-left`}>{format(nextPaymentDate, 'dd MMM yyyy', { locale: fr })}</button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={nextPaymentDate} onSelect={d => d && setNextPaymentDate(d)} className="p-3 pointer-events-auto" />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          )}

                          {/* Account & Category */}
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Compte de prélèvement</label>
                            <select value={accountId} onChange={e => handleAccountChange(e.target.value)} className={inputClass}>
                              <option value="">Aucun</option>
                              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Catégorie de dépense</label>
                            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass}>
                              <option value="">Aucune</option>
                              {allExpenseCategories.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || '📌'} {c}</option>)}
                            </select>
                          </div>
                        </>
                      )}

                      {/* ===== STUDENT FORM ===== */}
                      {isStudent && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Intitulé</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Prêt études HEC" className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Organisme <span className="text-muted-foreground">(optionnel)</span></label>
                            <input value={lender} onChange={e => setLender(e.target.value)} placeholder="Ex: UBS, Crédit Agricole" className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Devise</label>
                            <select value={debtCurrency} onChange={e => { setDebtCurrency(e.target.value); setAccountId(''); }} disabled={!!accountId} className={inputClass}>
                              {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} — {c}</option>)}
                            </select>
                            {accountId && <p className="text-xs text-muted-foreground mt-1">Devise liée au compte sélectionné</p>}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Montant emprunté</label>
                              <MoneyInput value={initialAmount} onChange={setInitialAmount} className={monoInputClass} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Capital restant dû</label>
                              <MoneyInput value={remainingAmount} onChange={setRemainingAmount} className={monoInputClass} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Taux d'intérêt (%)</label>
                              <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} className={monoInputClass} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Durée remboursement (mois)</label>
                              <input type="number" step="1" value={durationMonthsConsumer} onChange={e => setDurationMonthsConsumer(e.target.value)} placeholder="Ex: 60" className={monoInputClass} />
                            </div>
                          </div>

                          {/* Deferral */}
                          <label className="flex items-center gap-3 cursor-pointer py-2">
                            <input type="checkbox" checked={hasDeferral} onChange={e => setHasDeferral(e.target.checked)} className="rounded border-border" />
                            <div>
                              <span className="text-sm font-medium">Différé de remboursement</span>
                              <p className="text-[10px] text-muted-foreground">Tu ne rembourses pas encore le capital</p>
                            </div>
                          </label>
                          {hasDeferral && (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Type de différé</label>
                                <div className="flex gap-2">
                                  <button onClick={() => setDeferralType('total')}
                                    className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-all ${deferralType === 'total' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                                    Total
                                  </button>
                                  <button onClick={() => setDeferralType('partial')}
                                    className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-all ${deferralType === 'partial' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                                    Partiel (intérêts payés)
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Fin du différé</label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className={`${inputClass} text-left`}>
                                      {deferralEndDate ? format(deferralEndDate, 'dd MMMM yyyy', { locale: fr }) : 'Choisir une date'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={deferralEndDate || undefined} onSelect={d => setDeferralEndDate(d || null)} className="p-3 pointer-events-auto" />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </>
                          )}

                          {consumerMonthlyPayment > 0 && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10 p-3 space-y-1.5">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">💰 Mensualité calculée</span>
                                <span className="font-mono font-semibold">{formatAmount(consumerMonthlyPayment, debtCurrency)}</span>
                              </div>
                              {hasDeferral && deferralEndDate && (
                                <div className="text-[10px] text-muted-foreground">
                                  ⏳ Début remboursement : {format(deferralEndDate, 'MMMM yyyy', { locale: fr })}
                                </div>
                              )}
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-1.5">Notes <span className="text-muted-foreground">(optionnel)</span></label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Informations complémentaires..." 
                              className={`${inputClass} min-h-[60px]`} />
                          </div>

                          {/* Start date + payment day */}
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Date de début</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className={`${inputClass} text-left`}>{format(startDate, 'dd MMMM yyyy', { locale: fr })}</button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="p-3 pointer-events-auto" />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Jour de prélèvement</label>
                              <input type="number" min="1" max="31" value={paymentDay} onChange={e => setPaymentDay(e.target.value)} className={monoInputClass} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">1ère échéance</label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className={`${inputClass} text-left`}>{format(nextPaymentDate, 'dd MMM yyyy', { locale: fr })}</button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={nextPaymentDate} onSelect={d => d && setNextPaymentDate(d)} className="p-3 pointer-events-auto" />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1.5">Compte de prélèvement</label>
                            <select value={accountId} onChange={e => handleAccountChange(e.target.value)} className={inputClass}>
                              <option value="">Aucun</option>
                              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Catégorie de dépense</label>
                            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass}>
                              <option value="">Aucune</option>
                              {allExpenseCategories.map(c => <option key={c} value={c}>{CATEGORY_EMOJIS[c] || '📌'} {c}</option>)}
                            </select>
                          </div>
                        </>
                      )}

                      {/* ===== OTHER DEBT FORM ===== */}
                      {isOther && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Description</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Prêt parents, avance employeur" className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Créancier <span className="text-muted-foreground">(optionnel)</span></label>
                            <input value={lender} onChange={e => setLender(e.target.value)} placeholder="Ex: Famille, MonEntreprise SA" className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1.5">Devise</label>
                            <select value={debtCurrency} onChange={e => { setDebtCurrency(e.target.value); setAccountId(''); }} disabled={!!accountId} className={inputClass}>
                              {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} — {c}</option>)}
                            </select>
                            {accountId && <p className="text-xs text-muted-foreground mt-1">Devise liée au compte sélectionné</p>}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Montant initial</label>
                              <MoneyInput value={initialAmount} onChange={setInitialAmount} className={monoInputClass} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Reste à rembourser</label>
                              <MoneyInput value={remainingAmount} onChange={setRemainingAmount} className={monoInputClass} />
                            </div>
                          </div>

                          <label className="flex items-center gap-3 cursor-pointer py-1">
                            <input type="checkbox" checked={hasInterest} onChange={e => setHasInterest(e.target.checked)} className="rounded border-border" />
                            <span className="text-sm font-medium">Avec intérêts</span>
                          </label>
                          {hasInterest && (
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Taux d'intérêt (%)</label>
                              <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} className={monoInputClass} />
                            </div>
                          )}

                          <label className="flex items-center gap-3 cursor-pointer py-1">
                            <input type="checkbox" checked={hasSchedule} onChange={e => setHasSchedule(e.target.checked)} className="rounded border-border" />
                            <span className="text-sm font-medium">Échéancier défini</span>
                          </label>
                          {hasSchedule && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Mensualité</label>
                                <MoneyInput value={paymentAmount} onChange={setPaymentAmount} className={monoInputClass} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Durée (années)</label>
                                <input type="number" step="1" value={durationYears} onChange={e => setDurationYears(e.target.value)} className={monoInputClass} />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-1.5">Notes <span className="text-muted-foreground">(optionnel)</span></label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Retenue 200 CHF/mois sur salaire" 
                              className={`${inputClass} min-h-[60px]`} />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1.5">Date de début</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className={`${inputClass} text-left`}>{format(startDate, 'dd MMMM yyyy', { locale: fr })}</button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="p-3 pointer-events-auto" />
                              </PopoverContent>
                            </Popover>
                          </div>

                          {hasSchedule && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Jour de prélèvement</label>
                                <input type="number" min="1" max="31" value={paymentDay} onChange={e => setPaymentDay(e.target.value)} className={monoInputClass} />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">1ère échéance</label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className={`${inputClass} text-left`}>{format(nextPaymentDate, 'dd MMM yyyy', { locale: fr })}</button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={nextPaymentDate} onSelect={d => d && setNextPaymentDate(d)} className="p-3 pointer-events-auto" />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-1.5">Compte de prélèvement</label>
                            <select value={accountId} onChange={e => handleAccountChange(e.target.value)} className={inputClass}>
                              <option value="">Aucun</option>
                              {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                            </select>
                          </div>
                        </>
                      )}

                      {/* ===== MORTGAGE FORMS (existing) ===== */}
                      {isMortgage && (
                        <>
                      {/* Name */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Nom du bien</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Appartement Lausanne"
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
                        <select value={debtCurrency} onChange={e => { setDebtCurrency(e.target.value); setAccountId(''); }} disabled={!!accountId} className={inputClass}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || c} — {c}</option>)}
                        </select>
                        {accountId && <p className="text-xs text-muted-foreground mt-1">Devise liée au compte sélectionné</p>}
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

                      {/* Europe: Duration + payment */}
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

                      {/* Swiss: Amortization */}
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

                      {/* Mortgage: Frequency + Day */}
                      {isMortgage && (
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
                        <select value={accountId} onChange={e => handleAccountChange(e.target.value)} className={inputClass}>
                          <option value="">Aucun</option>
                          {activeAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
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
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Submit */}
              {step === 'form' && (
                <div className="mt-6 flex gap-3">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                  <button onClick={handleSubmit}
                    disabled={saving || (isVehicle ? !canSubmitVehicle() : isConsumer ? !canSubmitConsumer() : isStudent ? !canSubmitStudent() : isOther ? !canSubmitOther() : (!name.trim() || !initialAmount || !remainingAmount || (!isMortgage && !paymentAmount) || (isEurope && (!paymentAmount || !durationYears))))}
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
