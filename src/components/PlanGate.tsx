import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Crown } from 'lucide-react';
import { useSubscription, PlanType } from '@/hooks/useSubscription';

interface PlanGateProps {
  children: React.ReactNode;
  /** Minimum plan required: 'foyer' or 'famille' */
  requiredPlan?: 'foyer' | 'famille';
  /** Message shown when blocked */
  message?: string;
  /** CTA text */
  ctaText?: string;
  /** CTA target plan label */
  ctaPlan?: string;
  /** Mode: 'block' hides content, 'overlay' blurs it */
  mode?: 'block' | 'overlay';
}

export const PlanGate = ({
  children,
  requiredPlan = 'foyer',
  message,
  ctaText,
  ctaPlan,
  mode = 'overlay',
}: PlanGateProps) => {
  const { plan, loading } = useSubscription();
  const navigate = useNavigate();

  const hasAccess = () => {
    if (loading) return true;
    if (requiredPlan === 'foyer') return plan === 'foyer' || plan === 'famille';
    if (requiredPlan === 'famille') return plan === 'famille';
    return true;
  };

  if (hasAccess()) return <>{children}</>;

  const defaultCta = requiredPlan === 'famille' ? 'Découvrir le plan Famille →' : 'Découvrir le plan Foyer →';
  const displayMessage = message || `Cette fonctionnalité est disponible avec le plan ${requiredPlan === 'famille' ? 'Famille' : 'Foyer'}.`;

  if (mode === 'block') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
          <Lock className="w-7 h-7 text-white" />
        </div>
        <p className="text-sm text-muted-foreground max-w-sm">{displayMessage}</p>
        <button
          onClick={() => navigate('/pricing')}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-md"
        >
          {ctaText || defaultCta}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none blur-[2px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/60 backdrop-blur-sm rounded-xl">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">{displayMessage}</p>
          <button
            onClick={() => navigate('/pricing')}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-md"
          >
            {ctaText || defaultCta}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Simple inline limit message for when user tries to add beyond limits */
export const LimitMessage = ({
  message,
  ctaText,
}: {
  message: string;
  ctaText?: string;
}) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-3 p-5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <Lock className="w-4 h-4" />
        <span className="text-sm font-medium">Limite atteinte</span>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        onClick={() => navigate('/pricing')}
        className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        {ctaText || 'Voir les plans →'}
      </button>
    </div>
  );
};

export default PlanGate;
