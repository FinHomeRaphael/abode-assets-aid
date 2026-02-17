import React from 'react';
import { formatAmount } from '@/utils/format';
import { Transaction } from '@/types/finance';

interface Props {
  transaction: Transaction;
  className?: string;
}

const ConvertedAmount = ({ transaction: t, className = '' }: Props) => {
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '';
  const needsConversion = t.currency !== t.baseCurrency;

  return (
    <div className={`text-right ${className}`}>
      <span className={`font-mono-amount text-sm font-bold block ${t.type === 'income' ? 'text-success' : ''}`}>
        {sign}{formatAmount(t.convertedAmount, t.baseCurrency)}
      </span>
      {needsConversion && (
        <span className="font-mono-amount text-[10px] text-muted-foreground block">
          ({sign}{formatAmount(t.amount, t.currency)})
        </span>
      )}
    </div>
  );
};

export default ConvertedAmount;
