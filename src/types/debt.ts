export type DebtType = 'mortgage' | 'auto' | 'consumer' | 'student' | 'other';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'semi-annual' | 'annual';

export interface Debt {
  id: string;
  householdId: string;
  type: DebtType;
  name: string;
  lender?: string;
  initialAmount: number;
  remainingAmount: number;
  currency: string;
  interestRate: number;
  durationYears: number;
  startDate: string;
  paymentFrequency: PaymentFrequency;
  paymentDay: number;
  paymentAmount: number;
  categoryId?: string;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export const DEBT_TYPES: { value: DebtType; label: string; emoji: string }[] = [
  { value: 'mortgage', label: 'Immobilier', emoji: '🏠' },
  { value: 'auto', label: 'Auto', emoji: '🚗' },
  { value: 'consumer', label: 'Consommation', emoji: '💳' },
  { value: 'student', label: 'Étudiant', emoji: '🎓' },
  { value: 'other', label: 'Autre', emoji: '📦' },
];

export const PAYMENT_FREQUENCIES: { value: PaymentFrequency; label: string; periodsPerYear: number }[] = [
  { value: 'monthly', label: 'Mensuel', periodsPerYear: 12 },
  { value: 'quarterly', label: 'Trimestriel', periodsPerYear: 4 },
  { value: 'semi-annual', label: 'Semestriel', periodsPerYear: 2 },
  { value: 'annual', label: 'Annuel', periodsPerYear: 1 },
];

export function getDebtEmoji(type: DebtType): string {
  return DEBT_TYPES.find(t => t.value === type)?.emoji || '📦';
}

export function getPeriodsPerYear(frequency: PaymentFrequency): number {
  return PAYMENT_FREQUENCIES.find(f => f.value === frequency)?.periodsPerYear || 12;
}

export function calculateNextPaymentDate(debt: Debt): string | undefined {
  if (debt.remainingAmount <= 0) return undefined;
  const now = new Date();
  const day = debt.paymentDay;
  const freq = debt.paymentFrequency;
  
  let next = new Date(now.getFullYear(), now.getMonth(), day);
  if (next <= now) {
    if (freq === 'monthly') next.setMonth(next.getMonth() + 1);
    else if (freq === 'quarterly') next.setMonth(next.getMonth() + 3);
    else if (freq === 'semi-annual') next.setMonth(next.getMonth() + 6);
    else next.setFullYear(next.getFullYear() + 1);
  }
  return next.toISOString().split('T')[0];
}

export function estimateEndDate(debt: Debt): string | undefined {
  if (debt.remainingAmount <= 0 || debt.paymentAmount <= 0) return undefined;
  const periodsPerYear = getPeriodsPerYear(debt.paymentFrequency);
  const rate = debt.interestRate / 100 / periodsPerYear;
  
  if (rate === 0) {
    const periods = Math.ceil(debt.remainingAmount / debt.paymentAmount);
    const months = Math.ceil(periods * (12 / periodsPerYear));
    const end = new Date();
    end.setMonth(end.getMonth() + months);
    return end.toISOString().split('T')[0];
  }
  
  // Use amortization formula to find remaining periods
  const monthlyInterest = debt.remainingAmount * rate;
  if (debt.paymentAmount <= monthlyInterest) return undefined; // Can't pay off
  
  const periods = Math.ceil(
    -Math.log(1 - (debt.remainingAmount * rate) / debt.paymentAmount) / Math.log(1 + rate)
  );
  const months = Math.ceil(periods * (12 / periodsPerYear));
  const end = new Date();
  end.setMonth(end.getMonth() + months);
  return end.toISOString().split('T')[0];
}
