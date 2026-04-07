'use client';

/**
 * Cloudflare Turnstile CAPTCHA widget
 * Used in login and registration forms to prevent automated abuse
 */

import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: Error | string) => void;
  siteKey?: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

let turnstileScriptPromise: Promise<boolean> | null = null;

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
      turnstileScriptPromise = null;
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
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  // Keep refs in sync without triggering useEffect
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  const finalSiteKey = siteKey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!finalSiteKey || !containerRef.current) return;

    let mounted = true;

    loadTurnstileScript().then((loaded) => {
      if (!mounted || !containerRef.current || !loaded) return;

      const turnstile = (window as any).turnstile;
      if (!turnstile) return;

      // Don't render if widget already exists on this container
      if (widgetIdRef.current) return;

      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: finalSiteKey,
        theme,
        size,
        callback: (token: string) => {
          onVerifyRef.current(token);
        },
        'expired-callback': () => {
          onExpireRef.current?.();
        },
        'error-callback': (err: any) => {
          const error = err instanceof Error ? err : new Error(String(err));
          onErrorRef.current?.(error);
        },
      });
    });

    return () => {
      mounted = false;
      if (widgetIdRef.current && typeof window !== 'undefined') {
        const turnstile = (window as any).turnstile;
        if (turnstile?.remove) {
          turnstile.remove(widgetIdRef.current);
        }
        widgetIdRef.current = null;
      }
    };
  }, [finalSiteKey, theme, size]);

  if (!finalSiteKey) {
    return null;
  }

  return <div ref={containerRef} className="cf-turnstile" />;
}
