import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Purchases } from '@revenuecat/purchases-js';

const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY || '';
const ENTITLEMENT_ID = 'pro_access';

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

export function useSubscription(householdId: string, userId?: string) {
  const [state, setState] = useState<SubscriptionState>({
    plan: 'free',
    subscribed: false,
    subscriptionEnd: null,
    loading: true,
  });
  const purchasesRef = useRef<Purchases | null>(null);
  const paywallContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize RevenueCat SDK
  useEffect(() => {
    if (!userId || !REVENUECAT_API_KEY) return;
    try {
      const purchases = Purchases.configure(REVENUECAT_API_KEY, userId);
      purchasesRef.current = purchases;
    } catch (err: any) {
      console.error('RevenueCat configure error:', err);
    }
  }, [userId]);

  // Check subscription from local DB (set by webhook)
  const checkSubscription = useCallback(async () => {
    if (!householdId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
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

  // Verify with RevenueCat SDK (checks entitlements directly)
  const verifyWithRevenueCat = useCallback(async () => {
    if (!purchasesRef.current) return;
    try {
      const customerInfo = await purchasesRef.current.getCustomerInfo();
      const isActive = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      
      if (isActive) {
        setState(prev => ({
          ...prev,
          plan: 'premium',
          subscribed: true,
        }));
      }
    } catch (err) {
      console.error('RevenueCat verification error:', err);
      // Silent fail, DB state is our fallback
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Verify with RevenueCat periodically
  useEffect(() => {
    if (!householdId || !userId) return;
    verifyWithRevenueCat();
    const interval = setInterval(verifyWithRevenueCat, 60000);
    return () => clearInterval(interval);
  }, [householdId, userId, verifyWithRevenueCat]);

  const isPremium = state.plan === 'premium';

  const canAdd = useCallback((resource: keyof typeof FREEMIUM_LIMITS, currentCount: number) => {
    if (isPremium) return true;
    return currentCount < FREEMIUM_LIMITS[resource];
  }, [isPremium]);

  const getLimit = useCallback((resource: keyof typeof FREEMIUM_LIMITS) => {
    if (isPremium) return Infinity;
    return FREEMIUM_LIMITS[resource];
  }, [isPremium]);

  // Present RevenueCat paywall
  const presentOffering = useCallback(async (containerElement: HTMLElement) => {
    if (!purchasesRef.current) {
      console.error('RevenueCat not initialized');
      return null;
    }

    try {
      const result = await purchasesRef.current.presentPaywall({
        htmlTarget: containerElement,
      });

      // After purchase flow, re-check entitlements and DB
      await verifyWithRevenueCat();
      await checkSubscription();

      return result;
    } catch (err: any) {
      console.error('RevenueCat paywall error:', err);
      throw err;
    }
  }, [verifyWithRevenueCat, checkSubscription]);

  // Get offerings manually
  const getOfferings = useCallback(async () => {
    if (!purchasesRef.current) return null;
    try {
      return await purchasesRef.current.getOfferings();
    } catch (err: any) {
      console.error('RevenueCat offerings error:', err);
      return null;
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
    presentOffering,
    getOfferings,
    isMonthAllowed,
    checkSubscription,
    verifyWithRevenueCat,
    purchases: purchasesRef.current,
  };
}
