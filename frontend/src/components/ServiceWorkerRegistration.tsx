'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only register in production — Serwist generates sw.js at build time only
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return
    }

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Check for updates periodically
        registration.update().catch((err) => {
          console.warn('[SW] Update check failed:', err)
        })

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast('New version available', {
                  description: 'A new version is available.',
                  action: { label: 'Refresh', onClick: () => window.location.reload() },
                  duration: Infinity,
                })
              }
            })
          }
        })
      })
      .catch((error) => {
        console.error('[SW] Registration failed:', error)
      })
  }, [])

  return null
}
