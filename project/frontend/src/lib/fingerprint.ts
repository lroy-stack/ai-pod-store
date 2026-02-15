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

  try {
    if (!fpPromise) {
      const FingerprintJS = await import('@fingerprintjs/fingerprintjs')
      fpPromise = FingerprintJS.load()
    }

    const fp = await fpPromise
    const result = await fp.get()
    return result.visitorId
  } catch {
    return null
  }
}

// Server-side: extract fingerprint from request header
export function getFingerprintFromRequest(req: Request): string | null {
  return req.headers.get('x-fp-id') || null
}
