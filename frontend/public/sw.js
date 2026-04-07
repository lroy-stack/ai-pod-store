// Placeholder — overwritten by Serwist during next build (src/app/sw.ts -> public/sw.js)
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
