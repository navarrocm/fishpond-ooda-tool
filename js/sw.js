const CACHE_NAME = 'fishpond-ooda-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/js/db.js',
  '/js/ooda.js',
  '/js/ui.js',
  '/js/utils.js',
  '/manifest.json'
];

// ---- Install ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ---- Activate ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('🗑️ Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ---- Fetch ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ---- Network-first for critical files ----
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache for navigation
          return caches.match('/index.html');
        })
    );
    return;
  }

  // ---- Cache-first for static assets ----
  if (STATIC_ASSETS.some(asset => event.request.url.includes(asset))) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(response => {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, clone);
              });
              return response;
            });
        })
    );
    return;
  }

  // ---- Default: Network-first with cache fallback ----
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
