# 04 — Application PC

L'app PC est entièrement contenue dans `admin.html` (~215 Ko HTML) +
~30 modules `script-*.js`. Aucun framework. Tout `onclick="X()"` qui
attache directement une fonction `window.X`.

## Sidebar et navigation

Sidebar gauche avec **24 entrées** organisées en 7 hubs (SPRINT 22-23) :

| Hub | Entrée | Module principal |
|---|---|---|
| Pilotage | Dashboard | `script.js` (`rafraichirDashboard`) |
| Pilotage | Livraisons | `script-livraisons.js` |
| Pilotage | Calendrier | `script.js` (SPRINT 16) |
| Pilotage | Planning | `script-planning.js` |
| Pilotage | Alertes | `script-alertes.js` (SPRINT 19) |
| Tiers | Clients | `script-clients.js` |
| Tiers | Fournisseurs | `script-fournisseurs.js` |
| Parc | Véhicules | `script-vehicules.js` |
| Parc | Carburant | `script-carburant.js` + `script-carburant-anomalies.js` |
| Parc | Entretiens | `script-entretiens.js` |
| Parc | Inspections | `script-inspections.js` |
| Équipe | Salariés | `script-salaries.js` |
| Équipe | Heures & Km | `script-heures.js` |
| Équipe | Incidents | `script-incidents.js` |
| Compta | Charges | `script-charges.js` |
| Compta | Encaissement | `script-encaissement.js` |
| Compta | TVA | `script-tva.js` |
| Compta | Rentabilité | `script-rentabilite.js` + `script-rentabilite-multi.js` |
| Compta | Statistiques | `script-stats.js` |
| Système | Paramètres | `script.js` (SPRINT 29 sidebar interne 8 sections) |

Score parité PC (audit 2026-05-04) : **84 %** (proche prêt-prod).

## Modules JS PC

### Modules cœur (toujours chargés au boot)

| Fichier | Rôle |
|---|---|
| `supabase-config.js`, `supabase-client.js`, `supabase-auth.js`, `supabase-admin.js` | SDK Supabase + auth flow admin |
| `supabase-storage-sync.js` | Hook `localStorage.setItem` → push Supabase |
| `entity-supabase-adapter.js` | Factory générique d'adapter |
| `clients-supabase-adapter.js`, `vehicules-supabase-adapter.js`, `salaries-supabase-adapter.js`, `plannings-supabase-adapter.js`, `messages-supabase-adapter.js` | Adapters spécifiques par entité |
| `all-entity-adapters.js`, `legacy-entity-adapters.js` | Glue pour adapters multiples |
| `repo.js` | Couche d'abstraction `Repo.*` |
| `storage-uploader.js` | Helpers Supabase Storage (signed URLs, cache) |
| `security-utils.js` | Hash PBKDF2, anti-CSV-injection |
| `ocr-helper.js` | Wrapper Tesseract.js |
| `auth-2fa.js` | TOTP admin |
| `monitoring.js` | Capture erreurs (Sentry-like) |
| `health-check.js` | Endpoints de healthcheck pour CI |
| `watchdog.js` | Détection blocages JS, redémarrage si freeze |
| `lazy-loader.js`, `lazy-stubs.js` | Mécanique de chargement différé |

### Modules `script-core-*` (helpers transverses)

| Fichier | Rôle |
|---|---|
| `script-core-auth.js` | Flux login admin / salarié, session refresh |
| `script-core-audit.js` | Journal d'audit (insertions `audit_log_entries`) |
| `script-core-branding.js` | Logo entreprise, couleur d'accent personnalisable |
| `script-core-edit-locks.js` | Lock optimiste sur édition fiche |
| `script-core-navigation.js` | `naviguerVers(page)`, sidebar, badges |
| `script-core-periodes.js` | Factory `getPeriodeRange`, `navXxxPeriode`, `bar4` |
| `script-core-recherche.js` | Recherche globale Ctrl+K |
| `script-core-storage.js` | Wrappers `loadSafe`, `lireStockageJSON`, cache mémoire |
| `script-core-ui.js` | `afficherToast`, `openModal`, `ouvrirDrawer`, `emptyState` |
| `script-core-utils.js` | `escapeHtml`, `euros`, `formatDate`, `genId`, validation SIREN/TVA |

### Modules métier

Chacun = un domaine. Toutes les fonctions sont exposées en `window.X`.

