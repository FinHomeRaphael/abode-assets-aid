import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, X, Crown, Lock, Star, Users, Sparkles } from 'lucide-react';
import { useSubscription, PLAN_PRICES, PlanType } from '@/hooks/useSubscription';
import Layout from '@/components/Layout';
import BackHeader from '@/components/BackHeader';

type BillingPeriod = 'monthly' | 'yearly';

const Pricing = () => {
  const navigate = useNavigate();
  const { plan: currentPlan, startCheckout, loading } = useSubscription();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleCheckout = async (planKey: 'foyer' | 'famille', period: BillingPeriod | 'lifetime') => {
    const priceId = PLAN_PRICES[planKey][period].priceId;
    setCheckoutLoading(`${planKey}-${period}`);
    await startCheckout(priceId);
    setCheckoutLoading(null);
  };

  const foyerPrice = PLAN_PRICES.foyer[billingPeriod];
  const famillePrice = PLAN_PRICES.famille[billingPeriod];

  const foyerMonthly = billingPeriod === 'yearly' ? (foyerPrice.amount / 12).toFixed(2).replace('.', ',') : foyerPrice.amount.toFixed(2).replace('.', ',');
  const familleMonthly = billingPeriod === 'yearly' ? (famillePrice.amount / 12).toFixed(2).replace('.', ',') : famillePrice.amount.toFixed(2).replace('.', ',');

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6 pb-8">
        <BackHeader title="Choisir un plan" />

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Le bon plan pour votre foyer</h1>
          <p className="text-muted-foreground text-sm">Commencez gratuitement, évoluez quand vous le souhaitez</p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center">
          <div className="flex bg-secondary rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${billingPeriod === 'monthly' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${billingPeriod === 'yearly' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
            >
              Annuel
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold">-17%</span>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* FREE */}
          <div className="card-elevated p-5 rounded-2xl flex flex-col">
            <div className="mb-4">
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">Pour découvrir</span>
            </div>
            <h3 className="text-lg font-bold mb-1">Gratuit</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold">0€</span>
            </div>
            <div className="space-y-2.5 flex-1 mb-5">
              <Feature included text="1 compte bancaire" />
              <Feature included text="2 budgets" />
              <Feature included text="Transactions illimitées" />
              <Feature included text="Score Santé Financière" />
              <Feature included={false} text="Coach IA" />
              <Feature included={false} text="Rapports mensuels" />
              <Feature included={false} text="Scanner de reçus" />
              <Feature included={false} text="Invitation de membres" />
              <Feature included={false} text="Dettes & Crédits (ajout)" />
            </div>
            {currentPlan === 'free' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-medium cursor-default">Plan actuel</button>
            ) : (
              <div />
            )}
          </div>

          {/* FOYER - highlighted */}
          <div className="card-elevated p-5 rounded-2xl flex flex-col border-2 border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1">
                <Star className="w-3 h-3" /> Le plus populaire
              </span>
            </div>
            <div className="mb-4 mt-1">
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">Foyer</span>
            </div>
            <h3 className="text-lg font-bold mb-1">FinHome Foyer</h3>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold">{foyerMonthly}€</span>
              <span className="text-muted-foreground text-sm">/mois</span>
            </div>
            {billingPeriod === 'yearly' && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-4">soit {foyerPrice.amount.toFixed(2).replace('.', ',')}€/an — 2 mois offerts</p>
            )}
            {billingPeriod === 'monthly' && <div className="mb-4" />}
            <div className="space-y-2.5 flex-1 mb-5">
              <Feature included text="Comptes bancaires illimités" />
              <Feature included text="Budgets illimités" />
              <Feature included text="Coach IA (30 conv./mois)" />
              <Feature included text="Rapports mensuels" />
              <Feature included text="Scanner de reçus" />
              <Feature included text="Dettes & Crédits" />
              <Feature included text="Jusqu'à 2 membres" />
              <Feature included text="Transactions récurrentes" />
              <Feature included text="Mode Foyer / Perso" />
            </div>
            {currentPlan === 'foyer' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-primary/20 text-primary text-sm font-semibold cursor-default">Plan actuel</button>
            ) : (
              <button
                onClick={() => handleCheckout('foyer', billingPeriod)}
                disabled={!!checkoutLoading}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {checkoutLoading?.startsWith('foyer') ? 'Redirection...' : 'Choisir Foyer'}
              </button>
            )}
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              ou en paiement unique : {PLAN_PRICES.foyer.lifetime.amount.toFixed(2).replace('.', ',')}€
              <button onClick={() => handleCheckout('foyer', 'lifetime')} className="text-primary ml-1 underline">→ Acheter</button>
            </p>
          </div>

          {/* FAMILLE */}
          <div className="card-elevated p-5 rounded-2xl flex flex-col">
            <div className="mb-4">
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 w-fit">
                <Users className="w-3 h-3" /> Pour toute la famille
              </span>
            </div>
            <h3 className="text-lg font-bold mb-1">FinHome Famille</h3>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold">{familleMonthly}€</span>
              <span className="text-muted-foreground text-sm">/mois</span>
            </div>
            {billingPeriod === 'yearly' && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-4">soit {famillePrice.amount.toFixed(2).replace('.', ',')}€/an — 2 mois offerts</p>
            )}
            {billingPeriod === 'monthly' && <div className="mb-4" />}
            <div className="space-y-2.5 flex-1 mb-5">
              <Feature included text="Tout dans Foyer, plus :" bold />
              <Feature included text="Jusqu'à 5 membres" />
              <Feature included text="Coach IA illimité" />
              <Feature included text="Export des données" />
              <Feature included text="Catégories avancées" />
              <Feature included text="Support prioritaire" />
            </div>
            {currentPlan === 'famille' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-semibold cursor-default">Plan actuel</button>
            ) : (
              <button
                onClick={() => handleCheckout('famille', billingPeriod)}
                disabled={!!checkoutLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {checkoutLoading?.startsWith('famille') ? 'Redirection...' : 'Choisir Famille'}
              </button>
            )}
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              ou en paiement unique : {PLAN_PRICES.famille.lifetime.amount.toFixed(2).replace('.', ',')}€
              <button onClick={() => handleCheckout('famille', 'lifetime')} className="text-primary ml-1 underline">→ Acheter</button>
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Annulable à tout moment. Paiement sécurisé par Stripe. Tous les membres du foyer profitent du plan.
        </p>
      </motion.div>
    </Layout>
  );
};

const Feature = ({ included, text, bold }: { included: boolean; text: string; bold?: boolean }) => (
  <div className="flex items-center gap-2.5 text-sm">
    {included ? (
      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
    ) : (
      <X className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
    )}
    <span className={`${!included ? 'text-muted-foreground' : ''} ${bold ? 'font-semibold' : ''}`}>{text}</span>
  </div>
);

export default Pricing;
