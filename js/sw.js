// ============================================================
// SERVICE WORKER - Fishpond OODA Tool v2.1
// ============================================================

// BUMP THIS VERSION ON EVERY DEPLOYMENT TO FORCE UPDATES
const CACHE_NAME = 'fishpond-ooda-v3';

// Assets to cache on install
const STATIC_ASSETS = [
  '/fishpond-ooda-tool/',
  '/fishpond-ooda-tool/index.html',
  '/fishpond-ooda-tool/manifest.json',
  '/fishpond-ooda-tool/css/style.css',
  '/fishpond-ooda-tool/js/utils.js',
  '/fishpond-ooda-tool/js/db.js',
  '/fishpond-ooda-tool/js/ooda.js',
  '/fishpond-ooda-tool/js/ui.js',
  '/fishpond-ooda-tool/js/main.js'
];

// ---- INSTALL ----
self.addEventListener('install', event => {
  console.log('📦 Service Worker installing v3...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker installed successfully!');
        // Force the waiting service worker to become active
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker install failed:', error);
      })
  );
});

// ---- ACTIVATE ----
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating v3...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        // Delete all old caches that don't match the current one
        const deletePromises = cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('✅ Service Worker activated! Taking control of all clients...');
        // Take control of all open clients/tabs
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
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip requests for NAMRIA (cross-origin)
  if (url.hostname.includes('namria')) {
    return;
  }
  
  // ---- STRATEGY: Network-first for navigation requests ----
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response for caching
          const responseClone = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            })
            .catch(err => console.warn('Cache put failed:', err));
          
          return response;
        })
        .catch(() => {
          // If network fails, try the cache
          return caches.match(event.request)
            .then(cached => {
              if (cached) return cached;
              // Fallback to index.html for SPA routing
              return caches.match('/fishpond-ooda-tool/index.html');
            });
        })
    );
    return;
  }
  
  // ---- STRATEGY: Cache-first for static assets ----
  if (STATIC_ASSETS.some(asset => event.request.url.includes(asset))) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) {
            // Return cached version, but refresh in background
            fetch(event.request)
              .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(CACHE_NAME)
                    .then(cache => {
                      cache.put(event.request, networkResponse);
                    });
                }
              })
              .catch(() => {});
            return cached;
          }
          
          // Not in cache, fetch from network
          return fetch(event.request)
            .then(response => {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseClone);
                });
              return response;
            });
        })
    );
    return;
  }
  
  // ---- STRATEGY: Network-first with cache fallback for everything else ----
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses (but not cross-origin)
        if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            })
            .catch(() => {});
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// ---- MESSAGE HANDLING (for updates) ----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---- LOGGING ----
console.log('🔧 Service Worker loaded: fishpond-ooda-v3');
