import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PlanType = 'free' | 'foyer' | 'famille';

export const PLAN_PRICES = {
  foyer: {
    monthly: { priceId: 'price_1T7y2OIw2TO0HaPOo83XMPEP', amount: 7.99 },
    yearly: { priceId: 'price_1T7y2iIw2TO0HaPODsF2b5RZ', amount: 69.90 },
    lifetime: { priceId: 'price_1T7y3XIw2TO0HaPO5RiFbGbI', amount: 149.90 },
  },
  famille: {
    monthly: { priceId: 'price_1T7y3pIw2TO0HaPOgN0KYjLa', amount: 12.99 },
    yearly: { priceId: 'price_1T7y49Iw2TO0HaPOtNSRk9Lg', amount: 119.90 },
    lifetime: { priceId: 'price_1T7y4KIw2TO0HaPOu1OaQ0GA', amount: 249.90 },
  },
} as const;

// All price IDs for lifetime detection
const LIFETIME_PRICE_IDS = [
  PLAN_PRICES.foyer.lifetime.priceId,
  PLAN_PRICES.famille.lifetime.priceId,
];

// Backward compat exports
export const PREMIUM_PRICES = PLAN_PRICES.foyer;
export const PREMIUM_PRICE_MONTHLY = PLAN_PRICES.foyer.monthly.priceId;
export const PREMIUM_PRICE_YEARLY = PLAN_PRICES.foyer.yearly.priceId;

export const FREEMIUM_LIMITS = {
  accounts: 1,
  savingsGoals: Infinity,
  budgets: 2,
  members: 1,
};

export const FOYER_LIMITS = {
  members: 2,
  coachIa: 30,
};

export const FAMILLE_LIMITS = {
  members: 5,
  coachIa: Infinity,
};

export function useSubscription(householdId?: string, _userId?: string) {
  const [plan, setPlan] = useState<PlanType>('free');
  const [loading, setLoading] = useState(true);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPlan('free');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        console.error('check-subscription error:', error);
        setPlan('free');
      } else {
        const planType = data?.plan_type as PlanType;
        setPlan(planType === 'foyer' || planType === 'famille' ? planType : (data?.subscribed ? 'foyer' : 'free'));
        setSubscriptionEnd(data?.subscription_end || null);
      }
    } catch (err) {
      console.error('Subscription check failed:', err);
      setPlan('free');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const isPremium = plan !== 'free';
  const subscribed = isPremium;

  const canAdd = useCallback((resource: string, currentCount: number) => {
    if (plan === 'famille') return true;
    if (plan === 'foyer') {
      if (resource === 'members') return currentCount < FOYER_LIMITS.members;
      return true; // unlimited accounts, budgets, etc.
    }
    // free
    const limit = FREEMIUM_LIMITS[resource as keyof typeof FREEMIUM_LIMITS];
    if (limit === undefined) return true;
    return currentCount < limit;
  }, [plan]);

  const getLimit = useCallback((resource: string) => {
    if (plan === 'famille') {
      if (resource === 'members') return FAMILLE_LIMITS.members;
      return Infinity;
    }
    if (plan === 'foyer') {
      if (resource === 'members') return FOYER_LIMITS.members;
      return Infinity;
    }
    return FREEMIUM_LIMITS[resource as keyof typeof FREEMIUM_LIMITS] ?? Infinity;
  }, [plan]);

  const startCheckout = useCallback(async (priceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
    }
  }, []);

  const openPortal = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Portal error:', err);
    }
  }, []);

  return {
    plan,
    subscribed,
    subscriptionEnd,
    loading,
    isPremium,
    canAdd,
    getLimit,
    checkSubscription,
    startCheckout,
    openPortal,
  };
}
