import React from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

interface Props {
  currentMonth: Date;
  onChange: (d: Date) => void;
}

const MonthSelector = ({ currentMonth, onChange }: Props) => {
  const { householdId } = useApp();
  const { isMonthAllowed, isPremium } = useSubscription(householdId);
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentMonth);

  const prev = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    if (!isMonthAllowed(d)) {
      toast.error('🔒 Historique limité à 3 mois avec le plan gratuit');
      return;
    }
    onChange(d);
  };

  const next = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    onChange(d);
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={prev} className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors text-sm">←</button>
      <span className="text-sm font-medium capitalize min-w-[160px] text-center">{label}</span>
      <button onClick={next} className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors text-sm">→</button>
    </div>
  );
};

export default MonthSelector;
