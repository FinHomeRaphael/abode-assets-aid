import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  feature: string;
  limit: number | string;
  icon?: string;
}

const PaywallModal = ({ open, onClose, onUpgrade, feature, limit, icon = '🔒' }: Props) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-sm card-elevated p-6 text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">{icon}</span>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-1">Limite atteinte</h3>
              <p className="text-sm text-muted-foreground">
                Tu as atteint la limite de {limit} {feature} avec le plan gratuit.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Passe à Premium pour débloquer l'accès illimité à toutes les fonctionnalités.
            </p>

            <div className="space-y-2">
              <button
                onClick={onUpgrade}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                ⭐ Passer à Premium
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Pas maintenant
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PaywallModal;
