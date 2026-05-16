// MCA LOGISTICS — Service Worker
// Stratégie :
//   - HTML           : network-first (récupère les nouveaux déploiements rapidement), fallback cache hors-ligne
//   - JS / CSS / PNG : cache-first (versionnés via ?v=... ou immutables). MAJ en background.
//   - API Supabase   : passthrough (pas de cache — données live).


const CACHE_VERSION = 'mca-v2026-05-16-v307-phase91-43-carburant';

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
  // Design system tokens (Phase 4 / PR-1) — prefixe --ds-* additif
  '/style-tokens.css',
  // Design shell (Phase 4 / PR-2) — restyle sidebar + topbar
  '/style-design-shell.css',
  // Design dashboard (Phase 4 / PR-4) — restyle KPIs + cards + tables
  '/style-design-dashboard.css',
  // Design feedback (Phase 4 / PR-5) — toasts + empty states + skeletons
  '/style-design-feedback.css',
  // Design livraisons (Phase 4 / PR-6) — filtres + table + bulk-bar + kanban
  '/style-design-livraisons.css',
  // Design modale + forms (Phase 4 / PR-7) — modal + form-group + drawers
  '/style-design-modal.css',
  // Design charges (Phase 4 / PR-8) — nav-periode + recurrence + montants
  '/style-design-charges.css',
  // Design carburant (Phase 4 / PR-9) — anomalies + doublons + conso L/100km
  '/style-design-carburant.css',
  // Design entretiens (Phase 4 / PR-10) — type-badge + source-badge + echeance
  '/style-design-entretiens.css',
  // Design vehicules (Phase 4 / PR-11) — TCO + plaques + statuts
  '/style-design-vehicules.css',
  // Design equipe (Phase 4 / PR-12) — s22-bandeau + avatar + incidents + credentials
  '/style-design-equipe.css',
  // Design clients + fournisseurs bundle (Phase 4 / PR-13+14) — filtres + risque + drawer onglets
  '/style-design-clients-fournisseurs.css',
  // Design planning (Phase 4 / PR-15) — overview cards + jour-types + toolbar
  '/style-design-planning.css',
  // Design alertes (Phase 4 / PR-16) — s19 KPIs + s20 drawer + s25 rules
  '/style-design-alertes.css',
  // Design rentabilite + stats bundle (Phase 4 / PR-17+18) — KPI tiles + simulator + previsions
  '/style-design-rentabilite-stats.css',
  // Design calendrier (Phase 4 / PR-19) — grid + cells + livraisons dots
  '/style-design-calendrier.css',
  // Design parametres (Phase 4 / PR-20) — page-parametres cards + s24 toggles + s26 sig/timeline
  '/style-design-parametres.css',
  // Design setup wizard (Phase 4 / PR-21) — overrides inline JS styles
  '/style-design-setup-wizard.css',
  // Design mobile ds (Phase 4 / PR-22) — restyle .m-* avec tokens ds
  '/style-design-mobile-ds.css',
  // Phase 2 HTML refonte — composants ds canoniques (Charges page premiere)
  '/style-refonte-charges.css',
  // Phase 2 refonte HTML — utility classes pour réduire inline styles
  '/style-refonte-utilities.css',
  // Phase 5 refonte HTML — dashboard hero row (santé v2 + points d'attention v2)
  '/style-design-dashboard-hero.css',
  // Phase 6 refonte HTML — title-row + period-row pattern (réutilisable)
  '/style-design-section-pattern.css',
  // Phase 7 refonte HTML — script title-row counts cross-pages
  '/script-titlerow.js',
  // Phase 10 refonte HTML — dashboard dash-charts (area 14j + donut statuts)
  '/style-design-dashboard-charts.css',
  '/script-dashboard-charts.js',
  // Phase 12 refonte HTML — period-chips wiring (sync chips ↔ existing selects)
  '/script-period-chips.js',
  // Phase 13 refonte HTML — empty states stylisés cross-pages
  '/style-design-empty-states.css',
  // Phase 14 refonte HTML — tables refinement (pills + zebra + hover + sortable)
  '/style-design-tables-refine.css',
  // Phase 15 refonte HTML — modals + drawer refinement (legacy + mockup patterns)
  '/style-design-modals-refine.css',
  // Phase 23 refonte HTML — livraisons table refonte (mockup-aligned)
  '/style-design-livraisons-refonte.css',
  '/script-livraisons-polish.js',
  // Phase 29 refonte HTML — topbar refine (cross-page, mockup-aligned)
  '/style-design-topbar-refine.css',
  // Phase 32 refonte HTML — drawer 360 livraison (slide from right, 4 tabs)
  '/style-design-livraisons-drawer.css',
  '/script-livraisons-drawer.js',
  // Phase 16 refonte HTML — mobile refinement (m.html + salarie.html)
  '/style-design-mobile-refine.css',
  // Phase 17 refonte HTML — dashboard finish (status-card v2 + grid-2)
  '/style-design-dashboard-finish.css',
  '/script-dashboard-finish.js',
  // Phase 3 refonte HTML — dashboard preview "Points d'attention"
  '/script-dashboard-attention.js',
  // Solution B refonte : fake data seed (no-op sauf ?seed=1 dans URL)
  '/script-dev-seed.js',
  '/script-charges-kpis-categorie.js',
  // Phase 48 refonte HTML — Charges charts (Évolution + Répartition)
  '/script-charges-charts.js',
  // Phase 60 V7 H5/H6/H7 — Charts manquants Carburant/Encaissement/TVA
  '/script-extra-charts.js',
  // Phase 60 V7 H21 — Équipe Vue d'ensemble cards
  '/script-equipe-overview.js',
  // Phase 60 V7 polish — Inspections exports PDF/CSV/Excel
  '/script-exports-inspections.js',
  // Phase 60 V7 polish — Encaissement legacy : factures_emises/avoirs/acomptes
  '/script-encaissement-legacy.js',
  // Phase 60 V7 polish — TVA Historique déclarations (tva_declarations)
  '/script-tva-historique.js',
  // Phase 86 — TVA KPI counts : échéance dynamique + couleur solde + CA HT subs
  '/script-tva-counts.js',
  // Phase 60 V7 polish — Paramètres Catégories charges custom (charges_categories)
  '/script-charges-categories.js',
  // Phase 60 V7 polish — Fix boutons morts (5 fonctions undefined)
  '/script-dead-buttons-fix.js',
  // Phase 60 V7 polish — Modal Enregistrer paiement (manquante)
  '/script-modal-paiement.js',
  // Phase 60 V7 polish — Stubs 4 fns silent-fail
  '/script-stubs-fns.js',
  // Phase 2 HTML refonte — Livraisons chips toolbar handler
  '/script-livraisons-chips.js',
  // Phase 2 HTML refonte — Equipe section-head counts
  '/script-equipe-counts.js',
  // Phase 2 HTML refonte — Vehicules counts (total + alertes CT)
  '/script-vehicules-counts.js',
  // Phase 2 HTML refonte — Planning section-head counts (semaine + planifies)
  '/script-planning-counts.js',
  // Phase 2 HTML refonte — Clients/Fournisseurs section-head counts + KPI
  '/script-clients-fournisseurs-counts.js',
  // Phase 39 — Clients/Fournisseurs chips toolbar filter
  '/script-clients-fournisseurs-kpis.js',
  // Phase 47 — Clients/Fournisseurs table post-render (Ville/SIREN columns)
  '/script-clients-table-polish.js',
  // Phase 48 — Véhicules fleet card grid (mockup-aligned)
  '/script-vehicules-cards.js',
  // Phase 2 HTML refonte — Alertes section-head counts
  '/script-alertes-counts.js',
  // Phase 2 HTML refonte — Stats/Calendrier sub-meta (periode mirror + livraisons count)
  '/script-stats-calendrier-counts.js',
  // Phase 40 refonte HTML — Encaissement KPI grid + section-head counts
  '/script-encaissement-counts.js',
  // Phase 42 refonte HTML — Incidents KPI grid counts
  '/script-incidents-counts.js',
  // Phase 42 refonte HTML — Heures KPI grid counts
  '/script-heures-counts.js',
  // Phase 43 refonte HTML — Inspections KPI grid counts
  '/script-inspections-counts.js',
  // Phase 44 refonte HTML — Entretiens type chips toolbar
  '/script-entretiens-chips.js',
  // Phase 51 refonte HTML — Entretiens alert banner (CT échéances)
  '/script-entretiens-alert.js',
  // Phase 45 refonte HTML — Brouillons IA KPI grid counts
  '/script-brouillons-counts.js',
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
  '/script-equipe-hub.js',
  '/script-rentabilite.js',
  '/script-rentabilite-multi.js',
  // H12 audit-v6 — Rentabilité KPI grid
  '/script-rent-kpis.js',
  '/script-carburant.js',
  '/script-carburant-anomalies.js',
  '/script-carburant-table.js',
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
  '/script-charges-recurrence.js',
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
  '/smart-upload.js',
  '/script-core-smart-upload.js',
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
  '/script-core-dso.js',
  '/script-core-dashboard-kpis.js',
  '/script-drawer-360-pc-parite.js',
  '/script-ai-chat.js',
  '/script-ai-brouillons.js',
  '/script-cout-ia.js',
  '/lazy-loader.js',
  '/lazy-stubs.js',
  '/script-salarie.js',
  '/offline-queue.js',
  '/health-check.js',
  '/watchdog.js',
  '/manifest.json',
  '/monitoring.js',
  '/bug-report.js',
  // Hotfix M3 (2026-05-09) — assets manquants au precachage, recuperes
  // via runtime cache-first jusqu'ici (degrade hors-ligne au premier load).
  '/plannings-supabase-adapter.js',
  '/legacy-entity-adapters.js',
  '/script-core-stats-helpers.js',
  '/script-exports.js',
  '/auth-2fa.js',
  // Mobile exports PDF (parite PC partielle Livraisons / Charges / Encaissement)
  '/script-mobile-exports.js',
  // Setup wizard onboarding (1ere connexion admin) — parite PC + mobile
  '/script-setup-wizard.js',
  // PR #51 (2026-05-09) — bouton "Vider le cache" mobile (m.html parametres)
  '/script-cache-clear.js',
  // PR #51 — edit-locks bootstrap (wrappe ouvrirEditLivraison/Charge/Client)
  '/script-edit-locks-bootstrap.js',
  // #74 audit Chrome : inline scripts admin extraits vers fichier externe
  '/script-boot-admin.js',
];

// Pages essentielles chauffeur — DOIVENT etre servies depuis le cache hors-ligne
// (network-first avec timeout court : si le reseau ne repond pas en 3s, fallback cache)
const HTML_NET_TIMEOUT_MS = 3000;

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
    // Network-first avec timeout court — recupere les nouveaux deploiements
    // mais bascule rapidement sur le cache si le reseau est lent/coupe (chauffeur en zone blanche).
    event.respondWith((async () => {
      const cachedFallback = caches.match(req).then((r) => r || caches.match('/salarie.html') || caches.match('/admin.html'));
      try {
        const networkPromise = fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('html_timeout')), HTML_NET_TIMEOUT_MS)
        );
        return await Promise.race([networkPromise, timeoutPromise]);
      } catch (_) {
        const fb = await cachedFallback;
        if (fb) return fb;
        // Dernier recours : reponse texte minimaliste
        return new Response('<h1>Hors ligne</h1><p>Reconnexion necessaire</p>', { headers: { 'Content-Type': 'text/html' } });
      }
    })());
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
