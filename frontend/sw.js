/**
 * ASTRA - Autonomous Spaceflight Telemetry, Risk Analytics & Emergency Response
 * Service Worker: Offline-First Application Shell & Procedure Caching
 */

const CACHE_NAME = 'astra-flight-cache-v2.4';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/static/css/astra_theme.css',
  '/static/js/app.js',
  '/static/js/oscilloscope.js',
  '/api/procedures',
  '/api/astronauts',
  '/api/hardware/bom',
  '/api/environmental',
  '/api/inventory'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ASTRA SW] Pre-caching critical aerospace application shell and offline medical procedures...');
      return cache.addAll(SHELL_ASSETS).catch(err => {
        console.warn('[ASTRA SW] Non-fatal caching warning during install:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests or WebSocket connections
  if (event.request.method !== 'GET' || event.request.url.startsWith('ws')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version or fetch from local network backend
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed (Offline mode)
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline fallback if root or API
          if (event.request.url.includes('/api/')) {
            return new Response(JSON.stringify({
              offline: true,
              message: "ASTRA Client operating in 100% offline flight mode. Real-time uplink unavailable."
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
