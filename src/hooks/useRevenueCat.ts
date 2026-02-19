import { useState, useEffect, useCallback, useRef } from 'react';
import { Purchases } from '@revenuecat/purchases-js';

// Replace with your actual RevenueCat Web Billing API key
const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY || '';

const ENTITLEMENT_ID = 'pro_access';

interface RevenueCatState {
  isProUser: boolean;
  loading: boolean;
  error: string | null;
}

export function useRevenueCat(userId: string | undefined) {
  const [state, setState] = useState<RevenueCatState>({
    isProUser: false,
    loading: true,
    error: null,
  });
  const purchasesRef = useRef<Purchases | null>(null);

  // Configure SDK
  useEffect(() => {
    if (!userId) {
      setState({ isProUser: false, loading: false, error: null });
      return;
    }

    try {
      const purchases = Purchases.configure(REVENUECAT_API_KEY, userId);
      purchasesRef.current = purchases;

      // Check initial entitlement status
      checkEntitlements(purchases);
    } catch (err: any) {
      console.error('RevenueCat configure error:', err);
      setState({ isProUser: false, loading: false, error: err.message });
    }
  }, [userId]);

  const checkEntitlements = async (purchases: Purchases) => {
    try {
      const customerInfo = await purchases.getCustomerInfo();
      const isActive = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setState({ isProUser: isActive, loading: false, error: null });
    } catch (err: any) {
      console.error('RevenueCat entitlement check error:', err);
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  // Re-check entitlements periodically (catches renewals, cancellations, plan changes)
  useEffect(() => {
    if (!purchasesRef.current || !userId) return;

    const interval = setInterval(() => {
      if (purchasesRef.current) {
        checkEntitlements(purchasesRef.current);
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [userId]);

  // Present the default offering paywall
  const presentOffering = useCallback(async (containerElement: HTMLElement) => {
    if (!purchasesRef.current) {
      console.error('RevenueCat not initialized');
      return null;
    }

    try {
      const result = await purchasesRef.current.presentPaywall({
        htmlTarget: containerElement,
      });

      // After purchase flow, re-check entitlements
      if (purchasesRef.current) {
        await checkEntitlements(purchasesRef.current);
      }

      return result;
    } catch (err: any) {
      console.error('RevenueCat paywall error:', err);
      throw err;
    }
  }, []);

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

  // Refresh entitlements (call after webhook events)
  const refreshEntitlements = useCallback(async () => {
    if (!purchasesRef.current) return;
    await checkEntitlements(purchasesRef.current);
  }, []);

  return {
    ...state,
    presentOffering,
    getOfferings,
    refreshEntitlements,
    purchases: purchasesRef.current,
  };
}
