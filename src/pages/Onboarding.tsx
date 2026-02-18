import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { CURRENCIES, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '@/types/finance';
import { toast } from 'sonner';

const Onboarding = () => {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [householdName, setHouseholdName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [currencySearch, setCurrencySearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinish = async () => {
    if (!householdName) { toast.error('Veuillez nommer votre foyer'); return; }
    setIsSubmitting(true);
    try {
      await completeOnboarding(householdName, currency);
      toast.success('Bienvenue sur FineHome ! 🎉');
    } catch (err) {
      toast.error('Erreur lors de la configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold mx-auto mb-3">F</div>
          <h1 className="text-xl font-bold">Configuration du foyer</h1>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 w-12 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        </div>

        <div className="card-elevated p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-lg font-bold mb-1">Nommez votre foyer</h2>
                <p className="text-sm text-muted-foreground mb-4">Comment s'appelle votre famille ou foyer ?</p>
                <input type="text" value={householdName} onChange={e => setHouseholdName(e.target.value)} placeholder="Famille Dupont" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <button onClick={() => householdName ? setStep(2) : toast.error('Entrez un nom')} className="w-full mt-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">Continuer</button>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-lg font-bold mb-1">Devise principale</h2>
                <p className="text-sm text-muted-foreground mb-3">Quelle devise utilisez-vous ?</p>
                <input
                  value={currencySearch}
                  onChange={e => setCurrencySearch(e.target.value)}
                  placeholder="🔍 Rechercher une devise..."
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-2"
                />
                <div className="max-h-48 overflow-y-auto space-y-0.5 mb-4">
                  {CURRENCIES.filter(c => {
                    const q = currencySearch.toLowerCase();
                    if (!q) return true;
                    return c.toLowerCase().includes(q) || (CURRENCY_NAMES[c] || '').toLowerCase().includes(q);
                  }).map(c => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all text-left ${
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
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Retour</button>
                  <button
                    onClick={handleFinish}
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Création...' : 'Commencer 🚀'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
