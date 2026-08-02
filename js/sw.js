// ============================================================
// SERVICE WORKER - Fishpond OODA Tool v5.0
// ============================================================

const CACHE_NAME = 'fishpond-ooda-v5';

// Assets to cache on install - ADDED prep.js and species.js
const STATIC_ASSETS = [
  '/fishpond-ooda-tool/',
  '/fishpond-ooda-tool/index.html',
  '/fishpond-ooda-tool/manifest.json',
  '/fishpond-ooda-tool/css/style.css',
  '/fishpond-ooda-tool/js/utils.js',
  '/fishpond-ooda-tool/js/db.js',
  '/fishpond-ooda-tool/js/ooda.js',
  '/fishpond-ooda-tool/js/ui.js',
  '/fishpond-ooda-tool/js/main.js',
  '/fishpond-ooda-tool/js/prep.js',      // <-- ADDED
  '/fishpond-ooda-tool/js/species.js',   // <-- ADDED
  '/fishpond-ooda-tool/js/decide.js'
];

// ---- INSTALL ----
self.addEventListener('install', event => {
  console.log('📦 Service Worker installing v5...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker installed successfully!');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker install failed:', error);
      })
  );
});

// ---- ACTIVATE ----
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating v5...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        const deletePromises = cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('✅ Service Worker activated! Taking control...');
        return self.clients.claim();
      })
      .catch(error => {
        console.error('❌ Service Worker activation failed:', error);
      })
  );
});

// ---- FETCH ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('namria')) return;

  // ---- Network-first for navigation ----
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cached => {
              if (cached) return cached;
              return caches.match('/fishpond-ooda-tool/index.html');
            });
        })
    );
    return;
  }

  // ---- Cache-first for static assets ----
  if (STATIC_ASSETS.some(asset => event.request.url.includes(asset))) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) {
            // Refresh cache in background
            fetch(event.request)
              .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse);
                  });
                }
              })
              .catch(() => {});
            return cached;
          }
          return fetch(event.request)
            .then(response => {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
              return response;
            });
        })
    );
    return;
  }

  // ---- Network-first with cache fallback ----
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// ---- MESSAGE HANDLING ----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('🔧 Service Worker loaded: fishpond-ooda-v5');
