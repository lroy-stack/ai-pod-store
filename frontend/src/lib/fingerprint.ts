/**
 * Fingerprint utility module
 *
 * Client-side: Initializes FingerprintJS and returns visitorId
 * Server-side: Reads fingerprint from X-Fp-Id header
 */

// Client-side: lazy-load FingerprintJS
let fpPromise: Promise<any> | null = null

export async function getFingerprint(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  // Check localStorage first (available instantly, eliminates race condition)
  try {
    const cached = localStorage.getItem('pod-fp-id')
    if (cached) return cached
  } catch { /* ignore */ }

  try {
    if (!fpPromise) {
      const FingerprintJS = await import('@fingerprintjs/fingerprintjs')
      fpPromise = FingerprintJS.load()
    }

    const fp = await fpPromise
    const result = await fp.get()
    const id = result.visitorId

    // Save to localStorage for instant access on next call
    if (id) {
      try { localStorage.setItem('pod-fp-id', id) } catch { /* ignore */ }
    }

    return id
  } catch {
    return null
  }
}

// Server-side: extract fingerprint from request header
export function getFingerprintFromRequest(req: Request): string | null {
  return req.headers.get('x-fp-id') || null
}
