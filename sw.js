const CACHE_NAME = 'tracks-v8';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './beeper.js',
  './manifest.json',
  './icon-512.png',
  './plugins/gap-auditor.js',
  './plugins/pomodoro.js',
  './plugins/hotkeys.js',
  './plugins/analytics.js',
  './plugins/flowtime.js',
  './plugins/ultradian.js',
  './plugins/desktime.js',
  './plugins/eisenhower.js',
  './plugins/docs.js'
];

// Install Event - Pre-cache Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[Service Worker] Failed to pre-cache some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Cache First, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Only cache successful standard HTTP GET requests
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic' ||
          event.request.method !== 'GET'
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for document requests if offline
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
