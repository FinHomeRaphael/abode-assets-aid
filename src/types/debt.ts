export type DebtType = 'mortgage' | 'auto' | 'consumer' | 'student' | 'other';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
export type AmortizationType = 'fixed_annuity' | 'fixed_capital';

export type MortgageSystem = 'swiss' | 'europe';
export type RateType = 'fixed' | 'variable';
export type SwissAmortizationType = 'none' | 'direct' | 'indirect';

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
  amortizationType: AmortizationType;
  categoryId?: string;
  accountId?: string;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
  scope?: 'household' | 'personal';
  createdBy?: string;
  // Mortgage-specific
  mortgageSystem?: MortgageSystem;
  rateType?: RateType;
  rateEndDate?: string;
  propertyValue?: number;
  annualAmortization?: number;
  swissAmortizationType?: SwissAmortizationType;
  includeMaintenance?: boolean;
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
  const ny = next.getFullYear();
  const nm = String(next.getMonth() + 1).padStart(2, '0');
  const nd = String(next.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
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
    const ey = end.getFullYear(); const em = String(end.getMonth() + 1).padStart(2, '0'); const ed = String(end.getDate()).padStart(2, '0');
    return `${ey}-${em}-${ed}`;
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
  const ey2 = end.getFullYear(); const em2 = String(end.getMonth() + 1).padStart(2, '0'); const ed2 = String(end.getDate()).padStart(2, '0');
  return `${ey2}-${em2}-${ed2}`;
}

/**
 * Calculate payment breakdown for a given period based on amortization type.
 * - fixed_annuity: total payment is fixed (= paymentAmount), capital = total - interest
 * - fixed_capital: capital is fixed (= paymentAmount), total = capital + interest
 */
export function calculatePaymentBreakdown(
  remaining: number,
  paymentAmount: number,
  rate: number, // per-period rate (e.g. annual_rate / 100 / periods_per_year)
  amortizationType: AmortizationType
): { interest: number; capital: number; totalPayment: number } {
  const interest = remaining * rate;
  if (amortizationType === 'fixed_capital') {
    // Capital is fixed, total varies
    const capital = Math.min(paymentAmount, remaining);
    return { interest, capital, totalPayment: capital + interest };
  }
  // fixed_annuity: total is fixed, capital varies
  const totalPayment = Math.min(paymentAmount, remaining + interest);
  const capital = Math.max(totalPayment - interest, 0);
  return { interest, capital, totalPayment };
}
