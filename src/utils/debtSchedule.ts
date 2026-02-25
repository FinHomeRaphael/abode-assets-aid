import { AmortizationType, PaymentFrequency, getPeriodsPerYear } from '@/types/debt';

export interface ScheduleRow {
  period_number: number;
  due_date: string;
  capital_before: number;
  capital_after: number;
  interest_amount: number;
  principal_amount: number;
  total_amount: number;
}

interface GenerateScheduleParams {
  remainingPrincipal: number;
  interestRateAnnual: number;
  frequency: PaymentFrequency;
  repaymentMode: AmortizationType;
  paymentAmount: number;
  startDate: string; // first payment date YYYY-MM-DD
  paymentDay: number;
}

export function generateAmortizationSchedule(params: GenerateScheduleParams): ScheduleRow[] {
  const {
    remainingPrincipal,
    interestRateAnnual,
    frequency,
    repaymentMode,
    paymentAmount,
    startDate,
    paymentDay,
  } = params;

  const periodsPerYear = getPeriodsPerYear(frequency);
  const monthsIncrement = 12 / periodsPerYear;
  const ratePerPeriod = interestRateAnnual / 100 / periodsPerYear;

  const rows: ScheduleRow[] = [];
  let remaining = remainingPrincipal;

  // Parse start date
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const startObj = new Date(sy, sm - 1, sd);
  const targetDay = paymentDay;

  const getDateForPeriod = (idx: number): Date => {
    const base = new Date(startObj.getFullYear(), startObj.getMonth() + idx * monthsIncrement, 1);
    const lastDayOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(targetDay, lastDayOfMonth));
    return base;
  };

  // For fixed_annuity mode, compute annuity if not provided accurately
  // We trust paymentAmount from user input

  let periodIndex = 0;
  const maxPeriods = 600; // safety: max 50 years monthly

  while (remaining > 0.01 && periodIndex < maxPeriods) {
    const dateObj = getDateForPeriod(periodIndex);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const capitalBefore = remaining;
    const interest = Math.round(remaining * ratePerPeriod * 100) / 100;

    let principal: number;
    let total: number;

    if (repaymentMode === 'fixed_capital') {
      // Fixed capital repayment
      principal = Math.min(paymentAmount, remaining);
      total = Math.round((principal + interest) * 100) / 100;
    } else {
      // Fixed annuity (mensualité constante)
      if (remaining + interest <= paymentAmount) {
        // Last payment
        principal = remaining;
        total = Math.round((remaining + interest) * 100) / 100;
      } else {
        total = paymentAmount;
        principal = Math.round((total - interest) * 100) / 100;
      }
    }

    // Last payment adjustment
    if (principal > remaining) {
      principal = remaining;
      total = Math.round((principal + interest) * 100) / 100;
    }

    const capitalAfter = Math.max(remaining - principal, 0);

    rows.push({
      period_number: periodIndex + 1,
      due_date: dateStr,
      capital_before: Math.round(capitalBefore * 100) / 100,
      capital_after: Math.round(capitalAfter * 100) / 100,
      interest_amount: Math.round(interest * 100) / 100,
      principal_amount: Math.round(principal * 100) / 100,
      total_amount: Math.round(total * 100) / 100,
    });

    remaining = capitalAfter;
    periodIndex++;
  }

  return rows;
}