| Fichier | Lignes | Domaine principal |
|---|---|---|
| `script-livraisons.js` | ~1300 | Livraisons CRUD, factures, BL |
| `script-clients.js` | ~700 | Clients CRUD, validation SIREN/TVA |
| `script-vehicules.js` | ~1100 | Véhicules + carte grise + finance |
| `script-salaries.js` | ~1200 | Salariés + provisionnement auth |
| `script-charges.js` | ~700 | Charges + lien fournisseurs/carbu/entretiens |
| `script-fournisseurs.js` | ~400 | Fournisseurs CRUD |
| `script-carburant.js` | ~600 | Pleins + reçus Storage + récurrence |
| `script-carburant-anomalies.js` | ~340 | Détection anomalies conso |
| `script-entretiens.js` | ~550 | Entretiens véhicule + suivi km |
| `script-inspections.js` | ~400 | Inspections hebdo |
| `script-incidents.js` | ~150 | Incidents salariés |
| `script-tva.js` | ~700 | Calculs TVA (CGI 298-4), déclarations |
| `script-rentabilite.js` | ~830 | Calculateur rentabilité simple |
| `script-rentabilite-multi.js` | ~840 | Rentabilité multi-véhicules |
| `script-stats.js` | ~280 | Charts CA / dépenses |
| `script-paiements.js` | ~280 | Relances clients |
| `script-encaissement.js` | ~430 | Statuts paiements clients |
| `script-planning.js` | ~1060 | Planning hebdo + absences |
| `script-heures.js` | ~310 | Heures & km par salarié |
| `script-alertes.js` | ~750 | Centre alertes admin (SPRINT 19) |
| `script-exports.js` | ~1900 | Exports CSV / PDF (factures, rapports) |

### Le résiduel `script.js` (664 Ko)

Encore un monolithe contenant 65 zones distinctes :
- Bootstrap admin (DOMContentLoaded, auth check, init nav).
- Helpers Date / popup / storage cache restants.
- `rafraichirDashboard` (hero santé, KPIs, charts).
- 18 sprints UI (S2 à S29) : drawer, pagination, tri, empty states, toasts, command palette, calendrier, drawers 360°, timeline globale, refonte paramètres, etc.
- Templates PDF (lettre de voiture, registre RGPD, fiche tournée).

Plan de découpage détaillé : [`archive/2026-05-03-bundle-splitting.md`](./archive/2026-05-03-bundle-splitting.md). Cible : `script.js` réduit à ~500 lignes après extraction des sprints en modules dédiés.

## Mécanique d'extraction

### Convention "fonctions globales préservées"

Toutes les fonctions extraites de `script.js` vers un `script-X.js`
**doivent** se réassigner sur `window.*` à la fin du module :

```js
// dans script-livraisons.js
function ajouterLivraison() { /* … */ }
window.ajouterLivraison = ajouterLivraison;
```

Sinon, les `onclick="ajouterLivraison()"` du HTML cassent.

### Lazy loading

Module `lazy-stubs.js` installe au boot un stub `window.exporterCSV =
function(...args) { lazyLoad('script-exports').then(() => window.exporterCSV(...args)); }`. Au 1ᵉʳ clic :
1. Le stub charge le module via `<script async=false>`.
2. Le module définit la vraie `window.exporterCSV`.
3. Le stub appelle la vraie fonction.

Limites : la 1ʳᵉ invocation est asynchrone (~50-200 ms). OK pour des
exports, **pas pour `naviguerVers(page)`** qui doit rester synchrone.

## Pré-masquage CSS sidebar (anti-flash)

Lignes 42-56 d'`admin.html` :

```css
.nav-item[data-page="salaries"],
.nav-item[data-page="heures"],
…
{ display: none; }
```

13 entrées masquées par défaut, ré-affichées par JS après vérif des
permissions admin. Empêche le flash de la sidebar complète au boot.
**Patch fragile** à factoriser à terme.

## Spécificités PC vs mobile

- **Drawer 360°** par entité (Salarié S20, Véhicule S21, Client/Fournisseur S25) : panneau latéral riche, tabs (résumé / docs / historique / alertes / actions).
- **Vue Kanban** livraisons (drag & drop entre statuts).
- **Vue Calendrier** opérationnelle (jour/sem/mois/an + DnD).
- **Bulk actions** livraisons (sélection multiple → exporter / marquer payées / supprimer).
- **Timeline globale** (SPRINT 26) : flux chronologique de toutes les actions.
- **Command palette Ctrl+K** : navigation universelle clavier.
- **Score santé + hero ring** dashboard (visualisation indicateur global).
- **Sidebar interne Paramètres** (8 sections : entreprise, alertes, TVA, carburant, sauvegarde, sécurité, équipe, journal).

Détails par page dans [`06-features-by-page.md`](./06-features-by-page.md).
