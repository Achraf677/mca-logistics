# Accès tiers — registre des tokens & APIs

> **Source de vérité** des accès donnés à Claude / agents IA / serveurs MCP.
> À tenir à jour à chaque création ou révocation.
>
> **🔒 Règle d'or** : aucune valeur de token dans ce fichier (ni nulle part dans le repo).
> Tous les tokens runtime vivent dans **Supabase Edge Function Secrets**.
> Voir `docs/secrets-management.md` pour le process complet.

Dernière mise à jour : 2026-05-06

---

## Table des accès

| Service | Statut | Type d'accès | Stockage runtime | Comment révoquer |
|---|---|---|---|---|
| **Supabase** (`lkbfvgnhwgbapdtitglu`) | ✅ Actif | PAT (admin) + MCP officiel | Secret `MCA_SUPABASE_PAT` | https://supabase.com/dashboard/account/tokens |
| **GitHub** (`Achraf677/mca-logistics`) | ✅ Actif | MCP server officiel | OAuth (pas de secret stocké) | GitHub Settings → Applications → "Claude Code" → Revoke |
| **Sentry** (`mca-logistics.sentry.io`) | ✅ Actif | Personal Token (lecture) | Secret `SENTRY_TOKEN` | https://mca-logistics.sentry.io/settings/account/api/auth-tokens/ |
| **Pennylane** (compta) | ✅ Actif | Personal Token (lecture) | Secret `PENNYLANE_TOKEN` | https://app.pennylane.com/companies/23200904/settings/connectivity?subtab=developers |
| **Qonto** (banque) | ✅ Actif | Internal API (login + secret) | Secrets `QONTO_LOGIN` + `QONTO_SECRET_KEY` | https://app.qonto.com/organizations/mca-logistics-3134/settings/integrations |
| **Google AI Studio** (Gemini) | ✅ Actif | API key (gratuit, sans CB) | Secret `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey |
| **OpenRouteService** (HeiGIT) | ✅ Actif | API key (gratuit, sans CB) | Secret `ORS_API_KEY` | https://openrouteservice.org/dev/#/home |
| **Cloudflare Pages** | ❌ Pas connecté | — | — | — |
| **Teleroute** (sous-traitance fret) | ❌ Pas connecté (futur) | — | — | — |
| **Google Maps API** | ❌ Abandonné | Remplacé par OpenRouteService | — | — |

---

## Détail par service

### Supabase
- **MCP officiel** : `mcp__supabase__execute_sql`, `apply_migration`, `list_tables`, `get_logs`, `get_advisors`, etc.
- **PAT** (`MCA_SUPABASE_PAT`) : admin compte Supabase via Management API. Stocké aussi en Edge Function Secret au cas où une edge function en aurait besoin (ex: provisioning auto de projets de branche). Au runtime app classique, **pas utilisé** — l'edge function utilise `SUPABASE_SERVICE_ROLE_KEY` (auto-injecté par Supabase, jamais à gérer).
- **Révoquer si** : changement de prestataire DB, suspicion fuite.

### GitHub
- **MCP officiel** : `mcp__github__create_pull_request`, `merge_pull_request`, `pull_request_read`, etc.
- Auth = OAuth Claude Code, pas de secret à stocker.
- **Révoquer si** : changement de fork, suspicion fuite.

### Sentry — Personal Token
- **Scopes** : `event:read`, `org:read`, `project:read` (lecture seule)
- **Secret runtime** : `SENTRY_TOKEN`
- **Usage** : query l'API Sentry pour lire issues + stack traces (debug, monitoring auto).
- **Endpoint test** : `GET https://sentry.io/api/0/organizations/mca-logistics/projects/`

### Pennylane (compta)
- **Company ID** : `23200904`
- **API base URL** : `https://app.pennylane.com/api/external/v2/`
- **Auth header** : `Authorization: Bearer <PENNYLANE_TOKEN>`
- **Secret runtime** : `PENNYLANE_TOKEN`
- **Validité** : illimitée → rotation manuelle tous les 6 mois (voir TODO).
- **Scopes accordés (15, lecture seule)** :
  - Établissements bancaires, Exercices fiscaux
  - **Export FEC** (Fichier des Écritures Comptables — déclencheur principal)
  - Catégories, Clients, Comptes bancaires, Comptes comptables
  - Devis, Écritures comptables, Factures client, Factures fournisseurs
  - Fournisseurs, Journaux, Produits, Transactions
- **Usage prévu MCA** :
  - Import FEC mensuel → mise à jour auto charges/paiements/clients
  - Synchro statuts paiement factures (Pennylane source de vérité)
  - JAMAIS d'écriture vers Pennylane (token read-only)

### Qonto (banque)
- **Login (organization slug)** : `mca-logistics-3134`
- **Format Auth Qonto** : `Authorization: <login>:<secret_key>` (pas Bearer, Internal API)
- **API base URL** : `https://thirdparty.qonto.com/v2/`
- **Secrets runtime** : `QONTO_LOGIN` + `QONTO_SECRET_KEY`
- **Scopes Internal API** (lecture seule par design) :
  - `GET /v2/organization` (org + comptes bancaires + soldes)
  - `GET /v2/transactions` (liste transactions)
  - `GET /v2/memberships` (membres team)
  - `GET /v2/attachments` (justificatifs)
- **Sécurité** : Internal API Qonto = lecture seule par design, pas de risque d'initier des virements.
- **Usage prévu MCA** :
  - Synchro transactions → auto-cocher "payé" sur charges/livraisons
  - Détection auto fournisseurs/clients via libellé virement
  - Rapprochement bancaire mensuel (combiné avec FEC Pennylane)

