/**
 * Cookie Consent Management
 * GDPR-compliant cookie consent handling
 */

export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

export interface CookieConsent {
  necessary: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const CONSENT_COOKIE_NAME = 'cookie_consent';
const CONSENT_STORAGE_KEY = 'cookieConsent';

/**
 * Get the current cookie consent state
 */
export function getConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;

  // Try localStorage first
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to read consent from localStorage:', error);
  }

  // Fallback to cookie
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${CONSENT_COOKIE_NAME}=`))
    ?.split('=')[1];

  if (cookieValue) {
    try {
      return JSON.parse(decodeURIComponent(cookieValue));
    } catch (error) {
      console.error('Failed to parse consent cookie:', error);
    }
  }

  return null;
}

/**
 * Save cookie consent preferences
 */
export function saveConsent(consent: Omit<CookieConsent, 'necessary' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;

  const fullConsent: CookieConsent = {
    necessary: true, // Always true
    analytics: consent.analytics,
    marketing: consent.marketing,
    timestamp: new Date().toISOString(),
  };

  // Save to localStorage
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(fullConsent));
  } catch (error) {
    console.error('Failed to save consent to localStorage:', error);
  }

  // Save to cookie (1 year expiry)
  const maxAge = 365 * 24 * 60 * 60; // 1 year in seconds
  const cookieValue = encodeURIComponent(JSON.stringify(fullConsent));
  document.cookie = `${CONSENT_COOKIE_NAME}=${cookieValue}; max-age=${maxAge}; path=/; SameSite=Lax; Secure`;

  // Record consent to database (GDPR compliance)
  recordConsentToDatabase(fullConsent).catch((error) => {
    console.error('Failed to record consent to database:', error);
  });
}

/**
 * Record consent to database for GDPR compliance
 */
async function recordConsentToDatabase(consent: CookieConsent): Promise<void> {
  try {
    const response = await fetch('/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        consents: {
          necessary: consent.necessary,
          analytics: consent.analytics,
          marketing: consent.marketing,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
  } catch (error) {
    // Fail silently for anonymous users or network errors
    // Consent is still saved to localStorage/cookie
    console.warn('Consent recording skipped:', error);
  }
}

/**
 * Check if user has made a consent choice
 */
export function hasConsent(): boolean {
  return getConsent() !== null;
}

/**
 * Check if a specific category is allowed
 */
export function isConsentGranted(category: ConsentCategory): boolean {
  const consent = getConsent();
  if (!consent) return category === 'necessary'; // Only necessary cookies before consent
  return consent[category];
}

/**
 * Accept all cookies
 */
export function acceptAll(): void {
  saveConsent({
    analytics: true,
    marketing: true,
  });
}

/**
 * Reject non-essential cookies
 */
export function rejectAll(): void {
  saveConsent({
    analytics: false,
    marketing: false,
  });
}

/**
 * Clear consent (for testing or user request to reset)
 */
export function clearConsent(): void {
  if (typeof window === 'undefined') return;

  // Clear localStorage
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear consent from localStorage:', error);
  }

  // Clear cookie
  document.cookie = `${CONSENT_COOKIE_NAME}=; max-age=0; path=/`;
}
