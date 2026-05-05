# 02 — Architecture

## Stack technique

| Couche | Techno | Notes |
|---|---|---|
| Frontend PC | HTML + Vanilla JS + CSS | `admin.html` + ~30 modules `script-*.js` |
| Frontend mobile | HTML + Vanilla JS + CSS | `m.html` (admin) + `salarie.html` (chauffeur) |
| Service Worker | `sw.js` | Network-first sur HTML, cache-first sur JS / CSS, passthrough Supabase |
| Auth | Supabase Auth | Email + password admins, provisionnement salariés via edge function |
| API | Supabase JS SDK v2 | Chargé via CDN jsdelivr |
| DB | PostgreSQL (Supabase) | 23 tables, RLS, triggers, indexes |
| Storage | Supabase Storage | 7 buckets privés (signed URLs TTL 10 min) |
| Realtime | Supabase Realtime | Sync instantanée admin1 ↔ admin2 |
| Hosting | Cloudflare Pages | Branche dev déployée auto en preview |
| OCR | Tesseract.js | Lazy-loaded, offline, gratuit (cartes grises, factures, RIB) |
| Charts | Chart.js | Lazy-loaded sur PC dashboard / rentabilité |

## Topologie des fichiers

```
mca-logistics/
├── admin.html                  PC (admin complet, 215 Ko)
├── m.html                      Mobile admin (shell léger 8 Ko)
├── salarie.html                Mobile chauffeur (52 Ko, page séparée)
├── login.html                  Auth (admin + chauffeur)
├── index.html                  Redir → login
├── design.html                 Mockup UI (référence design v3.64)
├── sw.js                       Service Worker
├── manifest.json               PWA manifest
│
├── supabase-*.js               Auth, client, admin, sync legacy
├── *-supabase-adapter.js       Adapters localStorage ↔ tables natives
├── repo.js                     Couche d'abstraction Repo.* sur les entités
├── storage-uploader.js         Helpers Supabase Storage
├── ocr-helper.js               Wrapper Tesseract.js
│
├── script-core-*.js            Helpers communs (auth, navigation, UI, periodes…)
├── script-<domaine>.js         Code métier par domaine (livraisons, clients, etc.)
├── script.js                   Reliquat monolithique PC (664 Ko, à découper)
├── script-mobile.js            App mobile complète (526 Ko)
│
├── lazy-loader.js              Loader pour modules différés
├── lazy-stubs.js               Stubs window.X qui chargent le module au 1er appel
│
├── infra/
│   ├── supabase/               Migrations SQL versionnées (001 → 031)
│   │   └── functions/          Edge functions Deno
│   ├── backup/                 Scripts backup chiffrés vers R2
│   └── design/                 Mockups HTML (3 options visuelles)
│
└── tests/
    ├── business-rules.test.js          Tests unitaires Node natif
    ├── financial-regressions.test.js   Régressions calculs financiers
    └── e2e/                            Tests Playwright
```

## Flux de données

### Sync local ↔ Supabase

Historiquement, l'app stockait tout dans `localStorage`. La migration
vers Supabase est progressive : pour chaque entité, un **adapter**
synchronise localStorage ↔ table Postgres native.

```
        ┌─────────────────────────────┐
        │   localStorage (clé domaine)│
        └──────────────┬──────────────┘
                       │ écriture
                       ▼
        ┌─────────────────────────────┐
        │ supabase-storage-sync.js    │  hook localStorage.setItem
        │ (proxy sur le prototype)    │
        └──────────────┬──────────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
   ┌────────────────┐    ┌────────────────────┐
   │ app_state      │    │ tables natives     │
   │ .payload (legacy│    │ (clients, livraisons│
   │  jsonb, à éteindre)│  │  vehicules, …)    │
   └────────────────┘    └────────────────────┘
                                 ▲
                                 │ realtime
                                 │
   ┌─────────────────────────────┴─────────────┐
   │   Autre device (admin2 / mobile)          │
   └───────────────────────────────────────────┘
```

État actuel :

- **Tables natives** : clients, fournisseurs, vehicules, salaries,
  livraisons, charges, carburant, entretiens, inspections, incidents,
  paiements, plannings_hebdo, absences_periodes, messages, alertes_admin,
  postes, salaries_documents, inspection_photos, audit_log_entries.
- **Legacy `app_state.payload`** : encore utilisé par certaines vues
  réservées admin (cf. migration `024_app_state_admin_only.sql`,
  `030_purge_app_state_legacy_entities.sql`). En cours d'extinction.

### Flux d'écriture utilisateur

1. L'utilisateur saisit dans le formulaire HTML (`<input>`).
2. `onclick="ajouterX()"` → fonction métier (`script-X.js`).
3. La fonction écrit dans `localStorage` (legacy) **et** appelle
   l'adapter Supabase (`adapter.upsert(row)`).
4. L'adapter fait un `INSERT/UPDATE` sur la table native.
5. Supabase Realtime broadcast → tout autre client connecté reçoit
   l'événement, met à jour son localStorage, re-render.

### Service Worker

`sw.js` cache les assets statiques (HTML / JS / CSS) avec stratégie :

- **HTML** : network-first (toujours tenter une version fraîche).
- **JS / CSS** : cache-first avec révision via paramètre `?v=N`.
- **API Supabase** : passthrough (jamais cachée).
- **Storage signed URLs** : passthrough (TTL 10 min géré côté serveur).

Lors du bump de version, **bumper `CACHE_VERSION` dans `sw.js`** ET
le query string `?v=NN` dans `admin.html`, `m.html`, `salarie.html`,
`login.html`.

## Sécurité

- **RLS activé sur toutes les tables**. Les chauffeurs ne voient que
  leurs propres lignes via `auth.uid()` filtré sur `salarie_id`.
- **Service role key** : jamais exposé côté client. Utilisé uniquement
  dans les edge functions.
- **Signed URLs Storage** : TTL 10 min, jamais d'URL publique.
- **`security-utils.js`** : helpers PBKDF2 pour le hash mot de passe
  initial chauffeur (avant remplacement par Supabase Auth).
- **Verrou d'édition concurrent** (`script-core-edit-locks.js`) : un
  seul admin peut éditer une fiche à la fois (lock optimistic via
  Realtime).
- **Anti-CSV-injection** : `csvCelluleSecurisee()` préfixe les valeurs
  commençant par `=`, `+`, `-`, `@`.
- **2FA** : `auth-2fa.js` pour l'admin (TOTP).

## Performance

État actuel **non optimisé** :
- `script.js` : 664 Ko (monolithe en cours de découpage).
- `script-mobile.js` : 526 Ko.
- Boot admin : ~1.3 Mo de JS au chargement initial (TTI ~3.5 s en 4G).

Plan de découpage détaillé dans [`archive/2026-05-03-bundle-splitting.md`](./archive/2026-05-03-bundle-splitting.md). Cible : ~250 Ko critiques, le reste lazy-loadé.

Mécanisme déjà en place :
- `lazy-loader.js` charge un module à la demande.
- `lazy-stubs.js` installe des stubs `window.X` qui chargent leur
  module au 1ᵉʳ appel sans casser les `onclick=` HTML.
