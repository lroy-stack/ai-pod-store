/**
 * Admin API utilities — basePath-aware fetch and URL building.
 *
 * When ADMIN_BASE_PATH="/panel", all API routes live at /panel/api/*.
 * These helpers prefix the basePath so client-side calls reach the
 * correct endpoints regardless of reverse proxy configuration.
 *
 * Usage:
 *   import { adminFetch, apiUrl } from '@/lib/admin-api'
 *
 *   const res = await adminFetch('/api/dashboard/stats')
 *   const es  = new EventSource(apiUrl('/api/events/stream'))
 */

/** basePath inlined at build time via next.config.ts `env` key. */
const BASE_PATH: string = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH ?? '';

/**
 * Prepend the admin basePath to an API path.
 *
 * @param path - Must start with '/' (e.g. '/api/dashboard/stats')
 * @returns The full path (e.g. '/panel/api/dashboard/stats')
 */
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

/**
 * basePath-aware fetch. Drop-in replacement for `fetch('/api/...')`.
 *
 * @param path - API path starting with '/' (e.g. '/api/auth/login')
 * @param init - Standard RequestInit (method, headers, body, signal, etc.)
 */
export function adminFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), init);
}
