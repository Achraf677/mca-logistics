# MCA Logistics

PGI (progiciel de gestion intégré) interne pour MCA Logistics — entreprise de
transport / livraison. Site web vanilla JS hébergé sur Cloudflare Pages,
backend Supabase (auth + PostgreSQL + Storage + Realtime).

## Utilisateurs

- **Admins** : Achraf et Mohammed — voient et modifient TOUT le site, en
  partage instantané (les modifications de l'un sont visibles par l'autre
  immédiatement).
- **Salariés (chauffeurs)** : interface dédiée `salarie.html`, voient leurs
  propres données : planning, livraisons, heures, véhicule affecté, peuvent
  saisir leurs pleins de carburant, photos de tickets, et envoyer des messages.

## Stack technique

- **Frontend** : Vanilla JavaScript (pas de framework), HTML, CSS
- **Hosting** : Cloudflare Pages
- **Backend** : Supabase (project `lkbfvgnhwgbapdtitglu`)
  - PostgreSQL avec 22 tables, RLS, triggers, indexes
  - Storage : 7 buckets (privés pour cartes grises, docs, photos, etc.)
  - Realtime : sync instant entre devices
  - Auth : email/password admin + provisionnement salariés via edge function

## Structure du code (frontend)

### Pages
- `index.html` — redirection vers login
- `login.html` — page de connexion (admin / salarié)
- `admin.html` — interface admin (gros, charge tous les modules)
- `salarie.html` — interface salarié (tournée, heures, carburant, messages)

### Modules JS

**Sync Supabase / Storage**
- `supabase-config.js` / `supabase-client.js` / `supabase-auth.js` / `supabase-admin.js`
- `supabase-storage-sync.js` — sync legacy localStorage ↔ `app_state.payload` (en voie d'extinction)
- `entity-supabase-adapter.js` — factory générique pour adapters
- `clients-supabase-adapter.js` / `vehicules-supabase-adapter.js` / `salaries-supabase-adapter.js` — sync localStorage ↔ tables natives Supabase
- `storage-uploader.js` — helpers Supabase Storage (upload, signed URL, download, cache)
- `repo.js` — couche d'abstraction Repo.* pour les entités

**Code métier modulaire** (extrait du monolithe `script.js`, chacun = un domaine)
- `script-livraisons.js` (34 fonctions) — livraisons CRUD, statuts, factures
- `script-clients.js` (20 fonctions) — clients CRUD, validation SIREN
- `script-vehicules.js` (28 fonctions) — véhicules + carte grise Storage
- `script-salaries.js` (42 fonctions) — salariés + docs Storage + provisionnement auth
- `script-charges.js` (16 fonctions) — charges + lien fournisseurs/carburant/entretiens
- `script-fournisseurs.js` (6 fonctions) — fournisseurs CRUD
- `script-carburant.js` (24 fonctions) — pleins, reçus Storage, récurrence
- `script-entretiens.js` (22 fonctions) — entretiens véhicule, suivi km
- `script-tva.js` (41 fonctions) — calculs TVA (CGI 298-4), déclarations
- `script-rentabilite.js` (32 fonctions) — calculateur rentabilité
- `script-stats.js` (9 fonctions) — graphiques CA/dépenses
- `script-paiements.js` (11 fonctions) — relances clients
- `script-planning.js` (46 fonctions) — planning hebdo + absences
- `script-heures.js` (15 fonctions) — heures & km par salarié
- `script-messages.js` (15 fonctions) — chat admin ↔ salarié + photos
- `script-inspections.js` (18 fonctions) — inspections véhicule hebdo
- `script-incidents.js` (6 fonctions) — incidents salariés
- `script-alertes.js` (9 fonctions) — centre alertes admin
- `script-exports.js` (27 fonctions) — exports CSV / PDF (factures, rapports)
- `script.js` — core résiduel (15K lignes) : navigation, helpers, auth flow, etc.

**Service Worker**
- `sw.js` — cache strategy : network-first HTML, cache-first JS/CSS, passthrough Supabase

**Convention** : toutes les fonctions vivent au scope global (`window.X = ...`),
donc tous les `onclick="X()"` du HTML continuent de fonctionner après extraction.

## Backend — Migrations Supabase

Toutes les migrations sont versionnées dans `infra/supabase/00X_*.sql` :

```
001_init.sql                          schema initial (22 tables, RLS, FK, indexes)
002_auth_login_bridge.sql             auth admin/salarié
003_admin_salaries_policies.sql       RLS policies salariés
004_remote_app_state.sql              app_state.payload (legacy sync)
005_normalize_admin_display_names.sql cleanup admins
006_inspection_storage.sql            bucket inspections-photos
007_company_assets_storage.sql        bucket logo entreprise
008_phase0_foundations.sql            backup + triggers updated_at + colonnes manquantes
009_phase0_storage_buckets.sql        5 buckets Storage privés (cartes grises, docs, etc.)
010_clients_full_columns.sql          colonnes clients (siren, tva_intracom, etc.)
011_clients_realtime.sql              realtime ON public.clients
012_vehicules_full_columns.sql        colonnes véhicules (assurance, finance jsonb, etc.)
013_legacy_app_state_to_native.sql    triggers transition app_state → tables natives
014_salaries_full_columns.sql         colonnes salariés + realtime
015_salaries_docs_metadata.sql        docs jsonb sur public.salaries + realtime salaries_documents
```

**Edge functions** (déployées via Supabase Dashboard) :
- `infra/supabase/functions/provision-salarie-access/` — crée auth user + profile + salarié
- `infra/supabase/functions/delete-salarie-access/` — supprime un salarié

## Tests

`tests/financial-regressions.test.js` — tests de régression sur les calculs financiers.

## Développement

### Lien Cloudflare Pages preview
Chaque commit sur la branche `claude/add-supabase-mcp-CuBe2` est déployé
automatiquement sur :
https://claude-add-supabase-mcp-cube.mca-logistics.pages.dev

### Cache busting
Quand on modifie un script, **bumper la version `?v=20260429-XX`** dans
`admin.html` et `salarie.html` (pour forcer les browsers à récupérer la
nouvelle version au lieu du cache). Pareil pour `CACHE_VERSION` dans `sw.js`.

### Dashboards Supabase
- Tables : https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/editor
- Storage : https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/storage/buckets
- Auth : https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/auth/users
- SQL : https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/sql/new

## Règles métier critiques

- **Validation SIREN** : 9 chiffres exactement
- **Validation TVA intracom FR** : algorithme CGI art. 289 II
- **TVA carburant déductible** selon genre véhicule (CGI art. 298-4-1° et 298-4 D)
- **Snapshots client dans livraisons** : `client_siren`, `client_tva_intracom`,
  `client_pays` figés à la création (pour préserver l'historique)
- **Statut livraison ↔ statut paiement = découplés** (intentionnellement)
- **Verrou d'édition concurrent** : un seul admin peut éditer une fiche à la fois
- **Téléchargements de fichiers** : signed URLs Storage avec TTL 10 min
