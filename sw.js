const CACHE_NAME = 'mca-logistics-shell-v4';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './login.html',
  './admin.html',
  './salarie.html',
  './style.css',
  './script.js',
  './chart.min.js',
  './security-utils.js',
  './supabase-config.js',
  './supabase-client.js',
  './supabase-auth.js',
  './supabase-admin.js',
  './supabase-storage-sync.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(OFFLINE_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').indexOf('text/html') !== -1;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\/(auth|storage|rest|functions)\/v1\//.test(url.pathname)) return;

  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        });
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match('./admin.html') || caches.match('./login.html');
        });
      })
    );
    return;
  }

  if (/\.(?:css|js)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        });
        return response;
      });
    })
  );
});
