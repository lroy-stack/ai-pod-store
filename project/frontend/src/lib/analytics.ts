/**
 * Client-side analytics tracking for funnel events
 * Tracks: view_product, add_to_cart, begin_checkout, purchase
 */

import { v4 as uuidv4 } from 'uuid';
import { isConsentGranted } from '@/lib/cookie-consent';
import { getCsrfToken } from '@/lib/api-fetch';
import { CSRF_HEADER_NAME } from '@/lib/csrf';

// Session ID persists for the browser session
let sessionId: string = '';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  if (!sessionId) {
    // Try to get from sessionStorage first
    const stored = sessionStorage.getItem('analytics_session_id');

    if (stored) {
      sessionId = stored;
    } else {
      sessionId = uuidv4();
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
  }

  return sessionId;
}

export interface TrackEventParams {
  eventName: 'view_product' | 'add_to_cart' | 'begin_checkout' | 'purchase';
  properties?: Record<string, unknown>;
}

/**
 * Track an analytics event
 */
export async function trackEvent({ eventName, properties = {} }: TrackEventParams): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isConsentGranted('analytics')) return;

  try {
    const payload = {
      event_name: eventName,
      session_id: getSessionId(),
      properties,
      page_url: window.location.href,
      referrer: document.referrer || null,
    };

    // Fire-and-forget - don't block UI
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }

    fetch('/api/analytics/track', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true, // Ensure event is sent even if page unloads
    }).catch((err) => {
      // Silent fail - don't break user experience
      console.debug('Analytics tracking failed:', err);
    });
  } catch (err) {
    console.debug('Analytics tracking error:', err);
  }
}

/**
 * Track product view event
 */
export function trackProductView(productId: string, productName: string, price: number): void {
  trackEvent({
    eventName: 'view_product',
    properties: {
      product_id: productId,
      product_name: productName,
      price,
    },
  });
}

/**
 * Track add to cart event
 */
export function trackAddToCart(
  productId: string,
  productName: string,
  price: number,
  quantity: number
): void {
  trackEvent({
    eventName: 'add_to_cart',
    properties: {
      product_id: productId,
      product_name: productName,
      price,
      quantity,
      value: price * quantity,
    },
  });
}

/**
 * Track checkout initiation
 */
export function trackBeginCheckout(cartTotal: number, itemCount: number): void {
  trackEvent({
    eventName: 'begin_checkout',
    properties: {
      value: cartTotal,
      item_count: itemCount,
    },
  });
}

/**
 * Track purchase completion
 */
export function trackPurchase(
  orderId: string,
  total: number,
  itemCount: number,
  currency: string
): void {
  trackEvent({
    eventName: 'purchase',
    properties: {
      order_id: orderId,
      value: total,
      item_count: itemCount,
      currency,
    },
  });
}
