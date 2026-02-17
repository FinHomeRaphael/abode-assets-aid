import React from 'react';
import { formatAmount } from '@/utils/format';

interface Props {
  amount: number;
  originalCurrency: string;
  householdCurrency: string;
  convert: (amount: number, from: string, to?: string) => number;
  type?: 'income' | 'expense';
  className?: string;
}

const ConvertedAmount = ({ amount, originalCurrency, householdCurrency, convert, type, className = '' }: Props) => {
  const sign = type === 'income' ? '+' : type === 'expense' ? '-' : '';
  const needsConversion = originalCurrency !== householdCurrency;
  const convertedAmount = needsConversion ? convert(amount, originalCurrency, householdCurrency) : amount;

  return (
    <div className={`text-right ${className}`}>
      <span className={`font-mono-amount text-sm font-bold block ${type === 'income' ? 'text-success' : ''}`}>
        {sign}{formatAmount(convertedAmount, householdCurrency)}
      </span>
      {needsConversion && (
        <span className="font-mono-amount text-[10px] text-muted-foreground block">
          {sign}{formatAmount(amount, originalCurrency)}
        </span>
      )}
    </div>
  );
};

export default ConvertedAmount;
