import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Crown, Check, X, Infinity as InfinityIcon } from 'lucide-react';
import { useSubscription, PREMIUM_PRICES } from '@/hooks/useSubscription';

interface PaywallProps {
  children: React.ReactNode;
  feature: string;
  description?: string;
}

const PremiumBadge = ({ onClick, className }: { onClick: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors ${className || ''}`}
  >
    <Lock className="w-3 h-3" />
    Premium
  </button>
);

export const PremiumLock = ({ feature, description }: { feature: string; description?: string }) => {
  const [showPaywall, setShowPaywall] = useState(false);

  return (
    <>
      <PremiumBadge onClick={() => setShowPaywall(true)} />
      <PaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={feature}
        description={description}
      />
    </>
  );
};

export const PremiumGate = ({ children, feature, description }: PaywallProps) => {
  const { isPremium, loading } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  if (loading || isPremium) return <>{children}</>;

  return (
    <>
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
              <p className="text-sm text-muted-foreground mt-1">{description || `Passez à Premium pour débloquer ${feature}`}</p>
            </div>
            <button
              onClick={() => setShowPaywall(true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-md"
            >
              Débloquer Premium
            </button>
          </div>
        </div>
      </div>
      <PaywallModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={feature}
        description={description}
      />
    </>
  );
};

type BillingPeriod = 'monthly' | 'yearly' | 'lifetime';

export const PaywallModal = ({ open, onClose, feature, description }: { open: boolean; onClose: () => void; feature: string; description?: string }) => {
  const { startCheckout } = useSubscription();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const [loading, setLoading] = useState(false);

  const currentPrice = PREMIUM_PRICES[billingPeriod];

  const handleSubscribe = async () => {
    setLoading(true);
    await startCheckout(currentPrice.priceId);
    setLoading(false);
  };

  const features = [
    'Dettes & crédits illimités',
    'Insights & analyses avancées',
    'Rapport mensuel détaillé',
    'Comptes bancaires illimités',
    'Comptes d\'épargne illimités',
    'Budgets illimités',
    'Premium partagé avec tout le foyer',
  ];

  const priceLabel = () => {
    switch (billingPeriod) {
      case 'monthly': return `${currentPrice.amount.toFixed(2).replace('.', ',')}€/mois`;
      case 'yearly': return `${currentPrice.amount.toFixed(2).replace('.', ',')}€/an`;
      case 'lifetime': return `${currentPrice.amount.toFixed(2).replace('.', ',')}€ une fois`;
    }
  };

  const periodSuffix = () => {
    switch (billingPeriod) {
      case 'monthly': return '/mois';
      case 'yearly': return '/an';
      case 'lifetime': return ' une fois';
    }
  };

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
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-xl font-bold mb-1">Passez à Premium</h2>
              <p className="text-sm text-muted-foreground mb-5">
                {description || `Débloquez ${feature} et toutes les fonctionnalités avancées pour tout votre foyer.`}
              </p>

              {/* Billing toggle - 3 options */}
              <div className="flex bg-secondary rounded-xl p-1 mb-5 gap-0.5">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${billingPeriod === 'monthly' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setBillingPeriod('yearly')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${billingPeriod === 'yearly' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
                >
                  Annuel
                  <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold">-17%</span>
                </button>
                <button
                  onClick={() => setBillingPeriod('lifetime')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${billingPeriod === 'lifetime' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
                >
                  À vie
                  <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold">∞</span>
                </button>
              </div>

              {/* Price */}
              <div className="text-center mb-5">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold">
                    {currentPrice.amount.toFixed(2).replace('.', ',')}€
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {periodSuffix()}
                  </span>
                </div>
                {billingPeriod === 'yearly' && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    soit 4,99€/mois — vous économisez 12€/an
                  </p>
                )}
                {billingPeriod === 'lifetime' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    = prix de 2 ans — Premium pour toujours 🎉
                  </p>
                )}
              </div>

              {/* Features */}
              <div className="bg-secondary/50 rounded-xl p-4 mb-5 space-y-2.5">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-50"
              >
                {loading ? 'Redirection...' : `S'abonner — ${priceLabel()}`}
              </button>

              <p className="text-[10px] text-muted-foreground text-center mt-3">
                {billingPeriod === 'lifetime' ? 'Paiement unique. Accès à vie.' : 'Annulable à tout moment.'} Paiement sécurisé par Stripe.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PremiumGate;
