import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '@/components/Layout';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateLong, formatAmount as formatAmountWithCurrency } from '@/utils/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { Debt, DEBT_TYPES, getDebtEmoji, getPeriodsPerYear, calculateNextPaymentDate, PaymentFrequency } from '@/types/debt';
import { DEFAULT_EXCHANGE_RATES } from '@/types/finance';
import { DebtIcon } from '@/utils/categoryIcons';

const getFrequencySuffix = (freq: string) => {
  switch (freq) { case 'quarterly': return '/trim.'; case 'semi-annual': return '/sem.'; case 'annual': return '/an'; default: return '/mois'; }
};
const getFrequencyLabel = (freq: string) => {
  switch (freq) { case 'quarterly': return 'ce trimestre'; case 'semi-annual': return 'ce semestre'; case 'annual': return 'cette année'; default: return 'ce mois'; }
};
import AddDebtModal from '@/components/AddDebtModal';
import DebtDetailModal from '@/components/DebtDetailModal';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumGate } from '@/components/PremiumPaywall';
import { CreditCard, Plus, ArrowLeft, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';

interface UpcomingPayment {
  id: string;
  debt_id: string;
  due_date: string;
  period_number: number;
  capital_before: number;
  capital_after: number;
  interest_amount: number;
  principal_amount: number;
  total_amount: number;
  status: string;
  debtName: string;
  debtEmoji: string;
  debtType: string;
  debtCurrency: string;
  debtFrequency: string;
}

const Debts = () => {
  const { householdId, session, household, financeScope, refreshDebtSchedules } = useApp();
  const { formatAmount, currency: mainCurrency } = useCurrency();
  const convert = useCallback((amount: number, fromCurrency: string) => {
    if (fromCurrency === mainCurrency) return amount;
    const fromToEur = DEFAULT_EXCHANGE_RATES[fromCurrency] || 1;
    const mainToEur = DEFAULT_EXCHANGE_RATES[mainCurrency] || 1;
    return amount * (fromToEur / mainToEur);
  }, [mainCurrency]);
  const { canAdd } = useSubscription(householdId, session?.user?.id);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showPaymentBreakdown, setShowPaymentBreakdown] = useState(false);

  const fetchDebts = useCallback(async () => {
    if (!householdId) return;
    const userId = session?.user?.id;
    let query = supabase.from('debts').select('*');
    if (financeScope === 'personal') {
      query = query.eq('scope', 'personal').eq('created_by', userId);
    } else {
      query = query.eq('household_id', householdId).eq('scope', 'household');
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (data) {
      setDebts(data.map((d: any) => ({
        id: d.id, householdId: d.household_id, type: d.type, name: d.name, lender: d.lender || undefined,
        initialAmount: Number(d.initial_amount), remainingAmount: Number(d.remaining_amount),
        currency: d.currency, interestRate: Number(d.interest_rate), durationYears: Number(d.duration_years),
        startDate: d.start_date, paymentFrequency: d.payment_frequency, paymentDay: d.payment_day,
        paymentAmount: Number(d.payment_amount), categoryId: d.category_id || undefined,
        nextPaymentDate: d.next_payment_date || undefined, lastPaymentDate: d.last_payment_date || undefined,
        createdAt: d.created_at, updatedAt: d.updated_at,
        scope: d.scope || 'household', createdBy: d.created_by || undefined,
        amortizationType: d.amortization_type || 'fixed_annuity',
        accountId: d.account_id || undefined,
        mortgageSystem: d.mortgage_system || undefined,
        rateType: d.rate_type || 'fixed',
        rateEndDate: d.rate_end_date || undefined,
        propertyValue: d.property_value ? Number(d.property_value) : undefined,
        annualAmortization: d.annual_amortization ? Number(d.annual_amortization) : undefined,
        swissAmortizationType: d.swiss_amortization_type || undefined,
        includeMaintenance: d.include_maintenance || false,
        // Vehicle fields
        vehicleType: d.vehicle_type || undefined,
        vehicleName: d.vehicle_name || undefined,
        vehiclePrice: d.vehicle_price ? Number(d.vehicle_price) : undefined,
        downPayment: d.down_payment ? Number(d.down_payment) : undefined,
        annualKm: d.annual_km ? Number(d.annual_km) : undefined,
        residualValue: d.residual_value ? Number(d.residual_value) : undefined,
        excessKmCost: d.excess_km_cost ? Number(d.excess_km_cost) : undefined,
        servicesIncluded: d.services_included || undefined,
        contractEndDate: d.contract_end_date || undefined,
        currentKm: d.current_km ? Number(d.current_km) : undefined,
        // Consumer fields
        consumerType: d.consumer_type || undefined,
        creditLimit: d.credit_limit ? Number(d.credit_limit) : undefined,
        currentBalance: d.current_balance ? Number(d.current_balance) : undefined,
        minimumPayment: d.minimum_payment ? Number(d.minimum_payment) : undefined,
        purchasePrice: d.purchase_price ? Number(d.purchase_price) : undefined,
        // Student fields
        hasDeferral: d.has_deferral || false,
        deferralEndDate: d.deferral_end_date || undefined,
        deferralType: d.deferral_type || undefined,
        // Other fields
        hasInterest: d.has_interest !== false,
        hasSchedule: d.has_schedule !== false,
        notes: d.notes || undefined,
      })));
    }
    if (error) console.error('Fetch debts error:', error);
    setLoading(false);
  }, [householdId, financeScope, session?.user?.id]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  // Fetch upcoming schedules for all debts (next 2 years)
  const fetchUpcomingPayments = useCallback(async () => {
    if (!householdId || debts.length === 0) { setUpcomingPayments([]); return; }
    // Start from the 1st of current month to include all this month's schedules
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const twoYearsLater = new Date();
    twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);
    const maxDate = twoYearsLater.toISOString().split('T')[0];

    const debtIds = debts.map(d => d.id);
    const { data, error } = await supabase
      .from('debt_schedules')
      .select('*')
      .in('debt_id', debtIds)
      .in('status', ['prevu', 'ajuste'])
      .gte('due_date', monthStart)
      .lte('due_date', maxDate)
      .order('due_date', { ascending: true });

    if (data) {
      const debtMap = new Map(debts.map(d => [d.id, d]));
      setUpcomingPayments(data.map((r: any) => {
        const debt = debtMap.get(r.debt_id);
        return {
          id: r.id,
          debt_id: r.debt_id,
          due_date: r.due_date,
          period_number: r.period_number,
          capital_before: Number(r.capital_before),
          capital_after: Number(r.capital_after),
          interest_amount: Number(r.interest_amount),
          principal_amount: Number(r.principal_amount),
          total_amount: Number(r.total_amount),
          status: r.status,
          debtName: debt?.name || '',
          debtEmoji: debt ? getDebtEmoji(debt.type) : '💳',
          debtType: debt?.type || '',
          debtCurrency: debt?.currency || 'EUR',
          debtFrequency: debt?.paymentFrequency || 'monthly',
        };
      }));
    }
    if (error) console.error('Fetch upcoming error:', error);
  }, [householdId, debts]);

  useEffect(() => { fetchUpcomingPayments(); }, [fetchUpcomingPayments]);

  // Compute real remaining per debt + next payment row from schedule
  const debtNextPaymentMap = useMemo(() => {
    const map = new Map<string, UpcomingPayment>();
    for (const d of debts) {
      const firstUpcoming = upcomingPayments.find(p => p.debt_id === d.id);
      if (firstUpcoming) map.set(d.id, firstUpcoming);
    }
    return map;
  }, [debts, upcomingPayments]);

  const debtRemainingMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of debts) {
      const firstUpcoming = debtNextPaymentMap.get(d.id);
      map.set(d.id, firstUpcoming ? firstUpcoming.capital_before : d.remainingAmount);
    }
    return map;
  }, [debts, debtNextPaymentMap]);

  const getRealRemaining = (d: Debt) => debtRemainingMap.get(d.id) ?? d.remainingAmount;

  // Filter debts that match current scope (safety: debts should already be filtered, but ensure upcoming payments match)
  const scopeFilteredDebts = useMemo(() => {
    if (financeScope === 'personal') {
      return debts.filter(d => d.scope === 'personal' && d.createdBy === session?.user?.id);
    }
    return debts.filter(d => d.scope === 'household');
  }, [debts, financeScope, session?.user?.id]);

  const totalRemaining = useMemo(() => scopeFilteredDebts.reduce((s, d) => s + convert(getRealRemaining(d), d.currency), 0), [scopeFilteredDebts, debtRemainingMap, convert]);
  const totalInitial = useMemo(() => scopeFilteredDebts.reduce((s, d) => s + convert(d.initialAmount, d.currency), 0), [scopeFilteredDebts, convert]);
  // Compute actual payments due THIS month from schedules
  const currentMonthPayments = useMemo(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return upcomingPayments.filter(p => p.due_date >= monthStart && p.due_date <= monthEnd);
  }, [upcomingPayments]);

  const totalPayment = useMemo(() => {
    return currentMonthPayments.reduce((s, p) => s + convert(p.total_amount, p.debtCurrency), 0);
  }, [currentMonthPayments, convert]);

  // Per-debt breakdown for current month
  const paymentBreakdownList = useMemo(() => {
    const map = new Map<string, { name: string; emoji: string; debtType: string; monthlyAmount: number }>();
    for (const p of currentMonthPayments) {
      const existing = map.get(p.debt_id);
      const amount = convert(p.total_amount, p.debtCurrency);
      if (existing) {
        existing.monthlyAmount += amount;
      } else {
        map.set(p.debt_id, { name: p.debtName, emoji: p.debtEmoji, debtType: p.debtType, monthlyAmount: amount });
      }
    }
    return Array.from(map.values()).filter(item => item.monthlyAmount > 0).sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  }, [currentMonthPayments, convert]);

  const totalRepaid = useMemo(() => scopeFilteredDebts.reduce((s, d) => s + convert(d.initialAmount - getRealRemaining(d), d.currency), 0), [scopeFilteredDebts, debtRemainingMap, convert]);

  const selectedDebt = useMemo(() => debts.find(d => d.id === selectedDebtId) || null, [debts, selectedDebtId]);

  const handleDebtAdded = async () => { await fetchDebts(); await refreshDebtSchedules(); setShowAdd(false); };
  const handleDebtUpdated = async () => { await fetchDebts(); await refreshDebtSchedules(); setSelectedDebtId(null); };

  const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><span className="text-2xl">⏳</span></div></Layout>;
  }

  // If a debt is selected, show detail view
  if (selectedDebt) {
    return (
      <Layout>
        <PremiumGate feature="les dettes & crédits" description="Gérez tous vos crédits, prêts et dettes avec un suivi détaillé des remboursements.">
          <DebtDetailModal
            debt={selectedDebt}
            onClose={() => setSelectedDebtId(null)}
            onUpdated={handleDebtUpdated}
          />
        </PremiumGate>
      </Layout>
    );
  }

  return (
    <Layout>
      <PremiumGate feature="les dettes & crédits" description="Gérez tous vos crédits, prêts et dettes avec un suivi détaillé des remboursements.">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 via-transparent to-transparent h-64" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="relative space-y-5">
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Dettes & Crédits</h1>
          <button onClick={() => setShowAdd(true)} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </motion.div>

        {/* Summary */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Capital emprunté</p>
            <p className="font-mono-amount font-semibold text-sm">{formatAmount(totalInitial)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Capital restant dû</p>
            <p className="font-mono-amount font-semibold text-destructive text-sm">{formatAmount(totalRemaining)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <div
              className="cursor-pointer"
              onClick={() => setShowPaymentBreakdown(!showPaymentBreakdown)}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <p className="text-[11px] text-muted-foreground">Échéances du mois</p>
                {showPaymentBreakdown ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
              </div>
              <p className="font-mono-amount font-semibold text-sm">{formatAmount(totalPayment)}</p>
            </div>
            <AnimatePresence>
              {showPaymentBreakdown && paymentBreakdownList.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border mt-2 pt-2 space-y-1 text-left">
                    {paymentBreakdownList.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span className="truncate text-muted-foreground flex items-center gap-1"><DebtIcon type={item.debtType || ''} size="sm" /> {item.name}</span>
                        <span className="font-mono-amount font-medium shrink-0 ml-2">{formatAmount(item.monthlyAmount)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground mb-1">Total remboursé</p>
            <p className="font-mono-amount font-semibold text-success text-sm">{formatAmount(totalRepaid)}</p>
          </div>
        </motion.div>

        {/* Debt list */}
        {debts.length === 0 ? (
          <motion.div variants={fadeUp} className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
            Aucune dette enregistrée. Ajoutez votre premier crédit !
          </motion.div>
        ) : (
          <motion.div variants={fadeUp} className="space-y-2">
            {debts.map(d => {
              const remaining = getRealRemaining(d);
              const repaidPct = d.initialAmount > 0 ? Math.min(((d.initialAmount - remaining) / d.initialAmount) * 100, 100) : 0;
              const nextRow = debtNextPaymentMap.get(d.id);
              const nextDate = nextRow ? nextRow.due_date : (d.nextPaymentDate || calculateNextPaymentDate(d));
              const ppy = getPeriodsPerYear(d.paymentFrequency as PaymentFrequency);
              const freqSuffix = getFrequencySuffix(d.paymentFrequency);
              const freqAdj = d.paymentFrequency === 'monthly' ? 'mensuelle' : d.paymentFrequency === 'quarterly' ? 'trimestrielle' : d.paymentFrequency === 'semi-annual' ? 'semestrielle' : 'annuelle';

              const isVehicle = !!d.vehicleType;
              const vehicleTypeEmoji = d.vehicleType === 'credit' ? '💰' : d.vehicleType === 'leasing' ? '🔄' : d.vehicleType === 'lld' ? '📋' : '';
              const vehicleTypeLabel = d.vehicleType === 'credit' ? 'Crédit auto' : d.vehicleType === 'leasing' ? 'Leasing (LOA)' : d.vehicleType === 'lld' ? 'LLD' : '';

              const isConsumer = d.type === 'consumer';
              const isStudent = d.type === 'student';
              const isOther = d.type === 'other';
              const consumerTypeEmoji = d.consumerType === 'personal' ? '💰' : d.consumerType === 'revolving' ? '🔄' : d.consumerType === 'purchase' ? '🛒' : '';
              const consumerTypeLabel = d.consumerType === 'personal' ? 'Prêt personnel' : d.consumerType === 'revolving' ? 'Crédit revolving' : d.consumerType === 'purchase' ? 'Achat à crédit' : '';
              const isRevolving = d.consumerType === 'revolving';
              const isInDeferral = isStudent && d.hasDeferral && d.deferralEndDate && new Date(d.deferralEndDate) > new Date();

              // Use schedule row if available
              const displayTotal = nextRow ? nextRow.total_amount : 
                d.mortgageSystem === 'swiss' ? (
                  (remaining * d.interestRate / 100 / ppy) +
                  (d.swissAmortizationType !== 'none' && d.annualAmortization ? d.annualAmortization / ppy : 0) +
                  (d.includeMaintenance && d.propertyValue ? d.propertyValue * 0.01 / ppy : 0)
                ) : d.paymentAmount;
              const displayInterest = nextRow ? nextRow.interest_amount : remaining * d.interestRate / 100 / ppy;
              const displayCapital = nextRow ? nextRow.principal_amount : 
                d.mortgageSystem === 'swiss' ? (d.annualAmortization ? d.annualAmortization / ppy : 0) : 
                Math.max(d.paymentAmount - displayInterest, 0);
              const displayMaintenance = d.includeMaintenance && d.propertyValue ? d.propertyValue * 0.01 / ppy : 0;

              // Vehicle contract progress
              const vehicleContractMonths = isVehicle ? Math.round(d.durationYears * 12) : 0;
              const vehicleElapsedMonths = isVehicle ? (() => {
                const start = new Date(d.startDate);
                const now = new Date();
                return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
              })() : 0;
              const vehicleContractPct = vehicleContractMonths > 0 ? Math.min((vehicleElapsedMonths / vehicleContractMonths) * 100, 100) : 0;
              const vehicleTotalKm = isVehicle && d.annualKm ? d.annualKm * d.durationYears : 0;
              const vehicleKmPct = vehicleTotalKm > 0 && d.currentKm ? Math.min((d.currentKm / vehicleTotalKm) * 100, 100) : 0;

              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDebtId(d.id)}
                  className={`bg-card border rounded-xl p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    d.mortgageSystem === 'swiss' ? 'border-red-200 dark:border-red-900/30' :
                    d.mortgageSystem === 'europe' ? 'border-blue-200 dark:border-blue-900/30' :
                    isVehicle ? 'border-amber-200 dark:border-amber-900/30' :
                    isRevolving ? 'border-orange-200 dark:border-orange-900/30' :
                    isConsumer ? 'border-purple-200 dark:border-purple-900/30' :
                    isStudent ? 'border-indigo-200 dark:border-indigo-900/30' :
                    'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DebtIcon type={d.type} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm">{d.vehicleName || d.name}</p>
                          {d.mortgageSystem === 'swiss' && <span className="text-xs">🇨🇭</span>}
                          {d.mortgageSystem === 'europe' && <span className="text-xs">🇪🇺</span>}
                          {isVehicle && <span className="text-xs">{vehicleTypeEmoji}</span>}
                          {isConsumer && <span className="text-xs">{consumerTypeEmoji}</span>}
                          {d.interestRate === 0 && (isConsumer || isOther) && <span className="text-[9px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">Sans frais</span>}
                          {isRevolving && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Revolving</span>}
                          {isInDeferral && <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">⏳ En différé</span>}
                          {d.interestRate > 10 && <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">⚠️ Taux élevé</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {isVehicle ? `${d.lender ? d.lender + ' · ' : ''}${vehicleTypeLabel}` :
                           isConsumer ? `${d.lender ? d.lender + ' · ' : ''}${consumerTypeLabel}` :
                           isStudent ? `${d.lender ? d.lender + ' · ' : ''}Prêt étudiant` :
                           isOther ? `${d.lender ? d.lender + ' · ' : ''}${d.hasInterest === false ? 'Sans intérêts' : `${d.interestRate}%`}` :
                           d.lender ? `${d.lender} · ${d.rateType === 'fixed' ? 'Taux fixe' : 'Taux variable'} ${d.interestRate}%` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-amount text-sm font-semibold">
                        {isRevolving
                          ? formatAmountWithCurrency(d.currentBalance || 0, d.currency)
                          : isInDeferral
                          ? (d.deferralType === 'partial' ? formatAmountWithCurrency(remaining * d.interestRate / 100 / 12, d.currency) + '/mois' : '—')
                          : formatAmountWithCurrency(d.mortgageSystem === 'swiss' ? displayTotal + displayMaintenance : displayTotal, d.currency) + freqSuffix}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {isRevolving ? 'Solde utilisé' :
                         isInDeferral ? (d.deferralType === 'partial' ? 'Intérêts seuls' : 'En différé') :
                         isVehicle ? (d.vehicleType === 'credit' ? 'Mensualité' : 'Loyer mensuel') :
                         d.mortgageSystem ? `Charge ${freqAdj}` : `${d.interestRate}% · ${d.currency}`}
                      </p>
                    </div>
                  </div>
                  
                  {/* Swiss: breakdown */}
                  {d.mortgageSystem === 'swiss' && (
                    <div className="text-[10px] text-muted-foreground mb-2 space-y-0.5">
                      <div className="flex justify-between">
                        <span>├ Intérêts</span>
                        <span className="font-mono-amount">{formatAmountWithCurrency(displayInterest, d.currency)}</span>
                      </div>
                      {d.swissAmortizationType !== 'none' && displayCapital > 0 && (
                        <div className="flex justify-between">
                          <span>├ Amortissement</span>
                          <span className="font-mono-amount">{formatAmountWithCurrency(displayCapital, d.currency)}</span>
                        </div>
                      )}
                      {d.includeMaintenance && displayMaintenance > 0 && (
                        <div className="flex justify-between">
                          <span>└ Frais entretien</span>
                          <span className="font-mono-amount">{formatAmountWithCurrency(displayMaintenance, d.currency)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Europe: breakdown */}
                  {d.mortgageSystem === 'europe' && (
                    <div className="text-[10px] text-muted-foreground mb-2 space-y-0.5">
                      <div className="flex justify-between">
                        <span>├ Intérêts {getFrequencyLabel(d.paymentFrequency)}</span>
                        <span className="font-mono-amount">{formatAmountWithCurrency(displayInterest, d.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>└ Capital {getFrequencyLabel(d.paymentFrequency)}</span>
                        <span className="font-mono-amount">{formatAmountWithCurrency(displayCapital, d.currency)}</span>
                      </div>
                    </div>
                  )}

                  {/* Vehicle: contract progress bar */}
                  {isVehicle && (d.vehicleType === 'leasing' || d.vehicleType === 'lld') ? (
                    <>
                      <div className="mb-1.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Contrat</span>
                          <span>{vehicleElapsedMonths}/{vehicleContractMonths} mois</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${vehicleContractPct >= 90 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${vehicleContractPct}%` }} />
                        </div>
                      </div>
                      {d.annualKm && d.currentKm !== undefined && d.currentKm > 0 && (
                        <div className="mb-1.5">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                            <span>Kilométrage</span>
                            <span>{d.currentKm.toLocaleString('fr-FR')} / {vehicleTotalKm.toLocaleString('fr-FR')} km</span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${vehicleKmPct > 100 ? 'bg-destructive' : vehicleKmPct > 80 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(vehicleKmPct, 100)}%` }} />
                          </div>
                        </div>
                      )}
                      {d.vehicleType === 'leasing' && d.residualValue && (
                        <div className="text-[10px] text-muted-foreground">
                          💰 Valeur de rachat : {formatAmountWithCurrency(d.residualValue, d.currency)}
                        </div>
                      )}
                      {d.vehicleType === 'lld' && d.servicesIncluded && d.servicesIncluded.length > 0 && (
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1 mt-1">
                          {d.servicesIncluded.map((s: string) => {
                            const svcMap: Record<string, string> = { maintenance: '🔧', insurance: '🛡️', assistance: '📞', replacement: '🚗', winter_tires: '❄️', fuel_card: '⛽' };
                            return <span key={s}>{svcMap[s] || '✅'}</span>;
                          })}
                        </div>
                      )}
                      {d.contractEndDate && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          📅 {d.vehicleType === 'lld' ? 'Restitution' : 'Fin du contrat'} : {format(new Date(d.contractEndDate), 'MMMM yyyy', { locale: fr })}
                        </div>
                      )}
                    </>
                  ) : isVehicle && d.vehicleType === 'credit' ? (
                    <>
                      <div className="h-1 bg-muted rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full rounded-full transition-all ${repaidPct >= 100 ? 'bg-success' : repaidPct >= 50 ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${repaidPct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-mono-amount">{formatAmountWithCurrency(remaining, d.currency)} restant</span>
                        <span className="font-mono-amount">{Math.round(repaidPct)}% remboursé</span>
                      </div>
                      {d.contractEndDate && (
                        <div className="mt-1.5 text-[10px] text-muted-foreground">
                          📅 Fin du crédit : {format(new Date(d.contractEndDate), 'MMMM yyyy', { locale: fr })}
                        </div>
                      )}
                    </>
                  ) : isRevolving ? (
                    <>
                      {/* Revolving: utilization bar */}
                      {(() => {
                        const utilPct = d.creditLimit ? Math.min(((d.currentBalance || 0) / d.creditLimit) * 100, 100) : 0;
                        const available = (d.creditLimit || 0) - (d.currentBalance || 0);
                        const monthlyInterest = ((d.currentBalance || 0) * d.interestRate / 100) / 12;
                        return (
                          <>
                            <div className="h-1 bg-muted rounded-full overflow-hidden mb-1.5">
                              <div className={`h-full rounded-full transition-all ${utilPct > 80 ? 'bg-destructive' : utilPct > 50 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${utilPct}%` }} />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                              <span className="font-mono-amount">{Math.round(utilPct)}% du plafond</span>
                              <span className="font-mono-amount">Dispo : {formatAmountWithCurrency(available, d.currency)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>Plafond : {formatAmountWithCurrency(d.creditLimit || 0, d.currency)}</span>
                              <span>Min. : {formatAmountWithCurrency(d.minimumPayment || 0, d.currency)}/mois</span>
                            </div>
                            {monthlyInterest > 0 && (
                              <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                ⚠️ Intérêts estimés ce mois : {formatAmountWithCurrency(monthlyInterest, d.currency)}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : isInDeferral ? (
                    <>
                      {/* Student in deferral */}
                      {(() => {
                        const deferEnd = new Date(d.deferralEndDate!);
                        const now = new Date();
                        const monthsLeft = Math.max(0, (deferEnd.getFullYear() - now.getFullYear()) * 12 + (deferEnd.getMonth() - now.getMonth()));
                        return (
                          <>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 mb-1.5 text-center">
                              <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">🎓 EN PÉRIODE DE DIFFÉRÉ</p>
                            </div>
                            <div className="text-[10px] text-muted-foreground space-y-0.5">
                              <div className="flex justify-between">
                                <span>Montant emprunté</span>
                                <span className="font-mono-amount">{formatAmountWithCurrency(d.initialAmount, d.currency)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Début remboursement</span>
                                <span>{format(deferEnd, 'MMMM yyyy', { locale: fr })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Mensualité prévue</span>
                                <span className="font-mono-amount">{formatAmountWithCurrency(d.paymentAmount, d.currency)}</span>
                              </div>
                            </div>
                            <div className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              ⏳ Différé restant : {monthsLeft} mois
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : isOther && d.hasSchedule === false ? (
                    <>
                      {/* Other without schedule */}
                      <div className="h-1 bg-muted rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full rounded-full transition-all ${repaidPct >= 50 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${repaidPct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-mono-amount">{formatAmountWithCurrency(remaining, d.currency)} restant</span>
                        <span className="font-mono-amount">{Math.round(repaidPct)}% remboursé</span>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        💡 Pas d'échéancier fixe
                      </div>
                      {d.notes && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          📝 "{d.notes}"
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="h-1 bg-muted rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full rounded-full transition-all ${repaidPct >= 100 ? 'bg-success' : repaidPct >= 50 ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${repaidPct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-mono-amount">{formatAmountWithCurrency(remaining, d.currency)} restant / {formatAmountWithCurrency(d.initialAmount, d.currency)}</span>
                        <span className="font-mono-amount">
                          {Math.round(repaidPct)}% remboursé
                          {d.mortgageSystem === 'swiss' && d.propertyValue ? ` · LTV ${Math.round((remaining / d.propertyValue) * 100)}%` : ''}
                        </span>
                      </div>
                      
                      {/* Rate renewal alert for Swiss */}
                      {d.mortgageSystem === 'swiss' && d.rateEndDate && (() => {
                        const endDate = new Date(d.rateEndDate!);
                        const now = new Date();
                        const monthsLeft = (endDate.getFullYear() - now.getFullYear()) * 12 + (endDate.getMonth() - now.getMonth());
                        if (monthsLeft <= 12 && monthsLeft > 0) {
                          const years = Math.floor(monthsLeft / 12);
                          const months = monthsLeft % 12;
                          return (
                            <div className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              ⚠️ Renouvellement taux dans {years > 0 ? `${years} an${years > 1 ? 's' : ''} ` : ''}{months} mois
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Europe: end date */}
                      {d.mortgageSystem === 'europe' && d.durationYears > 0 && (() => {
                        const startD = new Date(d.startDate);
                        const endD = new Date(startD);
                        endD.setFullYear(endD.getFullYear() + Math.floor(d.durationYears));
                        endD.setMonth(endD.getMonth() + Math.round((d.durationYears % 1) * 12));
                        const now = new Date();
                        const yearsLeft = Math.max(0, Math.round((endD.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000)));
                        return (
                          <div className="mt-1.5 text-[10px] text-muted-foreground">
                            📅 Fin du crédit : {format(endD, 'MMMM yyyy', { locale: fr })} ({yearsLeft} ans restants)
                          </div>
                        );
                      })()}

                      {d.propertyValue && d.propertyValue > 0 && (
                        <div className="mt-1.5 text-[10px] text-muted-foreground">
                          🏠 Valeur du bien : {formatAmountWithCurrency(d.propertyValue, d.currency)}
                        </div>
                      )}

                      {nextDate && (
                        <div className="mt-1.5 text-[10px] text-muted-foreground">
                          Prochaine échéance ({getFrequencySuffix(d.paymentFrequency).slice(1)}) : {formatDateLong(nextDate)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Upcoming payments - next 2 years */}
        {upcomingPayments.length > 0 && (
          <motion.div variants={fadeUp} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <div>
                  <h2 className="text-sm font-semibold">Prochaines échéances</h2>
                  <p className="text-[10px] text-muted-foreground">{upcomingPayments.length} échéances sur 2 ans</p>
                </div>
              </div>
              {upcomingPayments.length > 12 && (
                <button
                  onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                  className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                >
                  {showAllUpcoming ? 'Réduire' : 'Tout voir'}
                  {showAllUpcoming ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <div className="divide-y divide-border">
              {(showAllUpcoming ? upcomingPayments : upcomingPayments.slice(0, 12)).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedDebtId(p.debt_id)}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <DebtIcon type={p.debtType || ''} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{formatDateLong(p.due_date)}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {p.debtName} · Int. {formatAmountWithCurrency(p.interest_amount, p.debtCurrency)} · Cap. {formatAmountWithCurrency(p.principal_amount, p.debtCurrency)}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 font-mono-amount">
                        {formatAmountWithCurrency(p.capital_before, p.debtCurrency)} → {formatAmountWithCurrency(p.capital_after, p.debtCurrency)}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-amount text-sm font-semibold text-destructive shrink-0">
                    -{formatAmountWithCurrency(p.total_amount, p.debtCurrency)}
                  </span>
                </div>
              ))}
            </div>
            {!showAllUpcoming && upcomingPayments.length > 12 && (
              <div className="p-3 text-center border-t border-border">
                <button onClick={() => setShowAllUpcoming(true)} className="text-xs text-primary hover:text-primary/80 font-medium">
                  Voir les {upcomingPayments.length - 12} échéances restantes
                </button>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      <AddDebtModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={handleDebtAdded} />
      </PremiumGate>
    </Layout>
  );
};

export default Debts;
