import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

const Onboarding = () => {
  const { completeOnboarding } = useApp();
  const [householdName, setHouseholdName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinish = async () => {
    if (!householdName) { toast.error('Veuillez nommer votre foyer'); return; }
    setIsSubmitting(true);
    try {
      await completeOnboarding(householdName, 'EUR');
      toast.success('Bienvenue sur FineHome ! 🎉');
    } catch (err: any) {
      console.error('Onboarding error:', err);
      toast.error('Erreur : ' + (err?.message || 'inconnue'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold mx-auto mb-3">F</div>
          <h1 className="text-xl font-bold">Configuration du foyer</h1>
        </div>

        <div className="card-elevated p-8">
          <h2 className="text-lg font-bold mb-1">Nommez votre foyer</h2>
          <p className="text-sm text-muted-foreground mb-4">Comment s'appelle votre famille ou foyer ?</p>
          <input
            type="text"
            value={householdName}
            onChange={e => setHouseholdName(e.target.value)}
            placeholder="Famille Dupont"
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleFinish}
            disabled={isSubmitting}
            className="w-full mt-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Création...' : 'Commencer 🚀'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
