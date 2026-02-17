import { useState, useEffect, useCallback, useRef } from 'react';

interface RateCache {
  rates: Record<string, number>;
  base: string;
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const ratesCacheMap = new Map<string, RateCache>();

export function useExchangeRates(baseCurrency: string) {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!baseCurrency) return;
    
    const cached = ratesCacheMap.get(baseCurrency);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setRates(cached.rates);
      return;
    }

    if (fetchedRef.current === baseCurrency) return;
    fetchedRef.current = baseCurrency;

    setLoading(true);
    fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`)
      .then(res => res.json())
      .then(data => {
        if (data.rates) {
          const allRates: Record<string, number> = { [baseCurrency]: 1, ...data.rates };
          ratesCacheMap.set(baseCurrency, {
            rates: allRates,
            base: baseCurrency,
            timestamp: Date.now(),
          });
          setRates(allRates);
        }
      })
      .catch(err => {
        console.warn('Failed to fetch exchange rates:', err);
      })
      .finally(() => setLoading(false));
  }, [baseCurrency]);

  const convert = useCallback(
    (amount: number, fromCurrency: string, toCurrency?: string): number => {
      const target = toCurrency || baseCurrency;
      if (fromCurrency === target) return amount;

      // If we have rates based on baseCurrency
      const fromRate = rates[fromCurrency];
      const toRate = rates[target];

      if (fromRate && toRate) {
        // Convert: amount in fromCurrency → baseCurrency → toCurrency
        // rates are "1 baseCurrency = X foreignCurrency"
        // So to convert FROM foreign TO base: amount / foreignRate
        // To convert FROM base TO foreign: amount * foreignRate
        const inBase = amount / fromRate;
        return inBase * toRate;
      }

      return amount; // fallback: no conversion
    },
    [rates, baseCurrency]
  );

  return { rates, loading, convert };
}
