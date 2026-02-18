import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const STRIPE_PRICES = {
  monthly: 'price_1T2AGZEpsOFFNo5eZLdz8ZYn',
  yearly: 'price_1T2AHAEpsOFFNo5eT1ilAEAS',
};

export const FREEMIUM_LIMITS = {
  members: 2,
  budgets: 3,
  savingsGoals: 1,
  debts: 1,
  customCategories: 3,
  aiAdvicePerWeek: 1,
  historyMonths: 3,
  currencies: 1,
};

interface SubscriptionState {
  plan: 'free' | 'premium';
  subscribed: boolean;
  subscriptionEnd: string | null;
  loading: boolean;
}

export function useSubscription(householdId: string) {
  const [state, setState] = useState<SubscriptionState>({
    plan: 'free',
    subscribed: false,
    subscriptionEnd: null,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!householdId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // First check local DB
      const { data: household } = await supabase
        .from('households')
        .select('plan, subscription_end_date, subscription_status')
        .eq('id', householdId)
        .single();

      if (household) {
        const isPremium = household.plan === 'premium' && household.subscription_status === 'active';
        setState({
          plan: isPremium ? 'premium' : 'free',
          subscribed: isPremium,
          subscriptionEnd: household.subscription_end_date,
          loading: false,
        });
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [householdId]);

  // Also verify with Stripe periodically
  const verifyWithStripe = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!error && data) {
        setState(prev => ({
          ...prev,
          plan: data.subscribed ? 'premium' : 'free',
          subscribed: data.subscribed,
          subscriptionEnd: data.subscription_end,
        }));
      }
    } catch {
      // Silent fail, local DB state is our fallback
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Verify with Stripe on mount and every 60 seconds
  useEffect(() => {
    if (!householdId) return;
    verifyWithStripe();
    const interval = setInterval(verifyWithStripe, 60000);
    return () => clearInterval(interval);
  }, [householdId, verifyWithStripe]);

  const isPremium = state.plan === 'premium';

  const canAdd = useCallback((resource: keyof typeof FREEMIUM_LIMITS, currentCount: number) => {
    if (isPremium) return true;
    const limit = FREEMIUM_LIMITS[resource];
    return currentCount < limit;
  }, [isPremium]);

  const getLimit = useCallback((resource: keyof typeof FREEMIUM_LIMITS) => {
    if (isPremium) return Infinity;
    return FREEMIUM_LIMITS[resource];
  }, [isPremium]);

  const startCheckout = useCallback(async (plan: 'monthly' | 'yearly') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId: STRIPE_PRICES[plan] },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      throw err;
    }
  }, []);

  const openPortal = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Portal error:', err);
      throw err;
    }
  }, []);

  const isMonthAllowed = useCallback((date: Date) => {
    if (isPremium) return true;
    const now = new Date();
    const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    return diffMonths <= FREEMIUM_LIMITS.historyMonths;
  }, [isPremium]);

  return {
    ...state,
    isPremium,
    canAdd,
    getLimit,
    startCheckout,
    openPortal,
    isMonthAllowed,
    checkSubscription,
    verifyWithStripe,
  };
}
