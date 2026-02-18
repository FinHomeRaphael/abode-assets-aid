import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Debt, DEBT_TYPES, getDebtEmoji, getPeriodsPerYear, estimateEndDate } from '@/types/debt';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateLong } from '@/utils/format';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface Props {
  debt: Debt | null;
  onClose: () => void;
  onUpdated: () => void;
}

const DebtDetailModal = ({ debt, onClose, onUpdated }: Props) => {
  const { formatAmount } = useCurrency();
  const { transactions, householdId } = useApp();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const debtTransactions = useMemo(() => {
    if (!debt) return [];
    return transactions.filter(t => (t as any).debtId === debt.id || (t as any).debt_id === debt.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }, [transactions, debt?.id]);

  if (!debt) return null;

  const repaidPct = debt.initialAmount > 0 ? Math.min(((debt.initialAmount - debt.remainingAmount) / debt.initialAmount) * 100, 100) : 0;
  const periodsPerYear = getPeriodsPerYear(debt.paymentFrequency);
  const rate = debt.interestRate / 100 / periodsPerYear;
  const nextInterest = debt.remainingAmount * rate;
  const nextPrincipal = Math.max(0, debt.paymentAmount - nextInterest);
  const endDate = estimateEndDate(debt);
  const typeInfo = DEBT_TYPES.find(t => t.value === debt.type);

  // debtTransactions moved above early return

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('debts').delete().eq('id', debt.id);
    setDeleting(false);
    if (error) { console.error('Delete debt error:', error); toast.error('Erreur lors de la suppression'); return; }
    toast.success('Dette supprimée');
    onUpdated();
  };

  // Generate payment - manual trigger for auto-generating transactions
  const handleGeneratePayment = async () => {
    if (!debt.categoryId) {
      toast.error('Définissez une catégorie pour cette dette d\'abord');
      return;
    }

    const interestAmount = debt.remainingAmount * rate;
    const principalAmount = Math.max(0, debt.paymentAmount - interestAmount);
    const today = new Date().toISOString().split('T')[0];
    const currency = debt.currency;

    // Create interest transaction
    const { error: e1 } = await supabase.from('transactions').insert({
      household_id: householdId,
      type: 'expense',
      label: `Intérêts - ${debt.name}`,
      amount: Math.round(interestAmount * 100) / 100,
      currency,
      base_currency: currency,
      exchange_rate: 1,
      converted_amount: Math.round(interestAmount * 100) / 100,
      category: debt.categoryId,
      emoji: '🏦',
      date: today,
      is_auto_generated: true,
      debt_id: debt.id,
      debt_payment_type: 'interest',
    });

    // Create principal transaction
    const { error: e2 } = await supabase.from('transactions').insert({
      household_id: householdId,
      type: 'expense',
      label: `Amortissement - ${debt.name}`,
      amount: Math.round(principalAmount * 100) / 100,
      currency,
      base_currency: currency,
      exchange_rate: 1,
      converted_amount: Math.round(principalAmount * 100) / 100,
      category: debt.categoryId,
      emoji: '🏦',
      date: today,
      is_auto_generated: true,
      debt_id: debt.id,
      debt_payment_type: 'principal',
    });

    if (e1 || e2) { console.error('Generate payment error:', e1, e2); toast.error('Erreur'); return; }

    // Update remaining amount
    const newRemaining = Math.max(0, debt.remainingAmount - principalAmount);
    await supabase.from('debts').update({
      remaining_amount: Math.round(newRemaining * 100) / 100,
      last_payment_date: today,
    }).eq('id', debt.id);

    toast.success('Paiement enregistré ✓');
    onUpdated();
  };

  return (
    <AnimatePresence>
      {debt && (
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
                <h2 className="text-lg font-bold">{getDebtEmoji(debt.type)} {debt.name}</h2>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
              </div>

              <div className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Remboursé</span>
                    <span className="font-semibold">{Math.round(repaidPct)}%</span>
                  </div>
                  <Progress value={repaidPct} className="h-3" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>{formatAmount(debt.initialAmount - debt.remainingAmount)} payé</span>
                    <span>{formatAmount(debt.remainingAmount)} restant</span>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="text-sm font-medium">{typeInfo?.emoji} {typeInfo?.label}</p>
                  </div>
                  {debt.lender && (
                    <div className="bg-muted/50 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground">Prêteur</p>
                      <p className="text-sm font-medium">{debt.lender}</p>
                    </div>
                  )}
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Montant initial</p>
                    <p className="text-sm font-mono-amount font-medium">{formatAmount(debt.initialAmount)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Taux</p>
                    <p className="text-sm font-medium">{debt.interestRate}%</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Échéance</p>
                    <p className="text-sm font-mono-amount font-medium">{formatAmount(debt.paymentAmount)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Durée</p>
                    <p className="text-sm font-medium">{debt.durationYears} ans</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Signé le</p>
                    <p className="text-sm font-medium">{formatDateLong(debt.startDate)}</p>
                  </div>
                  {endDate && (
                    <div className="bg-muted/50 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground">Fin estimée</p>
                      <p className="text-sm font-medium">{formatDateLong(endDate)}</p>
                    </div>
                  )}
                </div>

                {/* Next payment breakdown */}
                <div className="card-elevated p-4">
                  <p className="text-sm font-semibold mb-3">💶 Prochaine échéance</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Intérêts</span>
                      <span className="font-mono-amount">{formatAmount(nextInterest)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Amortissement</span>
                      <span className="font-mono-amount">{formatAmount(nextPrincipal)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex items-center justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span className="font-mono-amount">{formatAmount(debt.paymentAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment history */}
                {debtTransactions.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">📜 Derniers paiements</p>
                    <div className="space-y-1.5">
                      {debtTransactions.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-xl px-3 py-2">
                          <div>
                            <span className="font-medium">{t.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">{formatDateLong(t.date)}</span>
                          </div>
                          <span className="font-mono-amount text-destructive">-{formatAmount(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3">
                <button onClick={handleGeneratePayment}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                  💶 Enregistrer un paiement
                </button>
                {!showConfirmDelete ? (
                  <button onClick={() => setShowConfirmDelete(true)}
                    className="w-full py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors">
                    🗑️ Supprimer cette dette
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DebtDetailModal;
