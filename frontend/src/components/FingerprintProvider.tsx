'use client'

import { useEffect } from 'react'
import { getFingerprint } from '@/lib/fingerprint'

/**
 * FingerprintProvider
 *
 * Initializes FingerprintJS on mount and patches the global fetch
 * to include X-Fp-Id header on same-origin API requests.
 */
export function FingerprintProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let visitorId: string | null = null

    getFingerprint().then((id) => {
      if (id) {
        visitorId = id
        try { localStorage.setItem('pod-fp-id', id) } catch { /* ignore */ }
      }
    })

    // Patch fetch to include fingerprint header on API calls
    const originalFetch = window.fetch
    window.fetch = async function (input, init) {
      if (visitorId) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
        // Only add header for same-origin API requests
        if (url.startsWith('/api/') || url.startsWith(window.location.origin + '/api/')) {
          const headers = new Headers(init?.headers)
          if (!headers.has('x-fp-id')) {
            headers.set('x-fp-id', visitorId)
          }
          init = { ...init, headers }
        }
      }
      return originalFetch.call(this, input, init)
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return <>{children}</>
}
