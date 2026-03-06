'use client';

/**
 * Cloudflare Turnstile CAPTCHA widget
 * Used in login and registration forms to prevent automated abuse
 */

import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  /**
   * Callback fired when Turnstile verification succeeds
   * Receives the verification token that must be validated server-side
   */
  onVerify: (token: string) => void;
  /**
   * Callback fired when verification expires (default 5 minutes)
   */
  onExpire?: () => void;
  /**
   * Callback fired when verification fails
   */
  onError?: (error: Error | string) => void;
  /**
   * Turnstile site key (public)
   * Falls back to NEXT_PUBLIC_TURNSTILE_SITE_KEY env var
   */
  siteKey?: string;
  /**
   * Theme: light, dark, or auto
   */
  theme?: 'light' | 'dark' | 'auto';
  /**
   * Size: normal or compact
   */
  size?: 'normal' | 'compact';
}

// Global reference to Turnstile script load state
let turnstileScriptPromise: Promise<boolean> | null = null;

/**
 * Load Cloudflare Turnstile script once.
 * Resolves to `true` if loaded, `false` if the script failed (never rejects).
 */
function loadTurnstileScript(): Promise<boolean> {
  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).turnstile) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('[Turnstile] Could not load script — CAPTCHA will be skipped.');
      turnstileScriptPromise = null; // allow retry on next mount
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  siteKey,
  theme = 'auto',
  size = 'normal',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Get site key from prop or env var
  const finalSiteKey = siteKey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    // Skip if no site key configured (dev mode or Turnstile not enabled)
    if (!finalSiteKey) {
      console.warn(
        '[Turnstile] No site key configured. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY or pass siteKey prop.'
      );
      return;
    }

    if (!containerRef.current) return;

    let mounted = true;

    // Load Turnstile script and render widget
    loadTurnstileScript().then((loaded) => {
      if (!mounted || !containerRef.current || !loaded) return;

      const turnstile = (window as any).turnstile;
      if (!turnstile) return;

      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: finalSiteKey,
        theme,
        size,
        callback: (token: string) => {
          onVerify(token);
        },
        'expired-callback': () => {
          onExpire?.();
        },
        'error-callback': (err: any) => {
          const error = err instanceof Error ? err : new Error(String(err));
          onError?.(error);
        },
      });
    });

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (widgetIdRef.current && typeof window !== 'undefined') {
        const turnstile = (window as any).turnstile;
        if (turnstile?.remove) {
          turnstile.remove(widgetIdRef.current);
        }
      }
    };
  }, [finalSiteKey, theme, size, onVerify, onExpire, onError]);

  // If no site key, render nothing (graceful degradation)
  if (!finalSiteKey) {
    return null;
  }

  return <div ref={containerRef} className="cf-turnstile" />;
}
