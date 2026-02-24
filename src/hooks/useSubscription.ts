import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const PREMIUM_PRICES = {
  monthly: { priceId: 'price_1T4F9nIw2TO0HaPOEQYTWkeY', amount: 5.99 },
  yearly: { priceId: 'price_1T4FB0Iw2TO0HaPOynh4aLeb', amount: 59.90 },
  lifetime: { priceId: 'price_1T4FBGIw2TO0HaPOMvqQhLx4', amount: 119.80 },
} as const;

// Backward compat
export const PREMIUM_PRICE_MONTHLY = PREMIUM_PRICES.monthly.priceId;
export const PREMIUM_PRICE_YEARLY = PREMIUM_PRICES.yearly.priceId;

export const FREEMIUM_LIMITS = {
  accounts: 1,
  savingsGoals: 1,
  budgets: 2,
};

export function useSubscription(householdId?: string, _userId?: string) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSubscribed(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        console.error('check-subscription error:', error);
        setSubscribed(false);
      } else {
        setSubscribed(data?.subscribed === true);
        setSubscriptionEnd(data?.subscription_end || null);
      }
    } catch (err) {
      console.error('Subscription check failed:', err);
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const isPremium = subscribed;

  const canAdd = useCallback((resource: string, currentCount: number) => {
    if (isPremium) return true;
    const limit = FREEMIUM_LIMITS[resource as keyof typeof FREEMIUM_LIMITS];
    if (limit === undefined) return true;
    return currentCount < limit;
  }, [isPremium]);

  const getLimit = useCallback((resource: string) => {
    if (isPremium) return Infinity;
    return FREEMIUM_LIMITS[resource as keyof typeof FREEMIUM_LIMITS] ?? Infinity;
  }, [isPremium]);

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
    plan: isPremium ? 'premium' as const : 'free' as const,
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
