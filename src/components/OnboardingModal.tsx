import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const steps = [
  {
    emoji: '👋',
    title: 'Bienvenue sur FineHome !',
    description: 'Ton espace pour gérer tes finances en toute simplicité. Voici les premières étapes pour bien démarrer.',
  },
  {
    emoji: '🏦',
    title: 'Crée ton premier compte',
    description: 'Ajoute un compte bancaire (courant, épargne, carte…) pour commencer à suivre tes mouvements.',
  },
  {
    emoji: '💳',
    title: 'Enregistre tes transactions',
    description: 'Ajoute tes dépenses et revenus manuellement ou scanne un ticket de caisse avec l\'IA.',
  },
  {
    emoji: '🎯',
    title: 'Définis tes budgets',
    description: 'Fixe des limites par catégorie (alimentation, loisirs…) pour garder le contrôle chaque mois.',
  },
  {
    emoji: '🐷',
    title: 'Crée des comptes d\'épargne',
    description: 'Définis des objectifs (vacances, projet…) et suis ta progression au fil du temps.',
  },
  {
    emoji: '💡',
    title: 'Consulte tes insights',
    description: 'Après quelques semaines, FineHome t\'offrira des analyses et recommandations personnalisées. C\'est parti !',
  },
];

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

const OnboardingModal = ({ open, onComplete }: OnboardingModalProps) => {
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;
  const current = steps[step];

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const skip = () => onComplete();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm rounded-[20px] p-0 gap-0 border-none [&>button]:hidden" onPointerDownOutside={e => e.preventDefault()}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center text-center p-8"
          >
            <span className="text-5xl mb-4">{current.emoji}</span>
            <h2 className="text-lg font-bold text-foreground mb-2">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">{current.description}</p>

            {/* Progress dots */}
            <div className="flex gap-1.5 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3 w-full">
              {!isLast && (
                <Button variant="ghost" onClick={skip} className="flex-1 text-muted-foreground">
                  Passer
                </Button>
              )}
              <Button onClick={next} className="flex-1">
                {isLast ? 'C\'est parti !' : 'Suivant'}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
