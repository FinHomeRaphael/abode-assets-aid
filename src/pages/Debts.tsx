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
import { CreditCard, Plus, ArrowLeft, CalendarDays, ChevronDown, ChevronUp, TrendingDown, Landmark, CheckCircle, AlertTriangle, Clock, Shield, Fuel, Wrench, Phone, Car, Snowflake, Info, Percent } from 'lucide-react';

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
  const [showAssetBreakdown, setShowAssetBreakdown] = useState(false);

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

  // Asset values (property, vehicle, purchase)
  const assetBreakdownList = useMemo(() => {
    const list: { name: string; emoji: string; type: string; value: number }[] = [];
    for (const d of scopeFilteredDebts) {
      const assetValue = d.propertyValue || d.vehiclePrice || d.purchasePrice;
      if (assetValue && assetValue > 0) {
        list.push({
          name: d.vehicleName || d.name,
          emoji: getDebtEmoji(d.type),
          type: d.type,
          value: convert(assetValue, d.currency),
        });
      }
    }
    return list.sort((a, b) => b.value - a.value);
  }, [scopeFilteredDebts, convert]);

  const totalAssetValue = useMemo(() => assetBreakdownList.reduce((s, a) => s + a.value, 0), [assetBreakdownList]);

  const selectedDebt = useMemo(() => debts.find(d => d.id === selectedDebtId) || null, [debts, selectedDebtId]);

  const handleDebtAdded = async () => { await fetchDebts(); await refreshDebtSchedules(); setShowAdd(false); };
  const handleDebtUpdated = async (keepOpen = false) => { await fetchDebts(); await refreshDebtSchedules(); if (!keepOpen) setSelectedDebtId(null); };

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

        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Gestion</p>
            <h1 className="text-lg font-bold tracking-tight">Dettes & Crédits</h1>
          </div>
          <button onClick={() => setShowAdd(true)} className="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </motion.div>

        {/* Hero card — Total remaining */}
        <motion.div variants={fadeUp}>
          <div className="bg-primary p-6 shadow-lg shadow-primary/20 rounded-2xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-primary-foreground/70">Capital restant dû</span>
              <Landmark className="w-4 h-4 text-primary-foreground/50" />
            </div>
            <p className="text-4xl font-bold font-mono-amount tracking-tight text-primary-foreground">
              {formatAmount(totalRemaining)}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-1.5 bg-primary-foreground/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${totalInitial > 0 ? Math.min(((totalInitial - totalRemaining) / totalInitial) * 100, 100) : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-primary-foreground/60"
                />
              </div>
              <span className="text-xs text-primary-foreground/60 font-mono-amount">
                {totalInitial > 0 ? Math.round(((totalInitial - totalRemaining) / totalInitial) * 100) : 0}% remboursé
              </span>
            </div>
            {totalRepaid > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <CheckCircle className="w-3.5 h-3.5 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Déjà remboursé : {formatAmount(totalRepaid)}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-1.5">
          <div className="bg-card border border-border/30 rounded-xl p-3 text-center">
            <CreditCard className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
            <p className="text-[9px] text-muted-foreground mb-0.5">Emprunté</p>
            <p className="font-mono-amount font-bold text-foreground text-xs">{formatAmount(totalInitial)}</p>
            {totalAssetValue > 0 && (
              <p className="text-[9px] text-muted-foreground mt-0.5">{Math.round((totalInitial / totalAssetValue) * 100)}% de la valeur</p>
            )}
          </div>
          <div
            className="bg-card border border-border/30 rounded-xl p-3 text-center cursor-pointer"
            onClick={() => { setShowPaymentBreakdown(!showPaymentBreakdown); setShowAssetBreakdown(false); }}
          >
            <CalendarDays className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <p className="text-[9px] text-muted-foreground">Échéances/mois</p>
              {showPaymentBreakdown ? <ChevronUp className="w-2.5 h-2.5 text-muted-foreground" /> : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />}
            </div>
            <p className="font-mono-amount font-bold text-primary text-xs">{formatAmount(totalPayment)}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-xl p-3 text-center">
            <TrendingDown className="w-3.5 h-3.5 text-success mx-auto mb-1" />
            <p className="text-[9px] text-muted-foreground mb-0.5">Remboursé</p>
            <p className="font-mono-amount font-bold text-success text-xs">{formatAmount(totalRepaid)}</p>
          </div>
          {totalAssetValue > 0 && (
            <div
              className="bg-card border border-border/30 rounded-xl p-3 text-center cursor-pointer"
              onClick={() => { setShowAssetBreakdown(!showAssetBreakdown); setShowPaymentBreakdown(false); }}
            >
              <Shield className="w-3.5 h-3.5 text-accent-foreground mx-auto mb-1" />
              <div className="flex items-center justify-center gap-0.5 mb-0.5">
                <p className="text-[9px] text-muted-foreground">Valeur des biens</p>
                {showAssetBreakdown ? <ChevronUp className="w-2.5 h-2.5 text-muted-foreground" /> : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />}
              </div>
              <p className="font-mono-amount font-bold text-foreground text-xs">{formatAmount(totalAssetValue)}</p>
            </div>
          )}
        </motion.div>

        {/* Payment breakdown dropdown */}
        <AnimatePresence>
          {showPaymentBreakdown && paymentBreakdownList.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden -mt-3"
            >
              <div className="bg-card border border-border/30 rounded-2xl p-3 space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Détail des échéances du mois</p>
                {paymentBreakdownList.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                      <DebtIcon type={item.debtType || ''} size="sm" />
                      {item.name}
                    </span>
                    <span className="font-mono-amount text-xs font-semibold shrink-0 ml-2">{formatAmount(item.monthlyAmount)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Asset value breakdown dropdown */}
        <AnimatePresence>
          {showAssetBreakdown && assetBreakdownList.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden -mt-3"
            >
              <div className="bg-card border border-border/30 rounded-2xl p-3 space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Détail par bien</p>
                {assetBreakdownList.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                      <DebtIcon type={item.type || ''} size="sm" />
                      {item.name}
                    </span>
                    <span className="font-mono-amount text-xs font-semibold shrink-0 ml-2">{formatAmount(item.value)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Debt list — unified container */}
        {debts.length === 0 ? (
          <motion.div variants={fadeUp} className="bg-card border border-border/30 rounded-2xl p-8 text-center">
            <CreditCard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune dette enregistrée</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ajoutez votre premier crédit pour commencer le suivi</p>
          </motion.div>
        ) : (
          <motion.div variants={fadeUp} className="bg-card border border-border/30 rounded-2xl overflow-hidden divide-y divide-border/30">
            {debts.map(d => {
              const remaining = getRealRemaining(d);
              const repaidPct = d.initialAmount > 0 ? Math.min(((d.initialAmount - remaining) / d.initialAmount) * 100, 100) : 0;
              const nextRow = debtNextPaymentMap.get(d.id);
              const nextDate = nextRow ? nextRow.due_date : (d.nextPaymentDate || calculateNextPaymentDate(d));
              const ppy = getPeriodsPerYear(d.paymentFrequency as PaymentFrequency);
              const freqSuffix = getFrequencySuffix(d.paymentFrequency);

              const isVehicle = !!d.vehicleType;
              const isConsumer = d.type === 'consumer';
              const isStudent = d.type === 'student';
              const isOther = d.type === 'other';
              const isRevolving = d.consumerType === 'revolving';
              const isInDeferral = isStudent && d.hasDeferral && d.deferralEndDate && new Date(d.deferralEndDate) > new Date();

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

              const vehicleContractMonths = isVehicle ? Math.round(d.durationYears * 12) : 0;
              const vehicleElapsedMonths = isVehicle ? (() => {
                const start = new Date(d.startDate);
                const now = new Date();
                return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
              })() : 0;
              const vehicleContractPct = vehicleContractMonths > 0 ? Math.min((vehicleElapsedMonths / vehicleContractMonths) * 100, 100) : 0;
              const vehicleTotalKm = isVehicle && d.annualKm ? d.annualKm * d.durationYears : 0;
              const vehicleKmPct = vehicleTotalKm > 0 && d.currentKm ? Math.min((d.currentKm / vehicleTotalKm) * 100, 100) : 0;

              // Badges
              const badges: { label: string; variant: 'default' | 'warning' | 'info' | 'destructive' | 'success' }[] = [];
              if (d.mortgageSystem === 'swiss') badges.push({ label: '🇨🇭 Suisse', variant: 'default' });
              if (d.mortgageSystem === 'europe') badges.push({ label: '🇪🇺 Europe', variant: 'default' });
              if (d.interestRate === 0 && (isConsumer || isOther)) badges.push({ label: 'Sans frais', variant: 'success' });
              if (isRevolving) badges.push({ label: 'Revolving', variant: 'warning' });
              if (isInDeferral) badges.push({ label: 'En différé', variant: 'info' });
              if (d.interestRate > 10) badges.push({ label: 'Taux élevé', variant: 'destructive' });
              if (d.vehicleType === 'leasing') badges.push({ label: 'LOA', variant: 'default' });
              if (d.vehicleType === 'lld') badges.push({ label: 'LLD', variant: 'default' });

              const badgeClasses: Record<string, string> = {
                default: 'bg-muted text-muted-foreground',
                warning: 'bg-warning/10 text-warning',
                info: 'bg-primary/10 text-primary',
                destructive: 'bg-destructive/10 text-destructive',
                success: 'bg-success/10 text-success',
              };

              const vehicleTypeLabel = d.vehicleType === 'credit' ? 'Crédit auto' : d.vehicleType === 'leasing' ? 'Leasing (LOA)' : d.vehicleType === 'lld' ? 'LLD' : '';
              const consumerTypeLabel = d.consumerType === 'personal' ? 'Prêt personnel' : d.consumerType === 'revolving' ? 'Crédit revolving' : d.consumerType === 'purchase' ? 'Achat à crédit' : '';

              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDebtId(d.id)}
                  className="px-4 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  {/* Row 1: Icon + Name + Amount */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                        <DebtIcon type={d.type} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{d.vehicleName || d.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {isVehicle ? `${d.lender ? d.lender + ' · ' : ''}${vehicleTypeLabel}` :
                           isConsumer ? `${d.lender ? d.lender + ' · ' : ''}${consumerTypeLabel}` :
                           isStudent ? `${d.lender ? d.lender + ' · ' : ''}Prêt étudiant` :
                           isOther ? `${d.lender ? d.lender + ' · ' : ''}${d.hasInterest === false ? 'Sans intérêts' : `${d.interestRate}%`}` :
                           d.lender ? `${d.lender} · ${d.rateType === 'fixed' ? 'Fixe' : 'Variable'} ${d.interestRate}%` : `${d.interestRate}% · ${d.currency}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-mono-amount text-sm font-bold">
                        {isRevolving
                          ? formatAmountWithCurrency(d.currentBalance || 0, d.currency)
                          : isInDeferral
                          ? (d.deferralType === 'partial' ? formatAmountWithCurrency(remaining * d.interestRate / 100 / 12, d.currency) : '—')
                          : formatAmountWithCurrency(d.mortgageSystem === 'swiss' ? displayTotal + displayMaintenance : displayTotal, d.currency)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {isRevolving ? 'Solde utilisé' :
                         isInDeferral ? (d.deferralType === 'partial' ? '/mois' : 'En différé') :
                         freqSuffix.replace('/', '')}
                      </p>
                    </div>
                  </div>

                  {/* Badges */}
                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {badges.map((b, i) => (
                        <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badgeClasses[b.variant]}`}>
                          {b.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Swiss breakdown */}
                  {d.mortgageSystem === 'swiss' && (
                    <div className="text-[10px] text-muted-foreground mb-2 bg-muted/30 rounded-lg p-2 space-y-0.5">
                      <div className="flex justify-between"><span>Intérêts</span><span className="font-mono-amount">{formatAmountWithCurrency(displayInterest, d.currency)}</span></div>
                      {d.swissAmortizationType !== 'none' && displayCapital > 0 && (
                        <div className="flex justify-between"><span>Amortissement</span><span className="font-mono-amount">{formatAmountWithCurrency(displayCapital, d.currency)}</span></div>
                      )}
                      {d.includeMaintenance && displayMaintenance > 0 && (
                        <div className="flex justify-between"><span>Frais entretien</span><span className="font-mono-amount">{formatAmountWithCurrency(displayMaintenance, d.currency)}</span></div>
                      )}
                    </div>
                  )}

                  {/* Europe breakdown */}
                  {d.mortgageSystem === 'europe' && (
                    <div className="text-[10px] text-muted-foreground mb-2 bg-muted/30 rounded-lg p-2 space-y-0.5">
                      <div className="flex justify-between"><span>Intérêts</span><span className="font-mono-amount">{formatAmountWithCurrency(displayInterest, d.currency)}</span></div>
                      <div className="flex justify-between"><span>Capital</span><span className="font-mono-amount">{formatAmountWithCurrency(displayCapital, d.currency)}</span></div>
                    </div>
                  )}

                  {/* Vehicle leasing/lld */}
                  {isVehicle && (d.vehicleType === 'leasing' || d.vehicleType === 'lld') ? (
                    <div className="space-y-1.5">
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Contrat</span>
                          <span className="font-mono-amount">{vehicleElapsedMonths}/{vehicleContractMonths} mois</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${vehicleContractPct >= 90 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${vehicleContractPct}%` }} />
                        </div>
                      </div>
                      {d.annualKm && d.currentKm !== undefined && d.currentKm > 0 && (
                        <div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                            <span>Kilométrage</span>
                            <span className="font-mono-amount">{d.currentKm.toLocaleString('fr-FR')} / {vehicleTotalKm.toLocaleString('fr-FR')} km</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${vehicleKmPct > 100 ? 'bg-destructive' : vehicleKmPct > 80 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(vehicleKmPct, 100)}%` }} />
                          </div>
                        </div>
                      )}
                      {d.vehicleType === 'leasing' && d.residualValue && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CreditCard className="w-3 h-3" /> Rachat : {formatAmountWithCurrency(d.residualValue, d.currency)}
                        </div>
                      )}
                      {d.vehicleType === 'lld' && d.servicesIncluded && d.servicesIncluded.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {d.servicesIncluded.map((s: string) => {
                            const svcIcons: Record<string, React.ReactNode> = {
                              maintenance: <Wrench className="w-3 h-3" />,
                              insurance: <Shield className="w-3 h-3" />,
                              assistance: <Phone className="w-3 h-3" />,
                              replacement: <Car className="w-3 h-3" />,
                              winter_tires: <Snowflake className="w-3 h-3" />,
                              fuel_card: <Fuel className="w-3 h-3" />,
                            };
                            return <span key={s} className="text-muted-foreground">{svcIcons[s] || <CheckCircle className="w-3 h-3" />}</span>;
                          })}
                        </div>
                      )}
                      {d.contractEndDate && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> {d.vehicleType === 'lld' ? 'Restitution' : 'Fin'} : {format(new Date(d.contractEndDate), 'MMMM yyyy', { locale: fr })}
                        </div>
                      )}
                    </div>
                  ) : isRevolving ? (
                    /* Revolving */
                    (() => {
                      const utilPct = d.creditLimit ? Math.min(((d.currentBalance || 0) / d.creditLimit) * 100, 100) : 0;
                      const available = (d.creditLimit || 0) - (d.currentBalance || 0);
                      const monthlyInterest = ((d.currentBalance || 0) * d.interestRate / 100) / 12;
                      return (
                        <div className="space-y-1.5">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${utilPct > 80 ? 'bg-destructive' : utilPct > 50 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${utilPct}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="font-mono-amount">{Math.round(utilPct)}% du plafond</span>
                            <span className="font-mono-amount">Dispo : {formatAmountWithCurrency(available, d.currency)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Plafond : {formatAmountWithCurrency(d.creditLimit || 0, d.currency)}</span>
                            <span>Min. : {formatAmountWithCurrency(d.minimumPayment || 0, d.currency)}/mois</span>
                          </div>
                          {monthlyInterest > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-warning font-medium">
                              <AlertTriangle className="w-3 h-3" /> Intérêts estimés : {formatAmountWithCurrency(monthlyInterest, d.currency)}/mois
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : isInDeferral ? (
                    /* Student in deferral */
                    (() => {
                      const deferEnd = new Date(d.deferralEndDate!);
                      const now = new Date();
                      const monthsLeft = Math.max(0, (deferEnd.getFullYear() - now.getFullYear()) * 12 + (deferEnd.getMonth() - now.getMonth()));
                      return (
                        <div className="space-y-1.5">
                          <div className="bg-primary/5 border border-primary/10 rounded-lg p-2 text-center">
                            <p className="text-[10px] font-semibold text-primary">EN PÉRIODE DE DIFFÉRÉ</p>
                          </div>
                          <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2 space-y-0.5">
                            <div className="flex justify-between"><span>Montant emprunté</span><span className="font-mono-amount">{formatAmountWithCurrency(d.initialAmount, d.currency)}</span></div>
                            <div className="flex justify-between"><span>Début remboursement</span><span>{format(deferEnd, 'MMMM yyyy', { locale: fr })}</span></div>
                            <div className="flex justify-between"><span>Mensualité prévue</span><span className="font-mono-amount">{formatAmountWithCurrency(d.paymentAmount, d.currency)}</span></div>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-primary font-medium">
                            <Clock className="w-3 h-3" /> Différé restant : {monthsLeft} mois
                          </div>
                        </div>
                      );
                    })()
                  ) : isOther && d.hasSchedule === false ? (
                    /* Other without schedule */
                    <div className="space-y-1.5">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${repaidPct >= 50 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${repaidPct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-mono-amount">{formatAmountWithCurrency(remaining, d.currency)} restant</span>
                        <span className="font-mono-amount">{Math.round(repaidPct)}% remboursé</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Info className="w-3 h-3" /> Pas d'échéancier fixe
                      </div>
                      {d.notes && (
                        <p className="text-[10px] text-muted-foreground/70 italic">"{d.notes}"</p>
                      )}
                    </div>
                  ) : (
                    /* Default: standard progress bar */
                    <div className="space-y-1.5">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${repaidPct >= 100 ? 'bg-success' : repaidPct >= 50 ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${repaidPct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-mono-amount">{formatAmountWithCurrency(remaining, d.currency)} / {formatAmountWithCurrency(d.initialAmount, d.currency)}</span>
                        <span className="font-mono-amount">
                          {Math.round(repaidPct)}%
                          {d.mortgageSystem === 'swiss' && d.propertyValue ? ` · LTV ${Math.round((remaining / d.propertyValue) * 100)}%` : ''}
                        </span>
                      </div>

                      {/* Swiss rate renewal */}
                      {d.mortgageSystem === 'swiss' && d.rateEndDate && (() => {
                        const endDate = new Date(d.rateEndDate!);
                        const now = new Date();
                        const monthsLeft = (endDate.getFullYear() - now.getFullYear()) * 12 + (endDate.getMonth() - now.getMonth());
                        if (monthsLeft <= 12 && monthsLeft > 0) {
                          const years = Math.floor(monthsLeft / 12);
                          const months = monthsLeft % 12;
                          return (
                            <div className="flex items-center gap-1 text-[10px] text-warning font-medium">
                              <AlertTriangle className="w-3 h-3" /> Renouvellement dans {years > 0 ? `${years}a ` : ''}{months}m
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Europe end date */}
                      {d.mortgageSystem === 'europe' && d.durationYears > 0 && (() => {
                        const startD = new Date(d.startDate);
                        const endD = new Date(startD);
                        endD.setFullYear(endD.getFullYear() + Math.floor(d.durationYears));
                        endD.setMonth(endD.getMonth() + Math.round((d.durationYears % 1) * 12));
                        const now = new Date();
                        const yearsLeft = Math.max(0, Math.round((endD.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000)));
                        return (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <CalendarDays className="w-3 h-3" /> Fin : {format(endD, 'MMMM yyyy', { locale: fr })} ({yearsLeft}a)
                          </div>
                        );
                      })()}

                      {d.propertyValue && d.propertyValue > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Landmark className="w-3 h-3" /> Bien : {formatAmountWithCurrency(d.propertyValue, d.currency)}
                        </div>
                      )}

                      {nextDate && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" /> Prochaine : {formatDateLong(nextDate)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Upcoming payments — unified container */}
        {upcomingPayments.length > 0 && (
          <motion.div variants={fadeUp} className="bg-card border border-border/30 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAllUpcoming(!showAllUpcoming)}
              className="w-full px-4 py-3.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Prochaines échéances</p>
                  <p className="text-[10px] text-muted-foreground">{upcomingPayments.length} échéances sur 2 ans</p>
                </div>
              </div>
              {showAllUpcoming ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            <AnimatePresence>
              {showAllUpcoming && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="divide-y divide-border/30">
                    {upcomingPayments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedDebtId(p.debt_id)}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <DebtIcon type={p.debtType || ''} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{formatDateLong(p.due_date)}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {p.debtName} · Int. {formatAmountWithCurrency(p.interest_amount, p.debtCurrency)} · Cap. {formatAmountWithCurrency(p.principal_amount, p.debtCurrency)}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono-amount text-xs font-semibold text-destructive shrink-0">
                          -{formatAmountWithCurrency(p.total_amount, p.debtCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>

      <AddDebtModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={handleDebtAdded} />
      </PremiumGate>
    </Layout>
  );
};

export default Debts;
