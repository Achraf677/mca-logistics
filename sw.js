// MCA LOGISTICS — Service Worker
// Stratégie :
//   - HTML           : network-first (récupère les nouveaux déploiements rapidement), fallback cache hors-ligne
//   - JS / CSS / PNG : cache-first (versionnés via ?v=... ou immutables). MAJ en background.
//   - API Supabase   : passthrough (pas de cache — données live).


const CACHE_VERSION = 'mca-v2026-05-17-v387-phaseX-CH-date-money-utils';

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
  // Phase 91.55 Bug D — Handler toggles Notifications Paramètres
  '/script-params-notifications.js',
  // Phase 91.58 — Tabs internes Encaissement
  '/script-encaissement-tabs.js',
  // Phase 91.63 — Polices globales dynamiques
  '/script-core-fonts.js',
  // Phase 91.64 — Handlers selects Apparence
  '/script-params-apparence.js',
  // Phase 91.65 — A11y normalizer (scope="col" sur <th>)
  '/script-a11y-normalize.js',
  // Phase 91.70 — Hub sub-nav (Finance + Parc auto)
  '/script-hub-subnav.js',
  // Phase X.A (91.90) — Postes extraits de script.js
  '/script-core-postes.js',
  // Phase X.B (91.91) — Templates SMS extraits de script.js
  '/script-core-templates-sms.js',
  // Phase X.C (91.92) — Registre RGPD art. 30 extrait de script.js
  '/script-core-rgpd.js',
  // Phase X.D (91.93) — TCO véhicule UI extrait de script.js
  '/script-core-tco-ui.js',
  // Phase X.E (91.94) — Lettre de voiture CMR extrait de script.js
  '/script-core-lettre-voiture.js',
  // Phase X.F (91.95) — Pull-to-refresh mobile extrait de script.js
  '/script-core-pull-to-refresh.js',
  // Phase X.G (91.96) — Livraisons helpers (conduite + paiement + facture counter)
  '/script-core-livraisons-helpers.js',
  // Phase X.H (91.97) — UI helpers (scrollTop + menu mobile + vue compacte)
  '/script-core-ui-helpers.js',
  // Phase X.I (91.98) — Modèles messages prédéfinis chauffeur
  '/script-core-modeles-messages.js',
  // Phase X.J (91.99) — Fiche tournée PDF extrait de script.js
  '/script-core-fiche-tournee.js',
  // Phase X.K (91.100) — Document viewer modal extrait de script.js
  '/script-core-doc-viewer.js',
  // Phase X.L-Q : 6 modules batch extraits de script.js
  '/script-core-chart-helpers.js',
  '/script-core-image-compress.js',
  '/script-core-pagination.js',
  '/script-core-empty-states.js',
  '/script-core-kanban.js',
  '/script-core-calendrier-livraisons.js',
  // Phase X.R-U : 4 modules supplémentaires
  '/script-core-tresorerie-config.js',
  '/script-core-password-utils.js',
  '/script-core-copier-semaine-planning.js',
  '/script-core-note-interne.js',
  // Phase X.V-AB : 7 modules supplémentaires
  '/script-core-libelles-analyse-ht.js',
  '/script-core-maj-selects.js',
  '/script-core-livraisons-statut-paiement.js',
  '/script-core-reset-filtres-livraisons.js',
  '/script-core-releve-km.js',
  '/script-core-ponctualite-card.js',
  '/script-core-valider-siret.js',
  // Phase X.AC-AG : 5 modules supplémentaires
  '/script-core-conformite-ce561.js',
  '/script-core-grille-jours-planning.js',
  '/script-core-csv-secure.js',
  '/script-core-badge-statut.js',
  '/script-core-favicon-badge.js',
  // Phase X.AH-AM : 5 modules supplémentaires
  '/script-core-notifications-auto.js',
  '/script-core-densite-tableau.js',
  '/script-core-msg-templates.js',
  '/script-core-heures-semaine-range.js',
  '/script-core-entreprise-export-helpers.js',
  // Phase X.AN-AP : date utils + security helpers
  '/script-core-date-range-utils.js',
  '/script-core-date-range-inclusive.js',
  '/script-core-security-helpers.js',
  // Phase X.AQ-AU : 5 modules supplémentaires
  '/script-core-ticket-acces-onglet.js',
  '/script-core-toggle-menu-carb.js',
  '/script-core-toggle-type-jour.js',
  '/script-core-timer-inactivite.js',
  '/script-core-prix-ht.js',
  // Phase X.AV : toast (canonical fan-out)
  '/script-core-toast.js',
  // Phase X.AW : planning sync search helper
  '/script-core-planning-sync-search.js',
  // Phase X.AX : Planning REWRITE FINAL (gros bloc 23 fns)
  '/script-core-planning-rewrite-final.js',
  // Phase X.AY-AZ : 2 IIFEs autonomes
  '/script-core-synchro-admin-polling.js',
  '/script-core-sidebar-hierarchique.js',
  // Phase X.BA-BE : Sprints 3-7 IIFEs
  '/script-core-sprint3-command-palette.js',
  '/script-core-sprint4-hero-sante.js',
  '/script-core-sprint5-side-drawer.js',
  '/script-core-sprint6-bulk-actions.js',
  '/script-core-sprint7-pagination-search.js',
  // Phase X.BF-BJ : Sprints 8-15 IIFEs
  '/script-core-sprint8-tri-colonnes.js',
  '/script-core-sprint9-empty-states.js',
  '/script-core-sprint10-toasts-stacked.js',
  '/script-core-sprint11-formulaires-intelligents.js',
  '/script-core-sprint15-productivite-pgi.js',
  // Phase X.BK-BP : Sprints 16-23 IIFEs (gros bloc)
  '/script-core-sprint16-calendrier-operationnel.js',
  '/script-core-sprint18-tri-universel-th.js',
  '/script-core-sprint19-centre-alertes.js',
  '/script-core-sprint20-rh360.js',
  '/script-core-sprint21-parc360.js',
  '/script-core-sprint22-23-hubs.js',
  // Phase X.BQ-BU : Sprints 25-29 IIFEs
  '/script-core-sprint25-drawer-360.js',
  '/script-core-sprint26-timeline-stats-signature.js',
  '/script-core-sprint28-bugs-cleanup.js',
  '/script-core-sprint29-parametres-pro.js',
  // Phase X.BV : Form livraison enhancements
  '/script-core-form-livraison-enhancements.js',
  // Phase X.BW-BX : FINAL ADMIN LOCK + ADMIN FINAL UX/EXPORTS
  '/script-core-admin-final-lock.js',
  '/script-core-admin-final-ux-exports.js',
  // Phase X.BY : Dashboard rafraichirDashboard
  '/script-core-dashboard-rafraichir.js',
  // Phase X.BZ-CA : Bootstrap admin + garde-fou routes
  '/script-core-admin-bootstrap-domcontent.js',
  '/script-core-garde-fou-routes.js',
  // Phase X.CB-CD : 3 modules admin legacy
  '/script-core-admin-legacy-rentabilite-stats.js',
  '/script-core-admin-legacy-planning-semaine.js',
  '/script-core-admin-final-lock-iife.js',
  // Phase X.CE-CG : Top-level BUG fixes IIFEs
  '/script-core-bug-014-double-click-guard.js',
  '/script-core-bug-018-lifecycle-patches.js',
  '/script-core-storage-patches.js',
  // Phase X.CH : Core date/money utilities
  '/script-core-date-money-utils.js',
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
