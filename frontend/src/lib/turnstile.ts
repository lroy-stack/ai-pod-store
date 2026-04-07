/**
 * Cloudflare Turnstile server-side verification
 * Validates tokens received from TurnstileWidget on the client
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerificationResult {
  /**
   * Whether the token is valid
   */
  success: boolean;
  /**
   * Error codes if verification failed
   */
  'error-codes'?: string[];
  /**
   * Challenge timestamp (ISO 8601)
   */
  challenge_ts?: string;
  /**
   * Hostname where the challenge was served
   */
  hostname?: string;
}

/**
 * Verify a Turnstile token server-side
 *
 * @param token - The token received from the client (TurnstileWidget onVerify callback)
 * @param remoteIp - Optional: The user's IP address for additional validation
 * @returns True if the token is valid, false otherwise
 *
 * @example
 * ```ts
 * const isValid = await verifyTurnstileToken(token);
 * if (!isValid) {
 *   return Response.json({ error: 'CAPTCHA verification failed' }, { status: 400 });
 * }
 * ```
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string
): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // If no secret key configured: fail-closed in production, skip in dev
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Turnstile] CRITICAL: No TURNSTILE_SECRET_KEY in production. Blocking request.');
      return false;
    }
    console.warn('[Turnstile] No secret key configured. Skipping verification in dev mode.');
    return true;
  }

  // In production: reject if no token was provided (widget failed or was bypassed)
  if (!token) {
    console.warn('[Turnstile] No token provided but secret key is configured.');
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error(`[Turnstile] Verification request failed: ${response.status}`);
      return false;
    }

    const result: TurnstileVerificationResult = await response.json();

    if (!result.success) {
      console.warn('[Turnstile] Verification failed:', result['error-codes']);
    }

    return result.success;
  } catch (error) {
    console.error('[Turnstile] Verification error:', error);
    return false;
  }
}

/**
 * Verify a Turnstile token and throw an error if invalid
 * Useful for API route error handling
 *
 * @param token - The token received from the client
 * @param remoteIp - Optional: The user's IP address
 * @throws Error if token is invalid or missing
 *
 * @example
 * ```ts
 * try {
 *   await requireValidTurnstileToken(token);
 *   // Proceed with authentication
 * } catch (error) {
 *   return Response.json({ error: error.message }, { status: 400 });
 * }
 * ```
 */
export async function requireValidTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<void> {
  if (!token) {
    throw new Error('CAPTCHA token required');
  }

  const isValid = await verifyTurnstileToken(token, remoteIp);
  if (!isValid) {
    throw new Error('CAPTCHA verification failed');
  }
}
