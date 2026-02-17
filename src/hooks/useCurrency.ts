import { useApp } from '@/context/AppContext';
import { formatAmount as _formatAmount } from '@/utils/format';
import { useCallback } from 'react';

export function useCurrency() {
  const { household } = useApp();
  const currency = household.currency;
  
  const formatAmount = useCallback(
    (amount: number, overrideCurrency?: string) => _formatAmount(amount, overrideCurrency || currency),
    [currency]
  );

  return { formatAmount, currency };
}
