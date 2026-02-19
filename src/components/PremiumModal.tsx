import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface Props {
  open: boolean;
  onClose: () => void;
  presentOffering: (container: HTMLElement) => Promise<any>;
}

const PremiumModal = ({ open, onClose, presentOffering }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [paywallActive, setPaywallActive] = useState(false);

  const handleShowPaywall = async () => {
    setPaywallActive(true);
    setLoading(true);
    // Wait for container to mount
    setTimeout(async () => {
      if (containerRef.current) {
        try {
          await presentOffering(containerRef.current);
        } catch (err) {
          console.error('Paywall error:', err);
        } finally {
          setLoading(false);
          setPaywallActive(false);
          onClose();
        }
      } else {
        setLoading(false);
        setPaywallActive(false);
      }
    }, 150);
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
            {paywallActive ? (
              <>
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold">⭐ Premium</h2>
                  {loading && <p className="text-sm text-muted-foreground mt-2">Chargement des offres...</p>}
                </div>
                <div ref={containerRef} className="min-h-[200px]" />
              </>
            ) : (
              <>
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

                {/* CTA */}
                <div className="space-y-2">
                  <button
                    onClick={handleShowPaywall}
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50"
                  >
                    {loading ? '⏳ Chargement...' : '💳 Voir les offres'}
                  </button>
                  <p className="text-center text-xs text-muted-foreground">
                    Annulez à tout moment · Sans engagement
                  </p>
                </div>
              </>
            )}

            <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xl">✕</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PremiumModal;
