import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Crown, Check, X } from 'lucide-react';
import { useSubscription, PLAN_PRICES } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

interface PaywallProps {
  children: React.ReactNode;
  feature: string;
  description?: string;
}

export const PremiumGate = ({ children, feature, description }: PaywallProps) => {
  const { isPremium, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading || isPremium) return <>{children}</>;

  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none blur-[2px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/60 backdrop-blur-sm rounded-xl">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base">Fonctionnalité Premium</h3>
            <p className="text-sm text-muted-foreground mt-1">{description || `Passez au plan Foyer pour débloquer ${feature}`}</p>
          </div>
          <button
            onClick={() => navigate('/pricing')}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-md"
          >
            Découvrir les plans →
          </button>
        </div>
      </div>
    </div>
  );
};

type BillingPeriod = 'monthly' | 'yearly' | 'lifetime';

export const PaywallModal = ({ open, onClose, feature, description }: { open: boolean; onClose: () => void; feature: string; description?: string }) => {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-foreground/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-xl font-bold mb-1">Passez au plan supérieur</h2>
              <p className="text-sm text-muted-foreground mb-5">
                {description || `Débloquez ${feature} et bien plus encore.`}
              </p>

              <div className="bg-secondary/50 rounded-xl p-4 mb-5 space-y-2.5">
                <div className="flex items-center gap-2.5 text-sm"><Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /><span>Comptes et budgets illimités</span></div>
                <div className="flex items-center gap-2.5 text-sm"><Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /><span>Coach IA personnalisé</span></div>
                <div className="flex items-center gap-2.5 text-sm"><Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /><span>Rapports mensuels détaillés</span></div>
                <div className="flex items-center gap-2.5 text-sm"><Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /><span>Dettes & crédits</span></div>
                <div className="flex items-center gap-2.5 text-sm"><Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /><span>Partagé avec tout le foyer</span></div>
              </div>

              <button
                onClick={() => { onClose(); navigate('/pricing'); }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-md"
              >
                Voir les plans →
              </button>

              <p className="text-[10px] text-muted-foreground text-center mt-3">
                À partir de 5,82€/mois. Annulable à tout moment.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const PremiumLock = ({ feature, description }: { feature: string; description?: string }) => {
  const [showPaywall, setShowPaywall] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowPaywall(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
      >
        <Lock className="w-3 h-3" />
        Premium
      </button>
      <PaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={feature}
        description={description}
      />
    </>
  );
};

export default PremiumGate;
