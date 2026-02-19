import { useCallback } from 'react';

export const FREEMIUM_LIMITS = {
  members: Infinity,
  budgets: Infinity,
  savingsGoals: Infinity,
  debts: Infinity,
  customCategories: Infinity,
  aiAdvicePerWeek: Infinity,
  historyMonths: Infinity,
  currencies: Infinity,
};

export function useSubscription(_householdId?: string, _userId?: string) {
  const isPremium = true;

  const canAdd = useCallback((_resource: string, _currentCount: number) => {
    return true;
  }, []);

  const getLimit = useCallback((_resource: string) => {
    return Infinity;
  }, []);

  const isMonthAllowed = useCallback((_date: Date) => {
    return true;
  }, []);

  const presentOffering = useCallback(async (_container: HTMLElement) => {
    return null;
  }, []);

  const getOfferings = useCallback(async () => {
    return null;
  }, []);

  const checkSubscription = useCallback(async () => {}, []);
  const verifyWithRevenueCat = useCallback(async () => {}, []);

  return {
    plan: 'premium' as const,
    subscribed: true,
    subscriptionEnd: null,
    loading: false,
    isPremium,
    canAdd,
    getLimit,
    presentOffering,
    getOfferings,
    isMonthAllowed,
    checkSubscription,
    verifyWithRevenueCat,
    purchases: null,
  };
}
