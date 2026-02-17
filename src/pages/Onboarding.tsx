import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { CURRENCIES } from '@/types/finance';
import { toast } from 'sonner';

const Onboarding = () => {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [householdName, setHouseholdName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invites, setInvites] = useState<string[]>([]);
  const [currency, setCurrency] = useState('EUR');

  const handleInvite = () => {
    if (inviteEmail && !invites.includes(inviteEmail)) {
      setInvites([...invites, inviteEmail]);
      setInviteEmail('');
      toast.success('Invitation envoyée !');
    }
  };

  const handleFinish = () => {
    if (!householdName) {
      toast.error('Veuillez nommer votre foyer');
      return;
    }
    completeOnboarding(householdName, currency);
    toast.success('Bienvenue sur FineHome ! 🎉');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">🏠 Configuration du foyer</h1>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 w-12 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-8 shadow-sm">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-lg font-semibold mb-1">Nommez votre foyer</h2>
                <p className="text-sm text-muted-foreground mb-4">Comment s'appelle votre famille ou foyer ?</p>
                <input
                  type="text"
                  value={householdName}
                  onChange={e => setHouseholdName(e.target.value)}
                  placeholder="Famille Dupont"
                  className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button onClick={() => householdName ? setStep(2) : toast.error('Entrez un nom')} className="w-full mt-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
                  Continuer
                </button>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-lg font-semibold mb-1">Invitez des membres</h2>
                <p className="text-sm text-muted-foreground mb-4">Ajoutez les membres de votre foyer</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    className="flex-1 px-4 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button onClick={handleInvite} className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                    Inviter
                  </button>
                </div>
                {invites.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {invites.map(e => (
                      <div key={e} className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary text-sm">
                        <span>{e}</span>
                        <span className="text-muted-foreground text-xs">Invité ✓</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">Retour</button>
                  <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Continuer</button>
                </div>
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-lg font-semibold mb-1">Devise principale</h2>
                <p className="text-sm text-muted-foreground mb-4">Quelle devise utilisez-vous ?</p>
                <div className="grid grid-cols-2 gap-2">
                  {CURRENCIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={`py-3 rounded-md border text-sm font-medium transition-colors ${
                        currency === c ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-secondary'
                      }`}
                    >
                      {c === 'EUR' ? '🇪🇺 EUR' : c === 'USD' ? '🇺🇸 USD' : c === 'GBP' ? '🇬🇧 GBP' : '🇨🇭 CHF'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">Retour</button>
                  <button onClick={handleFinish} className="flex-1 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Commencer 🚀</button>
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
