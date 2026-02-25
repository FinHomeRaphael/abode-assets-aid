import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Debt, DEBT_TYPES, getDebtEmoji, PAYMENT_FREQUENCIES } from '@/types/debt';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateLong } from '@/utils/format';
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

const DebtDetailModal = ({ debt, onClose, onUpdated }: Props) => {
  const { formatAmount } = useCurrency();
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

  const totalInterest = useMemo(() => schedule.reduce((s, r) => s + r.interest_amount, 0), [schedule]);
  const totalPrincipal = useMemo(() => schedule.reduce((s, r) => s + r.principal_amount, 0), [schedule]);
  const totalCost = useMemo(() => schedule.reduce((s, r) => s + r.total_amount, 0), [schedule]);

  const today = new Date().toISOString().split('T')[0];
  const nextPayment = schedule.find(r => r.status === 'prevu' && r.due_date >= today);
  const paidCount = schedule.filter(r => r.status === 'paye').length;

  const visibleSchedule = showAll ? schedule : schedule.slice(0, 24);

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from('debt_schedules').delete().eq('debt_id', debt.id);
    const { error } = await supabase.from('debts').delete().eq('id', debt.id);
    setDeleting(false);
    if (error) { console.error('Delete debt error:', error); toast.error('Erreur'); return; }
    toast.success('Dette supprimée');
    onUpdated();
  };

  const markAsPaid = async (row: ScheduleRow) => {
    if (!householdId || !session?.user?.id) return;
    setMarkingPaid(row.id);

    const userId = session.user.id;
    const baseCurrency = household.currency;

    const txId = crypto.randomUUID();
    const { error: txError } = await supabase.from('transactions').insert({
      id: txId,
      household_id: householdId,
      type: 'expense',
      amount: row.total_amount,
      currency: debt.currency,
      base_currency: baseCurrency,
      exchange_rate: debt.currency === baseCurrency ? 1 : 1,
      converted_amount: row.total_amount,
      category: debt.categoryId || 'Crédit',
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

    toast.success('Échéance marquée comme payée ✓');
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
      toast.success('Échéance modifiée — tableau recalculé ✓');
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
          <span className="text-xl">{getDebtEmoji(debt.type)}</span>
          <div>
            <h1 className="text-lg font-bold">{debt.name}</h1>
            {debt.lender && <p className="text-xs text-muted-foreground">{debt.lender}</p>}
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

      {/* Contract Info */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">📋 Informations du contrat</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="text-sm font-medium">{typeInfo?.emoji} {typeInfo?.label}</p>
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
