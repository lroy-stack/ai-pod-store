/**
 * Safe redirect URL validation.
 *
 * Prevents open redirect attacks by only allowing relative paths.
 * Rejects absolute URLs, protocol-relative URLs, and paths with colons.
 */
export function getSafeRedirectUrl(url: string | null, fallback: string): string {
  if (!url) return fallback
  // Only allow relative paths starting with / (not // which is protocol-relative)
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes(':')) return url
  return fallback
}
