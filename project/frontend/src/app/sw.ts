import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, CacheFirst, NetworkFirst } from 'serwist'

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
    ...defaultCache,
    // Product images from Printify CDN
    {
      urlPattern: /^https:\/\/.*\.printify\.me\/.*/i,
      handler: new CacheFirst({
        cacheName: 'printify-images',
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
              // Limit cache size to 200 entries
              const cache = await caches.open('printify-images')
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
      urlPattern: /^https:\/\/via\.placeholder\.com\/.*/i,
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
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
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
      urlPattern: /^https:\/\/fal\.media\/.*/i,
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
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()

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
    self.registration.showNotification(data.title || 'POD AI', options)
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
