import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, CacheFirst, StaleWhileRevalidate, NetworkFirst, NetworkOnly } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: any

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // API routes must NEVER be cached — always fetch fresh from server
    {
      matcher: /\/api\/.*/i,
      handler: new NetworkOnly(),
    },
    ...defaultCache,
    // Product images from Printify CDN — StaleWhileRevalidate so mockups
    // refresh after Printify regenerates content at the same URL on republish
    {
      matcher: /^https:\/\/.*\.printify\.me\/.*/i,
      handler: new StaleWhileRevalidate({
        cacheName: 'printify-images-v2',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response
              }
              return null
            },
          },
          {
            cacheDidUpdate: async () => {
              const cache = await caches.open('printify-images-v2')
              const keys = await cache.keys()
              if (keys.length > 200) {
                await cache.delete(keys[0])
              }
            },
          },
        ],
      }),
    },
    // Product images from placeholder service (via.placeholder.com)
    {
      matcher: /^https:\/\/via\.placeholder\.com\/.*/i,
      handler: new CacheFirst({
        cacheName: 'placeholder-images',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response
              }
              return null
            },
          },
        ],
      }),
    },
    // Supabase storage images
    {
      matcher: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
      handler: new CacheFirst({
        cacheName: 'supabase-images',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response
              }
              return null
            },
          },
        ],
      }),
    },
    // fal.ai generated design images
    {
      matcher: /^https:\/\/fal\.media\/.*/i,
      handler: new CacheFirst({
        cacheName: 'fal-images',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response
              }
              return null
            },
          },
          {
            cacheDidUpdate: async () => {
              // Limit cache to 100 entries (design images can be large)
              const cache = await caches.open('fal-images')
              const keys = await cache.keys()
              if (keys.length > 100) {
                await cache.delete(keys[0])
              }
            },
          },
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: '/en/offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()

// Clean up old cache names on activation (printify-images → printify-images-v2)
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((names: string[]) =>
      Promise.all(
        names
          .filter((n) => n === 'printify-images')
          .map((n) => caches.delete(n))
      )
    )
  )
})

// --- Web Push Notification Handlers (preserved from original sw.js) ---
self.addEventListener('push', (event: any) => {
  const data = event.data ? event.data.json() : {}
  const options: any = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'pod-ai-notification',
    actions: data.actions || [],
    vibrate: [100, 50, 100],
  }
  event.waitUntil(
    self.registration.showNotification(data.title || process.env.NEXT_PUBLIC_SITE_NAME!, options)
  )
})

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients: any) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

// --- Background Sync for Pending Cart Actions ---
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCartActions())
  }
})

async function syncCartActions() {
  // Get pending cart actions from IndexedDB
  const pendingActions = await getPendingCartActions()

  for (const action of pendingActions) {
    try {
      // Replay the action
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body,
      })

      if (response.ok) {
        // Action succeeded, remove from pending queue
        await removePendingAction(action.id)

        // Notify all clients that sync succeeded
        const clients = await self.clients.matchAll()
        clients.forEach((client: any) => {
          client.postMessage({
            type: 'sync-success',
            action: action.type,
          })
        })
      }
    } catch (error) {
      console.error('Failed to sync action:', action, error)
      // Will retry on next sync
    }
  }
}

async function getPendingCartActions(): Promise<any[]> {
  try {
    const db = await openDB()
    const tx = db.transaction('pendingActions', 'readonly')
    const store = tx.objectStore('pendingActions')
    return await store.getAll()
  } catch {
    return []
  }
}

async function removePendingAction(id: string) {
  try {
    const db = await openDB()
    const tx = db.transaction('pendingActions', 'readwrite')
    const store = tx.objectStore('pendingActions')
    await store.delete(id)
  } catch (error) {
    console.error('Failed to remove pending action:', error)
  }
}

function openDB(): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pod-ai-sync', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id' })
      }
    }
  })
}
