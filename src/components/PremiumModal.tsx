import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onCheckout: (plan: 'monthly' | 'yearly') => Promise<void>;
}

const ADVANTAGES = [
  { icon: '👥', text: 'Membres du foyer illimités' },
  { icon: '📊', text: 'Budgets illimités' },
  { icon: '🎯', text: "Objectifs d'épargne illimités" },
  { icon: '💳', text: 'Suivi de dettes illimité' },
  { icon: '🏷️', text: 'Catégories personnalisées illimitées' },
  { icon: '✨', text: 'Conseiller IA sans limite' },
  { icon: '💡', text: 'Page Insights complète' },
  { icon: '📅', text: 'Historique complet' },
  { icon: '💱', text: 'Multi-devises' },
  { icon: '📋', text: 'Rapport mensuel détaillé' },
];

const PremiumModal = ({ open, onClose, onCheckout }: Props) => {
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      await onCheckout(plan);
    } catch {
      toast.error("Erreur lors de la redirection vers le paiement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="relative w-full max-w-md mx-4 mb-4 md:mb-0 card-elevated p-6 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">⭐</span>
              </div>
              <h2 className="text-xl font-bold">Premium</h2>
              <p className="text-sm text-muted-foreground mt-1">Débloquez tout le potentiel de FineHome</p>
            </div>

            {/* Advantages */}
            <div className="space-y-2.5">
              {ADVANTAGES.map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-green-500 font-bold">✅</span>
                  <span>{a.icon} {a.text}</span>
                </div>
              ))}
            </div>

            {/* Plan selection */}
            <div className="space-y-2">
              <button
                onClick={() => setPlan('yearly')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  plan === 'yearly' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">Annuel</p>
                    <p className="text-xs text-muted-foreground">39,99 €/an · soit 3,33 €/mois</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold">
                      -33%
                    </span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPlan('monthly')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  plan === 'monthly' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <div>
                  <p className="font-semibold text-sm">Mensuel</p>
                  <p className="text-xs text-muted-foreground">4,99 €/mois</p>
                </div>
              </button>
            </div>

            {/* CTA */}
            <div className="space-y-2">
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50"
              >
                {loading ? '⏳ Redirection...' : '💳 S\'abonner maintenant'}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Annulez à tout moment · Sans engagement
              </p>
            </div>

            <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xl">✕</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PremiumModal;