### Google AI Studio — Gemini API
- **Origine** : créée via https://aistudio.google.com (PAS via Google Cloud Billing)
- **Secret runtime** : `GEMINI_API_KEY`
- **Free tier permanent** : 1500 req/jour Gemini Flash, 15 req/min — **sans CB rattachée → impossible d'être facturé**
- **API base URL** : `https://generativelanguage.googleapis.com/v1beta/`
- **Auth** : query param `?key=<GEMINI_API_KEY>` ou header `x-goog-api-key`
- **Usage prévu MCA** :
  - OCR factures complexes (ce que Tesseract rate)
  - Auto-fill smart depuis photo (ticket carburant, RIB, justificatif)
  - Détection anomalies sur charges
  - Génération texte (descriptions livraison, lettres relance)
  - Chatbot interne MCA (query Supabase + réponse)

### OpenRouteService (HeiGIT) — distance / geocoding / routing
- **Origine** : https://openrouteservice.org (boîte allemande HeiGIT, basée sur OpenStreetMap)
- **Secret runtime** : `ORS_API_KEY`
- **Free tier permanent** : 2000 requêtes/jour, sans CB
- **API base URL** : `https://api.openrouteservice.org/`
- **Auth** : header `Authorization: <ORS_API_KEY>`
- **Endpoints utilisés** :
  - `POST /v2/matrix/driving-car` (matrice distance N points → N points)
  - `POST /v2/directions/driving-hgv` (itinéraire poids-lourd avec contraintes)
  - `GET /geocode/search?text=<adresse>` (geocoding adresse → coords)
  - `POST /v2/isochrones/driving-car` (zones desservies)
  - `POST /optimization` (optimisation tournée multi-stops, TSP)
- **Usage prévu MCA** :
  - Calcul auto km livraison (départ → arrivée)
  - Autocomplete adresse client (geocoding Pelias)
  - Optimisation tournée multi-stops
  - Profil HGV pour contraintes camion (hauteur, poids, ADR)

### Cloudflare (host des pages)
- **Pas d'accès donné**. Déploiement passe par webhook GitHub → Cloudflare Pages auto-deploy.
- **Si besoin futur** (purger cache CDN, créer domain via API, etc.) :
  - Cloudflare → My Profile → API Tokens → Create Token
  - Scopes minimum : `Pages:Edit` sur `mca-logistics` uniquement
  - Stockage : ajouter en secret Edge Functions

### Teleroute (sous-traitance fret) — non branché
- À recreuser quand l'accès sera obtenu.
- **Si activé** : créer un user technique dédié (pas le user perso) avec scopes lecture offres uniquement.

### Google Maps API — abandonné
- **Décision 2026-05-06** : remplacé par **OpenRouteService**.
- **Raison** : Maps nécessite CB attachée + risque facture surprise. ORS est gratuit à vie sans CB et offre en plus optimisation tournée + profil HGV camion natif.

---

## Procédure de révocation rapide (en cas de doute / fuite)

**Ordre par criticité** :

1. **Supabase PAT** (admin total) → https://supabase.com/dashboard/account/tokens → Revoke + recréer + mettre à jour secret `MCA_SUPABASE_PAT`
2. **Pennylane** → https://app.pennylane.com/companies/23200904/settings/connectivity?subtab=developers → Supprimer + recréer + mettre à jour secret `PENNYLANE_TOKEN`
3. **Qonto** → https://app.qonto.com/organizations/mca-logistics-3134/settings/integrations → "Re-générer" → mettre à jour `QONTO_SECRET_KEY` (login ne change pas)
4. **Sentry** → https://mca-logistics.sentry.io/settings/account/api/auth-tokens/ → Revoke + recréer + mettre à jour `SENTRY_TOKEN`
5. **Gemini** → https://aistudio.google.com/app/apikey → Delete + recréer + mettre à jour `GEMINI_API_KEY`
6. **ORS** → https://openrouteservice.org/dev/#/home → Revoke + recréer + mettre à jour `ORS_API_KEY`
7. **GitHub** (révocation MCP) → https://github.com/settings/applications → "Claude Code" → Revoke
8. **Reset DB password Supabase** (si DB compromise) → https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/settings/database → Reset

---

## Bonnes pratiques

- **Pas de token dans le repo, jamais.** Tout va dans Supabase Edge Function Secrets.
- **Pas de token dans le chat Claude.** Si tu as besoin de coller un token quelque part : interface Supabase Secrets uniquement.
- **Scopes minimum** : toujours donner le minimum nécessaire (lecture seule si suffisant).
- **Token séparé par usage** quand possible (un par service, pas un token "all-purpose").
- **Audit annuel** : revoir cette liste 1×/an, révoquer les tokens dormants.

---

## TODO

- [ ] **Coder edge function `ai-proxy`** — endpoint unique côté backend qui forward vers Gemini/ORS/Pennylane/Qonto selon route. Le frontend MCA appelle juste cette edge function avec son JWT user, jamais directement les APIs externes. → PR dédiée.
- [ ] **Workflow GitHub Actions import FEC mensuel Pennylane** : exploiter `PENNYLANE_TOKEN` pour importer FEC → MCA charges/paiements automatique.
- [ ] **Configurer Teleroute** quand l'accès sera obtenu.
- [ ] **Rotation tokens illimités** (Pennylane, Qonto) tous les 6 mois.
- [ ] **Supprimer edge function `secrets-healthcheck`** depuis dashboard Supabase (créée pour test, neutralisée mais à supprimer).
