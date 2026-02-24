import { supabase } from '@/integrations/supabase/client';
import { getPeriodsPerYear } from '@/types/debt';

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

/**
 * After modifying a single schedule row (interest/principal), recalculate all subsequent rows.
 * Updates the DB for the modified row + all following rows.
 * Returns the updated schedule array.
 */
export async function recalculateScheduleFromRow(
  schedule: ScheduleRow[],
  modifiedIndex: number,
  newInterest: number,
  newPrincipal: number,
  debtId: string,
  annualRate: number,
  frequency: string,
  amortizationType: string,
  paymentAmount: number,
): Promise<ScheduleRow[]> {
  const updated = [...schedule];
  const row = { ...updated[modifiedIndex] };

  // Update the modified row
  row.interest_amount = Math.round(newInterest * 100) / 100;
  row.principal_amount = Math.round(newPrincipal * 100) / 100;
  row.total_amount = Math.round((newInterest + newPrincipal) * 100) / 100;
  row.capital_after = Math.round(Math.max(row.capital_before - newPrincipal, 0) * 100) / 100;
  row.status = row.status === 'paye' ? 'paye' : 'ajuste';
  updated[modifiedIndex] = row;

  // Recalculate all subsequent rows
  const periodsPerYear = getPeriodsPerYear(frequency as any);
  const ratePerPeriod = annualRate / 100 / periodsPerYear;

  for (let i = modifiedIndex + 1; i < updated.length; i++) {
    const prev = updated[i - 1];
    const current = { ...updated[i] };

    current.capital_before = prev.capital_after;

    if (current.capital_before <= 0.01) {
      // Debt is paid off, zero out remaining rows
      current.capital_before = 0;
      current.interest_amount = 0;
      current.principal_amount = 0;
      current.total_amount = 0;
      current.capital_after = 0;
    } else {
      const interest = Math.round(current.capital_before * ratePerPeriod * 100) / 100;
      current.interest_amount = interest;

      if (amortizationType === 'fixed_capital') {
        const principal = Math.min(paymentAmount, current.capital_before);
        current.principal_amount = Math.round(principal * 100) / 100;
        current.total_amount = Math.round((interest + principal) * 100) / 100;
      } else {
        // fixed_annuity
        const total = Math.min(paymentAmount, current.capital_before + interest);
        current.total_amount = Math.round(total * 100) / 100;
        current.principal_amount = Math.round(Math.max(total - interest, 0) * 100) / 100;
      }

      current.capital_after = Math.round(Math.max(current.capital_before - current.principal_amount, 0) * 100) / 100;
    }

    // Only recalculate non-paid rows (keep paid rows' status)
    if (current.status !== 'paye') {
      current.status = 'prevu';
    }

    updated[i] = current;
  }

  // Batch update all changed rows in DB
  const rowsToUpdate = updated.slice(modifiedIndex);
  const promises = rowsToUpdate.map(r =>
    supabase.from('debt_schedules').update({
      capital_before: r.capital_before,
      capital_after: r.capital_after,
      interest_amount: r.interest_amount,
      principal_amount: r.principal_amount,
      total_amount: r.total_amount,
      status: r.status,
    }).eq('id', r.id)
  );
  await Promise.all(promises);

  // Update remaining_amount on debt to last row's capital_after
  const lastRow = updated[updated.length - 1];
  await supabase.from('debts').update({
    remaining_amount: lastRow.capital_after,
  }).eq('id', debtId);

  return updated;
}
