import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatLocalDate } from '@/utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddTransferModal = ({ open, onClose }: Props) => {
  const { addTransaction, household, getActiveAccounts } = useApp();
  const activeAccounts = getActiveAccounts();

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [memberId, setMemberId] = useState(household.members[0]?.id || '');

  const fromAccount = activeAccounts.find(a => a.id === fromAccountId);
  const toAccount = activeAccounts.find(a => a.id === toAccountId);

  const handleSubmit = () => {
    if (!fromAccountId || !toAccountId) {
      toast.error('Veuillez sélectionner les deux comptes');
      return;
    }
    if (fromAccountId === toAccountId) {
      toast.error('Les comptes source et destination doivent être différents');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    const parsedAmount = parseFloat(amount);
    const transferId = crypto.randomUUID().slice(0, 8);
    const dateStr = formatLocalDate(date);
    const fromAcc = activeAccounts.find(a => a.id === fromAccountId)!;
    const toAcc = activeAccounts.find(a => a.id === toAccountId)!;
    const noteText = notes.trim() ? `${notes.trim()} [Transfert #${transferId}]` : `Transfert #${transferId}`;

    // Expense from source account
    addTransaction({
      type: 'expense',
      label: `Transfert → ${toAcc.name}`,
      amount: parsedAmount,
      currency: fromAcc.currency,
      category: 'Transfert',
      memberId,
      date: dateStr,
      notes: noteText,
      emoji: '🔄',
      isRecurring: false,
      accountId: fromAccountId,
    });

    // Income to destination account
    addTransaction({
      type: 'income',
      label: `Transfert ← ${fromAcc.name}`,
      amount: parsedAmount,
      currency: toAcc.currency,
      category: 'Transfert',
      memberId,
      date: dateStr,
      notes: noteText,
      emoji: '🔄',
      isRecurring: false,
      accountId: toAccountId,
    });

    toast.success('Transfert effectué ✓');
    resetAndClose();
  };

  const resetAndClose = () => {
    setFromAccountId('');
    setToAccountId('');
    setAmount('');
    setNotes('');
    setDate(new Date());
    onClose();
  };

  if (!open) return null;

  const availableToAccounts = activeAccounts.filter(a => a.id !== fromAccountId);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={resetAndClose}
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-lg border border-border shadow-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">🔄 Transfert entre comptes</h2>
              <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            {activeAccounts.length < 2 ? (
              <div className="p-4 rounded-md border border-border bg-muted/50 text-sm text-muted-foreground text-center">
                💡 Vous devez avoir au moins 2 comptes actifs pour effectuer un transfert.
              </div>
            ) : (
              <div className="space-y-4">
                {/* From Account */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Depuis le compte *</label>
                  <select
                    value={fromAccountId}
                    onChange={e => {
                      setFromAccountId(e.target.value);
                      if (e.target.value === toAccountId) setToAccountId('');
                    }}
                    className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sélectionner...</option>
                    {activeAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">↓</div>
                </div>

                {/* To Account */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Vers le compte *</label>
                  <select
                    value={toAccountId}
                    onChange={e => setToAccountId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sélectionner...</option>
                    {availableToAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Montant *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {fromAccount && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {fromAccount.currency}
                      </span>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring">
                        {format(date, 'dd MMMM yyyy', { locale: fr })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Member */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Membre</label>
                  <div className="flex gap-2">
                    {household.members.map(m => (
                      <button key={m.id} onClick={() => setMemberId(m.id)} className={`px-3 py-2 rounded-md border text-sm transition-colors ${memberId === m.id ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-secondary'}`}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notes optionnelles..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>

                {/* Summary */}
                {fromAccount && toAccount && amount && parseFloat(amount) > 0 && (
                  <div className="p-3 rounded-md border border-primary/20 bg-primary/5 text-sm">
                    <p className="font-medium text-primary">Résumé du transfert</p>
                    <p className="text-muted-foreground mt-1">
                      {parseFloat(amount).toFixed(2)} {fromAccount.currency} de <strong>{fromAccount.name}</strong> vers <strong>{toAccount.name}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={resetAndClose} className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">Annuler</button>
              <button
                onClick={handleSubmit}
                disabled={activeAccounts.length < 2}
                className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Transférer
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AddTransferModal;
