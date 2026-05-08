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

### Google AI Studio — Gemini API (Tier 1 payant depuis 2026-05-08)
- **Origine** : créée via https://aistudio.google.com
- **Secret runtime** : `GEMINI_API_KEY`
- **Projet GCP** : `Budget Achraf` (ID `budget-achraf`, numéro `875383470177`)
- **Tier actif** : **Tier 1 payant** (free tier rate-limit 10 RPM/250 RPD était trop restrictif).
- **Limites Tier 1** : 1000 RPM / 4M TPM / 10 000 RPD — pratiquement illimité pour MCA.
- **Coût mensuel attendu** : ~€0,55-€0,90/mois pour 50 questions/jour (Flash $0,30/1M out, $0,075/1M in).
- **API base URL** : `https://generativelanguage.googleapis.com/v1beta/`
- **Auth** : query param `?key=<GEMINI_API_KEY>` ou header `x-goog-api-key`
- **Budget cap** : alerte budget Google Cloud nommée "MCA LOGISTICS", **5 €/mois**, alertes email à 50 % / 90 % / 100 %. URL : https://console.cloud.google.com/billing/budgets
- **Suivi consommation (4 endroits)** :
  1. **AI Studio** (le plus simple, vue agrégée par modèle) : https://aistudio.google.com/app/apikey → ligne de la clé → icône bar-chart 📊
  2. **Console GCP — facturation €** (rapports quotidiens, projection mensuelle) : https://console.cloud.google.com/billing/reports?project=budget-achraf
  3. **Quotas API en temps réel** (RPM/RPD/TPM utilisés vs limites Tier 1) : https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas?project=budget-achraf
  4. **Tracker interne MCA** (compteur Pro/Flash quotidien) : table Supabase `public.ai_quota_daily`, query `SELECT date, requests_pro, requests_flash FROM ai_quota_daily ORDER BY date DESC`
- **Usage prévu MCA** :
  - OCR factures complexes (ce que Tesseract rate)
  - Auto-fill smart depuis photo (ticket carburant, RIB, justificatif)
  - Détection anomalies sur charges
  - Génération texte (descriptions livraison, lettres relance)
  - Chatbot interne MCA (query Supabase + réponse)

#### 🚨 Procédure de désactivation d'urgence (en cas de surfacturation suspecte)

Si tu reçois une alerte budget anormale ou une facture surprise :

**Option A — Désactiver l'API Gemini uniquement (recommandé en premier)**
1. https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/overview?project=budget-achraf
2. Bouton **"Désactiver l'API"** en haut → confirme
3. Effet immédiat : toutes les requêtes Gemini renvoient un 403. Le chatbot MCA tombe en erreur côté frontend (message clair grâce au hint v10) mais le reste du site continue de fonctionner.
4. Pas de coût supplémentaire à partir de cette seconde.

**Option B — Désactiver la facturation du projet (plus radical)**
1. https://console.cloud.google.com/billing/linkedaccount?project=budget-achraf
2. Bouton **"Désactiver le compte de facturation"**
3. Effet : tout le projet `budget-achraf` ne facture plus rien, mais les services se figent (downgrade en free tier ou suspension).
4. Réactivable à tout moment en re-liant le compte de facturation.

**Option C — Révoquer la clé API Gemini (si suspicion de fuite)**
1. https://aistudio.google.com/app/apikey
2. Trouve la clé du projet `budget-achraf`, clique 🗑 → confirme.
3. Crée immédiatement une nouvelle clé dans le même projet (sinon le chatbot reste KO).
4. Mets à jour le secret Supabase `GEMINI_API_KEY` (https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/functions/secrets).
5. Effet : les anciennes requêtes échouent en 401, les nouvelles fonctionnent.

**Diagnostic avant désactivation** :
- Liste des consommations détaillées : https://console.cloud.google.com/billing/reports?project=budget-achraf
- Logs des appels Gemini (RPM, RPD, tokens) : https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas?project=budget-achraf
- Si l'usage est légitime mais cher : passer le `MAX_TOOL_ITERATIONS` de 4 à 2 dans `infra/supabase/functions/ai-chat/index.ts` et redéployer.

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
