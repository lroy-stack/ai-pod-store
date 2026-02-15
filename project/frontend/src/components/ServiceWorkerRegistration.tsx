'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only register service worker in the browser
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Service Worker registered:', registration.scope)

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
                console.log('[SW] New content available; please refresh.')
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
