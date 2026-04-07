/**
 * HMAC-signed cookie for MCP client approval memory.
 *
 * Pattern adapted from Cloudflare remote MCP reference:
 *   remote-mcp-server-with-auth-main/src/auth/oauth-utils.ts
 *
 * When a user approves an MCP client (e.g. Claude Desktop), we store
 * the client ID in a signed cookie. On subsequent connections from the
 * same client, the consent dialog is skipped entirely.
 *
 * Cookie format: <HMAC_HEX>.<BASE64_JSON_ARRAY>
 *   HMAC_HEX = HMAC-SHA256(secret, JSON.stringify([clientId1, clientId2, ...]))
 *   BASE64_JSON_ARRAY = base64(JSON.stringify([clientId1, clientId2, ...]))
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

const COOKIE_NAME = 'store-mcp-approved';
const ONE_YEAR_SECONDS = 31_536_000;

/**
 * Sign a payload string with HMAC-SHA256.
 * Returns hex-encoded signature.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify HMAC signature with timing-safe comparison.
 */
function verifySignature(signature: string, payload: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Parse and verify the approval cookie from a request.
 * Returns array of approved client IDs, or null if cookie absent/invalid.
 */
function getApprovedClients(cookieHeader: string | null, secret: string): string[] | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const target = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
  if (!target) return null;

  const cookieValue = target.substring(COOKIE_NAME.length + 1);
  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex === -1) return null;

  const signatureHex = cookieValue.substring(0, dotIndex);
  const base64Payload = cookieValue.substring(dotIndex + 1);

  let payload: string;
  try {
    payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
  } catch {
    return null;
  }

  if (!verifySignature(signatureHex, payload, secret)) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every(item => typeof item === 'string')) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

/**
 * Check if a specific MCP client has been previously approved by the user.
 * Reads the signed cookie from the request headers.
 */
export function clientIdAlreadyApproved(
  req: IncomingMessage,
  clientId: string,
  secret: string
): boolean {
  if (!clientId || !secret) return false;
  const cookieHeader = req.headers.cookie || null;
  const approved = getApprovedClients(cookieHeader, secret);
  return approved?.includes(clientId) ?? false;
}

/**
 * Generate a Set-Cookie header value that adds clientId to the approved list.
 * Preserves previously approved clients from the existing cookie.
 */
export function generateApprovalCookieHeader(
  req: IncomingMessage,
  clientId: string,
  secret: string
): string {
  const cookieHeader = req.headers.cookie || null;
  const existing = getApprovedClients(cookieHeader, secret) || [];
  const updated = Array.from(new Set([...existing, clientId]));

  const payload = JSON.stringify(updated);
  const signature = signPayload(payload, secret);
  const base64Payload = Buffer.from(payload).toString('base64');
  const cookieValue = `${signature}.${base64Payload}`;

  return `${COOKIE_NAME}=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ONE_YEAR_SECONDS}`;
}
