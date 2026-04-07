/**
 * Unsubscribe Token Generator
 *
 * Generates signed tokens for one-click unsubscribe links (RFC 8058).
 * Uses HMAC-SHA256 to sign email addresses with a secret key.
 */

import crypto from 'crypto';

let _secret: string | undefined;

function getSecret(): string {
  if (!_secret) {
    _secret = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET;
    if (!_secret) throw new Error('UNSUBSCRIBE_SECRET or NEXTAUTH_SECRET environment variable is required');
  }
  return _secret;
}

/**
 * Generate an unsubscribe token for an email address
 */
export function generateUnsubscribeToken(email: string): string {
  const payload = JSON.stringify({ email, exp: Date.now() + 365 * 24 * 60 * 60 * 1000 }); // 1 year expiry
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url');

  return Buffer.from(payload).toString('base64url') + '.' + signature;
}

/**
 * Verify and decode an unsubscribe token
 */
export function verifyUnsubscribeToken(token: string): { email: string } | null {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) {
      return null;
    }

    const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const expectedSignature = crypto
      .createHmac('sha256', getSecret())
      .update(payload)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const data = JSON.parse(payload);

    // Check expiry
    if (data.exp && Date.now() > data.exp) {
      return null;
    }

    return { email: data.email };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
