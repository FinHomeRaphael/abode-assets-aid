import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CURRENCIES, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '@/types/finance';
import { motion } from 'framer-motion';

interface GoogleProfileCompletionModalProps {
  open: boolean;
  userId: string;
  currentFirstName: string;
  onComplete: () => void;
}

const GoogleProfileCompletionModal = ({ open, userId, currentFirstName, onComplete }: GoogleProfileCompletionModalProps) => {
  const [firstName, setFirstName] = useState(currentFirstName || '');
  const [lastName, setLastName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const filteredCurrencies = CURRENCIES.filter(c => {
    const q = currencySearch.toLowerCase();
    if (!q) return true;
    return c.toLowerCase().includes(q) || (CURRENCY_NAMES[c] || '').toLowerCase().includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { toast.error('Veuillez entrer votre prénom'); return; }
    if (!lastName.trim()) { toast.error('Veuillez entrer votre nom de famille'); return; }

    setLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Get user's household and update it
      const { data: memberRow } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .single();

      if (memberRow) {
        const { error: householdError } = await supabase
          .from('households')
          .update({
            name: `Foyer ${lastName.trim()}`,
            default_currency: currency,
          })
          .eq('id', memberRow.household_id);

        if (householdError) throw householdError;
      }

      toast.success('Profil complété !');
      onComplete();
    } catch (err) {
      console.error('Profile completion error:', err);
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-[20px] p-0 gap-0 border-none [&>button]:hidden" onPointerDownOutside={e => e.preventDefault()}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8"
        >
          <div className="text-center mb-6">
            <span className="text-4xl mb-3 block">👋</span>
            <h2 className="text-lg font-bold text-foreground mb-1">Bienvenue sur FinHome !</h2>
            <p className="text-sm text-muted-foreground">Complétez votre profil pour commencer.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Thomas"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1.5">Nom</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Dupont"
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Devise principale</label>
              <button
                type="button"
                onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <span>{CURRENCY_SYMBOLS[currency] || currency} {currency} {CURRENCY_NAMES[currency] ? `— ${CURRENCY_NAMES[currency]}` : ''}</span>
                <span className="text-muted-foreground">{showCurrencyPicker ? '▲' : '▼'}</span>
              </button>
              {showCurrencyPicker && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 border border-input rounded-xl overflow-hidden bg-background">
                  <input
                    value={currencySearch}
                    onChange={e => setCurrencySearch(e.target.value)}
                    placeholder="🔍 Rechercher..."
                    className="w-full px-4 py-2.5 text-sm border-b border-input focus:outline-none"
                  />
                  <div className="max-h-36 overflow-y-auto">
                    {filteredCurrencies.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setCurrency(c); setShowCurrencyPicker(false); setCurrencySearch(''); }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-all ${
                          currency === c ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
                        }`}
                      >
                        <span>
                          <span className="font-medium">{CURRENCY_SYMBOLS[c] || c}</span>
                          <span className="ml-2 text-muted-foreground">{c}</span>
                          {CURRENCY_NAMES[c] && <span className="ml-2 text-xs text-muted-foreground">— {CURRENCY_NAMES[c]}</span>}
                        </span>
                        {currency === c && <span className="text-primary">✓</span>}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full py-3 rounded-xl">
              {loading ? 'Enregistrement...' : 'Continuer'}
            </Button>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default GoogleProfileCompletionModal;
