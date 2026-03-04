import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Debt, DEBT_TYPES, getDebtEmoji, getPeriodsPerYear, PAYMENT_FREQUENCIES, PaymentFrequency, VehicleType, ConsumerType, DeferralType } from '@/types/debt';
import { DebtIcon } from '@/utils/categoryIcons';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateLong, formatAmount as formatAmountRaw } from '@/utils/format';
import { DEFAULT_EXCHANGE_RATES } from '@/types/finance';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Trash2, Pencil, Save, X } from 'lucide-react';
import { recalculateScheduleFromRow } from '@/utils/recalculateSchedule';

interface ScheduleRow {
  id: string;
  due_date: string;
  period_number: number;
  capital_before: number;
  capital_after: number;
  interest_amount: number;
  principal_amount: number;
  total_amount: number;
  status: string;
  transaction_id: string | null;
}

interface Props {
  debt: Debt;
  onClose: () => void;
  onUpdated: () => void;
}

// Inline km update component
const UpdateKmButton = ({ debt, onUpdated, formatAmount }: { debt: Debt; onUpdated: () => void; formatAmount: (n: number) => string }) => {
  const [editing, setEditing] = useState(false);
  const [km, setKm] = useState(String(debt.currentKm || 0));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('debts').update({ current_km: parseInt(km) || 0 }).eq('id', debt.id);
    setSaving(false);
    if (error) { toast.error('Erreur'); return; }
    // silent
    setEditing(false);
    onUpdated();
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="mt-2 w-full py-1.5 rounded-xl bg-muted/50 text-muted-foreground text-xs font-medium hover:bg-muted transition-colors">
        ✏️ Mettre à jour le kilométrage
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-2 items-center">
      <input type="number" value={km} onChange={e => setKm(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Km actuel" />
      <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
        {saving ? '...' : 'OK'}
      </button>
      <button onClick={() => setEditing(false)} className="px-2 py-1.5 rounded-lg border border-border text-xs">✕</button>
    </div>
  );
};

const DebtDetailModal = ({ debt, onClose, onUpdated }: Props) => {
  const { formatAmount: formatHouseholdAmount } = useCurrency();
  const formatAmount = useCallback((amount: number) => formatAmountRaw(amount, debt.currency), [debt.currency]);
  const { householdId, session, household, refreshDebtSchedules } = useApp();
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedPeriod, setExpandedPeriod] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  // Inline editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editInterest, setEditInterest] = useState('');
  const [editPrincipal, setEditPrincipal] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    const { data, error } = await supabase
      .from('debt_schedules')
      .select('*')
      .eq('debt_id', debt.id)
      .order('period_number', { ascending: true });
    if (data) {
      setSchedule(data.map((r: any) => ({
        id: r.id,
        due_date: r.due_date,
        period_number: r.period_number,
        capital_before: Number(r.capital_before),
        capital_after: Number(r.capital_after),
        interest_amount: Number(r.interest_amount),
        principal_amount: Number(r.principal_amount),
        total_amount: Number(r.total_amount),
        status: r.status,
        transaction_id: r.transaction_id,
      })));
    }
    if (error) console.error('Fetch schedule error:', error);
    setLoadingSchedule(false);
  }, [debt.id]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  // Compute real remaining from schedule: capital_after of last paid/adjusted row, or capital_before of first unpaid
  const realRemaining = useMemo(() => {
    if (schedule.length === 0) return debt.remainingAmount;
    const paidRows = schedule.filter(r => r.status === 'paye');
    if (paidRows.length > 0) {
      const lastPaid = paidRows[paidRows.length - 1];
      return lastPaid.capital_after;
    }
    // No rows paid yet → full initial amount
    return schedule[0].capital_before;
  }, [schedule, debt.remainingAmount]);

  const repaidPct = debt.initialAmount > 0 ? Math.min(((debt.initialAmount - realRemaining) / debt.initialAmount) * 100, 100) : 0;
  const typeInfo = DEBT_TYPES.find(t => t.value === debt.type);
  const freqInfo = PAYMENT_FREQUENCIES.find(f => f.value === debt.paymentFrequency);

  const isSwiss = debt.mortgageSystem === 'swiss';
  const isEurope = debt.mortgageSystem === 'europe';
  const isMortgage = !!debt.mortgageSystem;
  const isVehicle = !!debt.vehicleType;
  const vehicleTypeLabel = debt.vehicleType === 'credit' ? 'Crédit auto' : debt.vehicleType === 'leasing' ? 'Leasing (LOA)' : debt.vehicleType === 'lld' ? 'Location longue durée (LLD)' : '';
  const vehicleTypeEmoji = debt.vehicleType === 'credit' ? '💰' : debt.vehicleType === 'leasing' ? '🔄' : debt.vehicleType === 'lld' ? '📋' : '';

  const isConsumer = debt.type === 'consumer';
  const isStudent = debt.type === 'student';
  const isOther = debt.type === 'other';
  const isRevolving = debt.consumerType === 'revolving';
  const consumerTypeLabel = debt.consumerType === 'personal' ? 'Prêt personnel' : debt.consumerType === 'revolving' ? 'Crédit revolving' : debt.consumerType === 'purchase' ? 'Achat à crédit' : '';
  const consumerTypeEmoji = debt.consumerType === 'personal' ? '💰' : debt.consumerType === 'revolving' ? '🔄' : debt.consumerType === 'purchase' ? '🛒' : '';
  const isInDeferral = isStudent && debt.hasDeferral && debt.deferralEndDate && new Date(debt.deferralEndDate) > new Date();

  const ppy = getPeriodsPerYear(debt.paymentFrequency as PaymentFrequency);
  const freqLabel = freqInfo?.label || 'Mensuel';
  const freqSuffix = ppy === 12 ? '/mois' : ppy === 4 ? '/trim.' : ppy === 2 ? '/sem.' : '/an';
  const freqPeriodLabel = ppy === 12 ? 'mensuelle' : ppy === 4 ? 'trimestrielle' : ppy === 2 ? 'semestrielle' : 'annuelle';
  const freqCeLabel = ppy === 12 ? 'ce mois' : ppy === 4 ? 'ce trimestre' : ppy === 2 ? 'ce semestre' : 'cette année';

  // Swiss periodic calculations
  const swissPeriodicInterest = isSwiss ? (realRemaining * debt.interestRate / 100) / ppy : 0;
  const swissPeriodicAmortization = isSwiss && debt.swissAmortizationType !== 'none' && debt.annualAmortization ? debt.annualAmortization / ppy : 0;
  const swissPeriodicMaintenance = isSwiss && debt.includeMaintenance && debt.propertyValue ? (debt.propertyValue * 0.01) / ppy : 0;
  const swissTotalPeriodic = swissPeriodicInterest + swissPeriodicAmortization + swissPeriodicMaintenance;

  const totalInterest = useMemo(() => schedule.reduce((s, r) => s + r.interest_amount, 0), [schedule]);
  const totalPrincipal = useMemo(() => schedule.reduce((s, r) => s + r.principal_amount, 0), [schedule]);
  const totalCost = useMemo(() => schedule.reduce((s, r) => s + r.total_amount, 0), [schedule]);

  const today = new Date().toISOString().split('T')[0];
  const nextPayment = schedule.find(r => r.status === 'prevu' && r.due_date >= today);
  const paidCount = schedule.filter(r => r.status === 'paye').length;

  const visibleSchedule = showAll ? schedule : schedule.slice(0, 24);

  const handleDelete = async () => {
    setDeleting(true);
    // Delete transactions linked to this debt first
    await supabase.from('transactions').delete().eq('debt_id', debt.id);
    await supabase.from('debt_schedules').delete().eq('debt_id', debt.id);
    const { error } = await supabase.from('debts').delete().eq('id', debt.id);
    setDeleting(false);
    if (error) { console.error('Delete debt error:', error); toast.error('Erreur'); return; }
    // silent
    await refreshDebtSchedules();
    onUpdated();
  };

  const markAsPaid = async (row: ScheduleRow) => {
    if (!householdId || !session?.user?.id) return;
    setMarkingPaid(row.id);

    const userId = session.user.id;
    const baseCurrency = household.currency;

    const txId = crypto.randomUUID();
    const debtCurrency = debt.currency || baseCurrency;
    let exchangeRate = 1;
    let convertedAmount = row.total_amount;
    if (debtCurrency !== baseCurrency) {
      const fromToEur = DEFAULT_EXCHANGE_RATES[debtCurrency] || 1;
      const toToEur = DEFAULT_EXCHANGE_RATES[baseCurrency] || 1;
      exchangeRate = fromToEur / toToEur;
      convertedAmount = row.total_amount * exchangeRate;
    }

    const { error: txError } = await supabase.from('transactions').insert({
      id: txId,
      household_id: householdId,
      type: 'expense',
      amount: row.total_amount,
      currency: debtCurrency,
      base_currency: baseCurrency,
      exchange_rate: exchangeRate,
      converted_amount: convertedAmount,
      category: 'Dettes',
      emoji: getDebtEmoji(debt.type),
      label: `${debt.name} — Échéance #${row.period_number}`,
      date: row.due_date,
      member_id: userId,
      account_id: debt.accountId || null,
      is_auto_generated: true,
      debt_id: debt.id,
      notes: `Amortissement ${row.principal_amount.toFixed(2)} + Intérêts ${row.interest_amount.toFixed(2)}`,
      scope: debt.scope || 'household',
      created_by: userId,
    });

    if (txError) {
      console.error('Create tx error:', txError);
      toast.error('Erreur lors de la création de la transaction');
      setMarkingPaid(null);
      return;
    }

    await supabase.from('debt_schedules').update({
      status: 'paye',
      transaction_id: txId,
    }).eq('id', row.id);

    await supabase.from('debts').update({
      remaining_amount: Math.max(row.capital_after, 0),
      last_payment_date: row.due_date,
    }).eq('id', debt.id);

    // silent
    setMarkingPaid(null);
    fetchSchedule();
    await refreshDebtSchedules();
    onUpdated();
  };

  // Start editing a row
  const startEditing = (row: ScheduleRow) => {
    setEditingRowId(row.id);
    setEditInterest(String(row.interest_amount));
    setEditPrincipal(String(row.principal_amount));
  };

  const cancelEditing = () => {
    setEditingRowId(null);
    setEditInterest('');
    setEditPrincipal('');
  };

  // Save edited row & recalculate subsequent rows
  const saveEditedRow = async () => {
    if (!editingRowId) return;
    const idx = schedule.findIndex(r => r.id === editingRowId);
    if (idx === -1) return;

    setSaving(true);
    const newInterest = parseFloat(editInterest) || 0;
    const newPrincipal = parseFloat(editPrincipal) || 0;

    try {
      const updatedSchedule = await recalculateScheduleFromRow(
        schedule, idx, newInterest, newPrincipal,
        debt.id, debt.interestRate, debt.paymentFrequency,
        debt.amortizationType, debt.paymentAmount
      );

      // Also update linked transaction if the modified row has one
      const modifiedRow = updatedSchedule[idx];
      if (modifiedRow.transaction_id) {
        await supabase.from('transactions').update({
          amount: modifiedRow.total_amount,
          converted_amount: modifiedRow.total_amount,
          notes: `Amortissement ${modifiedRow.principal_amount.toFixed(2)} + Intérêts ${modifiedRow.interest_amount.toFixed(2)}`,
        }).eq('id', modifiedRow.transaction_id);
      }

      setSchedule(updatedSchedule);
      // silent
      await refreshDebtSchedules();
      onUpdated();
    } catch (err) {
      console.error('Save schedule error:', err);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
      setEditingRowId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <DebtIcon type={debt.type} size="lg" />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-bold">{debt.vehicleName || debt.name}</h1>
              {isSwiss && <span>🇨🇭</span>}
              {isEurope && <span>🇪🇺</span>}
              {isVehicle && <span>{vehicleTypeEmoji}</span>}
              {isConsumer && <span>{consumerTypeEmoji}</span>}
              {isInDeferral && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">⏳ En différé</span>}
              {debt.interestRate === 0 && (isConsumer || isOther) && <span className="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">Sans frais</span>}
              {isRevolving && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Revolving</span>}
            </div>
            {isVehicle ? (
              <p className="text-xs text-muted-foreground">{debt.lender ? `${debt.lender} · ` : ''}{vehicleTypeLabel}</p>
            ) : isConsumer ? (
              <p className="text-xs text-muted-foreground">{debt.lender ? `${debt.lender} · ` : ''}{consumerTypeLabel}</p>
            ) : isStudent ? (
              <p className="text-xs text-muted-foreground">{debt.lender ? `${debt.lender} · ` : ''}Prêt étudiant</p>
            ) : isOther ? (
              <p className="text-xs text-muted-foreground">{debt.lender ? `${debt.lender} · ` : ''}{debt.hasInterest === false ? 'Sans intérêts' : `Taux ${debt.interestRate}%`}</p>
            ) : debt.lender ? (
              <p className="text-xs text-muted-foreground">{debt.lender} · {debt.rateType === 'variable' ? 'Taux variable' : 'Taux fixe'} {debt.interestRate}%</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Remboursé</span>
          <span className="font-semibold">{Math.round(repaidPct)}%</span>
        </div>
        <Progress value={repaidPct} className="h-3" />
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
          <span>{formatAmount(debt.initialAmount - realRemaining)} payé</span>
          <span>{formatAmount(realRemaining)} restant</span>
        </div>
      </div>

      {/* Vehicle-specific details */}
      {isVehicle && (
        <div className="bg-card border border-amber-200 dark:border-amber-900/30 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">{vehicleTypeEmoji} Détails {vehicleTypeLabel}</h2>
          <div className="space-y-2">
            {debt.vehiclePrice && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{debt.vehicleType === 'credit' ? '🏷️ Prix du véhicule' : '🏷️ Prix catalogue'}</span>
                <span className="font-mono-amount font-medium">{formatAmount(debt.vehiclePrice)}</span>
              </div>
            )}
            {debt.downPayment && debt.downPayment > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{debt.vehicleType === 'credit' ? '💵 Apport initial' : '💵 1er loyer majoré'}</span>
                <span className="font-mono-amount font-medium">{formatAmount(debt.downPayment)}</span>
              </div>
            )}
            {debt.vehicleType === 'credit' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">📊 Montant emprunté</span>
                  <span className="font-mono-amount font-medium">{formatAmount(debt.initialAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">💰 Mensualité</span>
                  <span className="font-mono-amount font-semibold">{formatAmount(debt.paymentAmount)}</span>
                </div>
                {debt.interestRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">📉 TAEG</span>
                    <span className="font-medium">{debt.interestRate}%</span>
                  </div>
                )}
              </>
            )}
            {(debt.vehicleType === 'leasing' || debt.vehicleType === 'lld') && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">💰 Loyer mensuel</span>
                  <span className="font-mono-amount font-semibold">{formatAmount(debt.paymentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">📊 Total des loyers</span>
                  <span className="font-mono-amount font-medium">{formatAmount((debt.downPayment || 0) + debt.paymentAmount * Math.round(debt.durationYears * 12))}</span>
                </div>
              </>
            )}
            {debt.vehicleType === 'leasing' && debt.residualValue && (
              <div className="flex justify-between text-sm font-semibold border-t border-amber-200 dark:border-amber-900/30 pt-2">
                <span>💰 Valeur de rachat</span>
                <span className="font-mono-amount">{formatAmount(debt.residualValue)}</span>
              </div>
            )}
          </div>

          {/* Contract progress */}
          {(() => {
            const totalMonths = Math.round(debt.durationYears * 12);
            const start = new Date(debt.startDate);
            const now = new Date();
            const elapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
            const remaining = Math.max(0, totalMonths - elapsed);
            const pct = totalMonths > 0 ? Math.min((elapsed / totalMonths) * 100, 100) : 0;
            return (
              <div className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-900/30">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Contrat</span>
                  <span>{elapsed}/{totalMonths} mois ({remaining} restants)</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })()}

          {/* Km tracking */}
          {(debt.vehicleType === 'leasing' || debt.vehicleType === 'lld') && debt.annualKm && (() => {
            const totalKm = debt.annualKm * debt.durationYears;
            const totalMonths = Math.round(debt.durationYears * 12);
            const start = new Date(debt.startDate);
            const now = new Date();
            const elapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
            const expectedKm = totalMonths > 0 ? (totalKm * elapsed) / totalMonths : 0;
            const currentKm = debt.currentKm || 0;
            const diff = currentKm - expectedKm;
            const kmPct = totalKm > 0 ? Math.min((currentKm / totalKm) * 100, 100) : 0;
            const isOver = diff > 0;
            
            return (
              <div className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-900/30">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>📍 Kilométrage</span>
                  <span>{currentKm.toLocaleString('fr-FR')} / {totalKm.toLocaleString('fr-FR')} km</span>
                </div>
                <Progress value={kmPct} className="h-2" />
                {currentKm > 0 && (
                  <div className={`mt-1 text-[10px] font-medium ${isOver ? 'text-destructive' : 'text-success'}`}>
                    {isOver 
                      ? `⚠️ Tu dépasses de ${Math.round(diff).toLocaleString('fr-FR')} km${debt.excessKmCost ? ` — Surcoût estimé : ${formatAmount(Math.round(diff) * debt.excessKmCost)}` : ''}` 
                      : `✅ Tu es dans les clous ! (${Math.round(Math.abs(diff)).toLocaleString('fr-FR')} km d'avance)`}
                  </div>
                )}
                {/* Update km button */}
                <UpdateKmButton debt={debt} onUpdated={onUpdated} formatAmount={formatAmount} />
              </div>
            );
          })()}

          {/* LLD Services */}
          {debt.vehicleType === 'lld' && debt.servicesIncluded && debt.servicesIncluded.length > 0 && (
            <div className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-900/30">
              <p className="text-xs text-muted-foreground mb-2">Services inclus</p>
              <div className="flex flex-wrap gap-1.5">
                {debt.servicesIncluded.map((s: string) => {
                  const labels: Record<string, string> = { maintenance: '🔧 Entretien', insurance: '🛡️ Assurance', assistance: '📞 Assistance', replacement: '🚗 Remplacement', winter_tires: '❄️ Pneus hiver', fuel_card: '⛽ Carburant' };
                  return <span key={s} className="bg-muted px-2 py-1 rounded-lg text-[10px] font-medium">{labels[s] || s}</span>;
                })}
              </div>
            </div>
          )}

          {debt.contractEndDate && (
            <div className="mt-2 text-xs text-muted-foreground">
              📅 {debt.vehicleType === 'lld' ? 'Restitution' : 'Fin du contrat'} : {formatDateLong(debt.contractEndDate)}
            </div>
          )}
        </div>
      )}

      {/* Consumer credit details */}
      {isConsumer && (
        <div className="bg-card border border-purple-200 dark:border-purple-900/30 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">{consumerTypeEmoji} {consumerTypeLabel}</h2>
          <div className="space-y-2">
            {isRevolving ? (
              <>
                {(() => {
                  const utilPct = debt.creditLimit ? Math.min(((debt.currentBalance || 0) / debt.creditLimit) * 100, 100) : 0;
                  const available = (debt.creditLimit || 0) - (debt.currentBalance || 0);
                  const monthlyInterest = ((debt.currentBalance || 0) * debt.interestRate / 100) / 12;
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">💳 Plafond autorisé</span>
                        <span className="font-mono-amount font-medium">{formatAmount(debt.creditLimit || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">📊 Solde utilisé</span>
                        <span className="font-mono-amount font-semibold">{formatAmount(debt.currentBalance || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">✅ Disponible</span>
                        <span className="font-mono-amount font-medium text-success">{formatAmount(available)}</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Utilisation</span>
                          <span>{Math.round(utilPct)}%</span>
                        </div>
                        <Progress value={utilPct} className="h-2" />
                      </div>
                      <div className="flex justify-between text-sm border-t border-purple-200 dark:border-purple-900/30 pt-2">
                        <span className="text-muted-foreground">💰 Mensualité minimum</span>
                        <span className="font-mono-amount font-medium">{formatAmount(debt.minimumPayment || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">📉 TAEG</span>
                        <span className="font-medium">{debt.interestRate}%</span>
                      </div>
                      {monthlyInterest > 0 && (
                        <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          ⚠️ Intérêts estimés ce mois : {formatAmount(monthlyInterest)}
                        </div>
                      )}
                      {utilPct > 80 && (
                        <div className="mt-1 text-xs text-destructive font-medium">
                          ⚠️ Utilisation élevée ({Math.round(utilPct)}% du plafond)
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : debt.consumerType === 'purchase' ? (
              <>
                {debt.purchasePrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">🏷️ Prix d'achat</span>
                    <span className="font-mono-amount font-medium">{formatAmount(debt.purchasePrice)}</span>
                  </div>
                )}
                {debt.downPayment && debt.downPayment > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">💵 Acompte versé</span>
                    <span className="font-mono-amount font-medium">{formatAmount(debt.downPayment)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">📊 Montant financé</span>
                  <span className="font-mono-amount font-medium">{formatAmount(debt.initialAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">💰 Mensualité</span>
                  <span className="font-mono-amount font-semibold">{formatAmount(debt.paymentAmount)}</span>
                </div>
                {debt.interestRate === 0 && (
                  <div className="text-xs text-success font-medium">✅ Paiement en plusieurs fois sans frais</div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">📊 Montant emprunté</span>
                  <span className="font-mono-amount font-medium">{formatAmount(debt.initialAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">💰 Mensualité</span>
                  <span className="font-mono-amount font-semibold">{formatAmount(debt.paymentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">📉 TAEG</span>
                  <span className="font-medium">{debt.interestRate}%</span>
                </div>
                {schedule.length > 0 && (
                  <div className="flex justify-between text-sm border-t border-purple-200 dark:border-purple-900/30 pt-2">
                    <span className="text-muted-foreground">💸 Coût total du crédit</span>
                    <span className="font-mono-amount font-medium">{formatAmount(totalCost)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Student loan details */}
      {isStudent && (
        <div className="bg-card border border-indigo-200 dark:border-indigo-900/30 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">🎓 Prêt étudiant</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">📊 Montant emprunté</span>
              <span className="font-mono-amount font-medium">{formatAmount(debt.initialAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">📉 Taux d'intérêt</span>
              <span className="font-medium">{debt.interestRate}%</span>
            </div>
            {isInDeferral ? (
              <>
                {(() => {
                  const deferEnd = new Date(debt.deferralEndDate!);
                  const now = new Date();
                  const monthsLeft = Math.max(0, (deferEnd.getFullYear() - now.getFullYear()) * 12 + (deferEnd.getMonth() - now.getMonth()));
                  return (
                    <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 text-center">🎓 EN PÉRIODE DE DIFFÉRÉ ({debt.deferralType === 'total' ? 'Total' : 'Partiel'})</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Fin du différé</span>
                        <span className="font-medium">{formatDateLong(debt.deferralEndDate!)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">⏳ Différé restant</span>
                        <span className="font-semibold">{monthsLeft} mois</span>
                      </div>
                      {debt.deferralType === 'partial' && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Intérêts mensuels</span>
                          <span className="font-mono-amount">{formatAmount(realRemaining * debt.interestRate / 100 / 12)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs border-t border-blue-200 dark:border-blue-900/30 pt-2">
                        <span className="text-muted-foreground">Mensualité prévue</span>
                        <span className="font-mono-amount font-semibold">{formatAmount(debt.paymentAmount)}/mois pendant {Math.round(debt.durationYears * 12)} mois</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">💰 Mensualité</span>
                  <span className="font-mono-amount font-semibold">{formatAmount(debt.paymentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Capital restant dû</span>
                  <span className="font-mono-amount font-medium text-destructive">{formatAmount(realRemaining)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Other debt details */}
      {isOther && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">📦 Détails</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">📊 Montant initial</span>
              <span className="font-mono-amount font-medium">{formatAmount(debt.initialAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">📉 Reste à rembourser</span>
              <span className="font-mono-amount font-medium text-destructive">{formatAmount(realRemaining)}</span>
            </div>
            {debt.hasInterest !== false && debt.interestRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">💹 Taux d'intérêt</span>
                <span className="font-medium">{debt.interestRate}%</span>
              </div>
            )}
            {debt.hasInterest === false && (
              <div className="text-xs text-success font-medium">✅ Sans intérêts</div>
            )}
            {debt.hasSchedule !== false && debt.paymentAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">💰 Mensualité</span>
                <span className="font-mono-amount font-semibold">{formatAmount(debt.paymentAmount)}</span>
              </div>
            )}
            {debt.hasSchedule === false && (
              <div className="text-xs text-muted-foreground font-medium">💡 Pas d'échéancier fixe défini</div>
            )}
            {debt.notes && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">📝 Notes</p>
                <p className="text-sm">{debt.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isSwiss && (
        <div className="bg-card border border-red-200 dark:border-red-900/30 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">🇨🇭 Charge {freqPeriodLabel}</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">📉 Intérêts</span>
              <span className="font-mono-amount font-medium">{formatAmount(swissPeriodicInterest)}</span>
            </div>
            {debt.swissAmortizationType !== 'none' && debt.annualAmortization && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">💰 Amortissement ({debt.swissAmortizationType === 'indirect' ? 'Pilier 3a' : 'Direct'})</span>
                <span className="font-mono-amount font-medium">{formatAmount(swissPeriodicAmortization)}</span>
              </div>
            )}
            {debt.includeMaintenance && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">🔧 Frais d'entretien</span>
                <span className="font-mono-amount font-medium">{formatAmount(swissPeriodicMaintenance)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t border-red-200 dark:border-red-900/30 pt-2">
              <span>Total {freqLabel.toLowerCase()}</span>
              <span className="font-mono-amount">{formatAmount(swissTotalPeriodic)}</span>
            </div>
          </div>
          {debt.propertyValue && (
            <div className="mt-3 pt-2 border-t border-red-200 dark:border-red-900/30">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>LTV (Loan-to-Value)</span>
                <span className="font-mono-amount">{Math.round((realRemaining / debt.propertyValue) * 100)}%</span>
              </div>
              <Progress value={Math.min((1 - realRemaining / debt.propertyValue) * 100, 100)} className="h-2" />
            </div>
          )}
          {debt.rateEndDate && (() => {
            const endDate = new Date(debt.rateEndDate);
            const now = new Date();
            const monthsLeft = (endDate.getFullYear() - now.getFullYear()) * 12 + (endDate.getMonth() - now.getMonth());
            if (monthsLeft > 0) {
              const years = Math.floor(monthsLeft / 12);
              const months = monthsLeft % 12;
              return (
                <div className={`mt-2 text-xs font-medium ${monthsLeft <= 12 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                  {monthsLeft <= 12 ? '⚠️' : '📅'} Renouvellement du taux dans {years > 0 ? `${years} an${years > 1 ? 's' : ''} ` : ''}{months > 0 ? `${months} mois` : ''}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {isEurope && (
        <div className="bg-card border border-blue-200 dark:border-blue-900/30 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">🇪🇺 Détail échéance {freqPeriodLabel}</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">📉 Intérêts {freqCeLabel}</span>
              <span className="font-mono-amount font-medium">{formatAmount(realRemaining * debt.interestRate / 100 / ppy)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">💰 Capital {freqCeLabel}</span>
              <span className="font-mono-amount font-medium">{formatAmount(Math.max(debt.paymentAmount - realRemaining * debt.interestRate / 100 / ppy, 0))}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-blue-200 dark:border-blue-900/30 pt-2">
              <span>Échéance {freqPeriodLabel} fixe</span>
              <span className="font-mono-amount">{formatAmount(debt.paymentAmount)}</span>
            </div>
          </div>
          {debt.durationYears > 0 && (() => {
            const startD = new Date(debt.startDate);
            const endD = new Date(startD);
            endD.setFullYear(endD.getFullYear() + Math.floor(debt.durationYears));
            endD.setMonth(endD.getMonth() + Math.round((debt.durationYears % 1) * 12));
            const now = new Date();
            const yearsLeft = Math.max(0, Math.round((endD.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000)));
            return (
              <div className="mt-2 text-xs text-muted-foreground">
                📅 Fin du crédit : {endD.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} ({yearsLeft} ans restants)
              </div>
            );
          })()}
        </div>
      )}

      {/* Contract Info */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">📋 Informations du contrat</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="text-sm font-medium flex items-center gap-1.5"><DebtIcon type={debt.type} size="sm" /> {typeInfo?.label}</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Montant emprunté</p>
            <p className="text-sm font-mono-amount font-medium">{formatAmount(debt.initialAmount)}</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Capital restant dû</p>
            <p className="text-sm font-mono-amount font-medium text-destructive">{formatAmount(realRemaining)}</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Taux annuel</p>
            <p className="text-sm font-medium">{debt.interestRate}%</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Durée</p>
            <p className="text-sm font-medium">{debt.durationYears} ans</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Fréquence</p>
            <p className="text-sm font-medium">{freqInfo?.label || debt.paymentFrequency}</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Mode</p>
            <p className="text-sm font-medium">{debt.amortizationType === 'fixed_annuity' ? 'Échéance fixe' : 'Capital fixe'}</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Échéance</p>
            <p className="text-sm font-mono-amount font-medium">{formatAmount(debt.paymentAmount)}</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Signé le</p>
            <p className="text-sm font-medium">{formatDateLong(debt.startDate)}</p>
          </div>
          {nextPayment && (
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Prochaine échéance</p>
              <p className="text-sm font-medium">{formatDateLong(nextPayment.due_date)}</p>
            </div>
          )}
        </div>

        {schedule.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Total intérêts</p>
              <p className="text-xs font-mono-amount font-semibold text-destructive">{formatAmount(totalInterest)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Total capital</p>
              <p className="text-xs font-mono-amount font-semibold">{formatAmount(totalPrincipal)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Coût total</p>
              <p className="text-xs font-mono-amount font-semibold">{formatAmount(totalCost)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Amortization Schedule */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold">📊 Tableau d'amortissement</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {schedule.length} échéances · {paidCount} payée(s) · Cliquer sur ✏️ pour modifier
          </p>
        </div>

        {loadingSchedule ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Chargement...</div>
        ) : schedule.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Aucun tableau d'amortissement généré.</div>
        ) : (
          <div className="divide-y divide-border">
            {visibleSchedule.map((row) => {
              const isPast = row.due_date < today;
              const isPaid = row.status === 'paye';
              const isAdjusted = row.status === 'ajuste';
              const isExpanded = expandedPeriod === row.period_number;
              const isEditing = editingRowId === row.id;

              return (
                <div key={row.id} className={`${isPaid ? 'bg-success/5' : isAdjusted ? 'bg-warning/5' : isPast && !isPaid ? 'bg-warning/5' : ''}`}>
                  {/* Main line */}
                  <div
                    className="flex items-center px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedPeriod(isExpanded ? null : row.period_number)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                        isPaid ? 'bg-success/20 text-success' : isAdjusted ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isPaid ? '✓' : isAdjusted ? '✏' : `${row.period_number}`}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{formatDateLong(row.due_date)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Intérêts {formatAmount(row.interest_amount)} · Capital {formatAmount(row.principal_amount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono-amount text-sm font-semibold ${isPaid ? 'text-muted-foreground line-through' : 'text-destructive'}`}>
                        -{formatAmount(row.total_amount)}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-3 ml-8 space-y-2">
                      <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Capital avant</span>
                          <span className="font-mono-amount font-medium">{formatAmount(row.capital_before)}</span>
                        </div>
                        <div className="flex items-center justify-center text-muted-foreground">
                          <span className="text-[10px]">↓ -{formatAmount(row.principal_amount)} (amortissement)</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Capital après</span>
                          <span className="font-mono-amount font-semibold">{formatAmount(row.capital_after)}</span>
                        </div>
                      </div>

                      {/* Editing mode */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] text-muted-foreground mb-0.5">Intérêts</label>
                              <input
                                type="number" step="0.01"
                                value={editInterest}
                                onChange={e => setEditInterest(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-muted-foreground mb-0.5">Amortissement</label>
                              <input
                                type="number" step="0.01"
                                value={editPrincipal}
                                onChange={e => setEditPrincipal(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-mono-amount focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                          </div>
                          <p className="text-[9px] text-muted-foreground">
                            Total : {((parseFloat(editInterest) || 0) + (parseFloat(editPrincipal) || 0)).toFixed(2)} · Les échéances suivantes seront recalculées
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                              className="flex-1 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                            >
                              <X className="w-3 h-3" /> Annuler
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); saveEditedRow(); }}
                              disabled={saving}
                              className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <Save className="w-3 h-3" /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-muted/30 rounded-lg p-2 text-center">
                              <p className="text-[9px] text-muted-foreground">Intérêts</p>
                              <p className="text-xs font-mono-amount font-medium text-destructive">{formatAmount(row.interest_amount)}</p>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-2 text-center">
                              <p className="text-[9px] text-muted-foreground">Amortissement</p>
                              <p className="text-xs font-mono-amount font-medium">{formatAmount(row.principal_amount)}</p>
                            </div>
                          </div>

                          {/* Edit button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); startEditing(row); }}
                            className="w-full py-1.5 rounded-xl bg-muted/50 text-muted-foreground text-xs font-medium hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Pencil className="w-3 h-3" /> Modifier cette échéance
                          </button>
                        </>
                      )}

                      {/* Mark as paid button */}
                      {!isPaid && !isEditing && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsPaid(row); }}
                          disabled={markingPaid === row.id}
                          className="w-full py-2 rounded-xl bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {markingPaid === row.id ? 'Enregistrement...' : 'Marquer comme payée'}
                        </button>
                      )}

                      {isPaid && row.transaction_id && (
                        <p className="text-[9px] text-success text-center">✓ Transaction enregistrée</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!showAll && schedule.length > 24 && (
          <div className="p-3 text-center border-t border-border">
            <button onClick={() => setShowAll(true)} className="text-xs text-primary hover:text-primary/80 font-medium">
              Voir les {schedule.length - 24} échéances restantes
            </button>
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="space-y-2">
        {!showConfirmDelete ? (
          <button onClick={() => setShowConfirmDelete(true)}
            className="w-full py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors flex items-center justify-center gap-1.5">
            <Trash2 className="w-4 h-4" /> Supprimer cette dette
          </button>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => setShowConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium">Annuler</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50">
              {deleting ? 'Suppression...' : 'Confirmer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebtDetailModal;
