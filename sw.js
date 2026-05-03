// MCA LOGISTICS — Service Worker
// Stratégie :
//   - HTML           : network-first (récupère les nouveaux déploiements rapidement), fallback cache hors-ligne
//   - JS / CSS / PNG : cache-first (versionnés via ?v=... ou immutables). MAJ en background.
//   - API Supabase   : passthrough (pas de cache — données live).

const CACHE_VERSION = 'mca-v2026-05-03-mobile-v3_46-sync-bidir-85';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/salarie.html',
  '/login.html',
  '/m.html',
  '/style-mobile.css',
  '/script-mobile.js',
  '/style.css',
  '/script.js',
  '/chart.min.js',
  '/security-utils.js',
  '/supabase-config.js',
  '/supabase-client.js',
  '/supabase-auth.js',
  '/supabase-admin.js',
  '/supabase-storage-sync.js',
  '/repo.js',
  '/script-inspections.js',
  '/script-incidents.js',
  '/script-rentabilite.js',
  '/script-rentabilite-multi.js',
  '/script-carburant.js',
  '/script-carburant-anomalies.js',
  '/script-entretiens.js',
  '/script-alertes.js',
  '/script-stats.js',
  '/script-paiements.js',
  '/script-heures.js',
  '/script-planning.js',
  '/script-tva.js',
  '/script-fournisseurs.js',
  '/script-clients.js',
  '/script-charges.js',
  '/script-salaries.js',
  '/script-vehicules.js',
  '/script-livraisons.js',
  '/script-encaissement.js',
  '/ocr-helper.js',
  '/clients-supabase-adapter.js',
  '/entity-supabase-adapter.js',
  '/vehicules-supabase-adapter.js',
  '/salaries-supabase-adapter.js',
  '/all-entity-adapters.js',
  '/storage-uploader.js',
  '/script-core-utils.js',
  '/script-core-storage.js',
  '/script-core-ui.js',
  '/script-core-auth.js',
  '/script-core-periodes.js',
  '/script-core-navigation.js',
  '/script-core-edit-locks.js',
  '/script-core-branding.js',
  '/script-core-audit.js',
  '/script-core-recherche.js',
  '/lazy-loader.js',
  '/lazy-stubs.js',
  '/script-salarie.js',
  '/health-check.js',
  '/watchdog.js',
  '/manifest.json',
  '/monitoring.js',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Chaque asset est tenté individuellement — un échec n'empêche pas les autres
      return Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url).catch(() => null)));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase / API externes / Google Fonts : passthrough, pas de cache
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('unpkg.com') || url.hostname.includes('tessdata.projectnaptha')) {
    return;
  }

  // Uniquement notre propre origine
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get('accept') || '';
  const isHTMLNav = req.mode === 'navigate' || accept.includes('text/html');

  if (isHTMLNav) {
    // Network-first pour les pages HTML — récupère les nouveaux déploiements
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/admin.html')))
    );
    return;
  }

  // Cache-first pour assets statiques (JS, CSS, images, fonts locales)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Revalidation background — met à jour le cache si une nouvelle version existe
        fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, res.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }
      // Pas en cache → fetch network, puis cache le résultat
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});

// Permet à la page de forcer un update immédiat via postMessage('skipWaiting')
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
