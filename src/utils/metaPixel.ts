// Meta Pixel helper — safe to call even if fbq isn't loaded
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const PIXEL_ID = '1568796404455038';

/**
 * Ensure fbq is initialised. Handles cases where the inline script
 * in index.html hasn't executed yet (e.g. deferred loading).
 */
const ensureFbq = () => {
  if (typeof window === 'undefined') return false;
  if (window.fbq) return true;

  // If fbq doesn't exist, bootstrap it manually
  const n: any = (window.fbq = function (...args: any[]) {
    n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
  });
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];

  // Inject the SDK script if not already present
  if (!document.querySelector('script[src*="fbevents.js"]')) {
    const t = document.createElement('script');
    t.async = true;
    t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const s = document.getElementsByTagName('script')[0];
    s?.parentNode?.insertBefore(t, s);
  }

  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
  return true;
};

export const trackPageView = () => {
  if (ensureFbq()) {
    window.fbq!('track', 'PageView');
  }
};

export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (ensureFbq()) {
    window.fbq!('track', eventName, params);
  }
};

export const trackCustomEvent = (eventName: string, params?: Record<string, any>) => {
  if (ensureFbq()) {
    window.fbq!('trackCustom', eventName, params);
  }
};
