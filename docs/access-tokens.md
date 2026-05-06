# Accès tiers — tokens & API actifs

> **Source de vérité** des accès donnés à Claude / agents IA / serveurs MCP.
> À tenir à jour à chaque création ou révocation. Permet de savoir
> rapidement quoi nettoyer si suspicion de fuite ou simple ménage.

Dernière mise à jour : 2026-05-06

---

## Table des accès

| Service | Statut | Type d'accès | Date | Scopes / Permissions | Comment révoquer |
|---|---|---|---|---|---|
| **Supabase** (`lkbfvgnhwgbapdtitglu`) | ✅ Actif | MCP server officiel | depuis avril 2026 | DB read/write, Storage, Auth admin | https://supabase.com/dashboard/account/tokens → révoquer le token MCP |
| **GitHub** (`Achraf677/mca-logistics`) | ✅ Actif | MCP server officiel | depuis avril 2026 | repo + PR + issues + actions | GitHub Settings → Applications → Authorized OAuth Apps → "Claude Code" → Revoke |
| **Sentry** (`mca-logistics.sentry.io`) | ⚠️ Token temporaire | Personal Token | 2026-05-06 | event:read · org:read · project:read | Sentry → Settings → Account → API → Personal Tokens → "Claude MCA LOGISTICS" → Revoke |
| **Cloudflare Pages** | ❌ Pas connecté | — | — | — | — |
| **Pennylane** (compta) | ✅ Actif | Personal Token | 2026-05-06 | 15 scopes lecture seule (factures, clients, fournisseurs, FEC, transactions, journaux, écritures…) | https://app.pennylane.com/companies/23200904/settings/connectivity?subtab=developers → "Claude MCA LOGISTICS" → Supprimer |
| **Qonto** (banque) | ✅ Actif | Internal API (login + secret key) | 2026-05-06 | Read-only org + transactions + memberships + attachments | https://app.qonto.com/organizations/mca-logistics-3134/settings/integrations → Clé API → Re-générer |
| **Teleroute** (sous-traitance fret) | ❌ Pas connecté (futur) | — | pas encore d'accès | — | — |
| **Google Maps API** | 📋 Planifié (pas encore branché) | À créer dans Google Cloud Console | — | Distance Matrix API (calcul auto km livraison) | Console GCP → API & Services → Credentials → Restrict / Delete |

---

## Détail par service

### Supabase MCP
- **Tools disponibles** : `mcp__supabase__execute_sql`, `apply_migration`, `list_tables`, `get_logs`, `get_advisors`, `list_storage_buckets`, etc.
- **Pourquoi gardé** : nécessaire pour migrations, debug DB, backups, audit RLS.
- **À révoquer si** : on change de prestataire DB, ou on suspecte une fuite.

### GitHub MCP
- **Tools disponibles** : `mcp__github__create_pull_request`, `merge_pull_request`, `list_pull_requests`, `pull_request_read`, `update_pull_request`, etc.
- **Pourquoi gardé** : workflow PR/merge automatisé, lecture CI status, gestion branches.
- **À révoquer si** : on change de fork, ou suspicion de fuite.

### Sentry — Token Personal (créé le 2026-05-06)
- **Token** : `sntryu_d5700...` (16h27 le 2026-05-06)
- **Scopes** : `event:read`, `org:read`, `project:read` (lecture seule)
- **Pourquoi créé** : MCP officiel `https://mcp.sentry.dev/mcp` nécessite un terminal CLI Claude Code. Achraf n'était pas sur son PC perso. Token classique = workaround.
- **Usage** : query l'API Sentry via `curl` pour lire les issues récentes et leurs stack traces.
- **À révoquer après** : la session de debug actuelle. Recréer plus tard via MCP officiel quand Achraf sera sur son PC perso :
  ```
  claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
  ```
- **Lien révocation directe** : https://mca-logistics.sentry.io/settings/account/api/auth-tokens/

### Cloudflare (host des pages)
- **Pas d'accès donné**. Le déploiement passe via le webhook GitHub → Cloudflare Pages auto-deploy. Aucun token Claude.
- **Si besoin futur** (purger cache CDN, créer un pages.dev domain via API, etc.) :
  - Cloudflare → My Profile → API Tokens → Create Token
  - Scopes minimum : `Pages:Edit` sur le projet `mca-logistics` uniquement
  - Révocation : même page → Roll / Delete

### Pennylane (compta) — Token actif depuis 2026-05-06
- **Token** : `7EtoPBIfeSi8MdWFCP-DhgOSC4MFub40LLJosC3ysUk`
- **Company ID** : `23200904`
- **API base URL** : `https://app.pennylane.com/api/external/v2/`
- **Auth header** : `Authorization: Bearer <token>`
- **Période de validité** : illimitée (à rotate manuellement, voir TODO)
- **Scopes accordés (15, lecture seule)** :
  - Établissements bancaires, Exercices fiscaux
  - **Export FEC** (Fichier des Écritures Comptables — déclencheur principal de l'intégration)
  - Catégories, Clients, Comptes bancaires, Comptes comptables
  - Devis, Écritures comptables, Factures client, Factures fournisseurs
  - Fournisseurs, Journaux, Produits, Transactions
- **Pas accordé (volontairement)** : balance générale, grand livre, modèles factures, abonnements, demandes achat, documents commerciaux, fichiers, mandats clients, enregistrement PA, API V1 Obsolète.
- **Test** :
  ```
  curl -H "Authorization: Bearer 7EtoPBIfeSi8MdWFCP-DhgOSC4MFub40LLJosC3ysUk" \
    "https://app.pennylane.com/api/external/v2/customers?per_page=1"
  ```
- **Usage prévu MCA** :
  - Import FEC mensuel → mise à jour auto charges/paiements/clients dans MCA
  - Synchro statuts paiement factures (Pennylane source de vérité)
  - JAMAIS d'écriture vers Pennylane (token est read-only)
- **Révocation** : https://app.pennylane.com/companies/23200904/settings/connectivity?subtab=developers → trouver le token "Claude MCA LOGISTICS" → Supprimer.
- **⚠️ Sécurité** : le token est dans ce fichier qui est commité sur GitHub. Si le repo devient public ou que tu suspectes une fuite, **rotate immédiatement** :
  1. Supprime le token actuel sur la page Pennylane (lien ci-dessus)
  2. Crée un nouveau token avec les mêmes scopes
  3. Mets à jour ce fichier avec le nouveau token
  4. Mets à jour aussi GitHub Secrets (futur, quand on aura un workflow d'import FEC)

### Qonto (banque) — Token actif depuis 2026-05-06
- **Login (organization slug)** : `mca-logistics-3134`
- **Secret key** : `1c658865d11896fee3deb0fab0ec2ac41e2127924077252db21157f7fc5601b7`
- **Format Auth Qonto** : `Authorization: <login>:<secret_key>` (pas Bearer, Internal API)
- **API base URL** : `https://thirdparty.qonto.com/v2/`
- **Test** :
  ```
  curl -H "Authorization: mca-logistics-3134:1c658865..." \
    "https://thirdparty.qonto.com/v2/organization"
  ```
  → HTTP 200, retourne org "MCA Logistics", slug `mca-logistics-3134`, 1 compte bancaire actif (testé 2026-05-06).
- **Scopes Internal API** (read-only par design — pas d'écriture possible avec ce type de clé) :
  - `GET /v2/organization` (org + comptes bancaires + soldes)
  - `GET /v2/transactions` (liste transactions)
  - `GET /v2/memberships` (membres team)
  - `GET /v2/attachments` (justificatifs liés aux transactions)
- **Usage prévu MCA** :
  - Synchro transactions → auto-cocher "payé" sur charges/livraisons quand le virement arrive
  - Détection auto fournisseurs/clients via libellé virement
  - Rapprochement bancaire mensuel (combiné avec FEC Pennylane)
- **⚠️ Sécurité** : l'Internal API Qonto est **lecture seule par design**, pas de risque d'initier des virements. OK de garder en illimité.
- **Révocation / rotation** : https://app.qonto.com/organizations/mca-logistics-3134/settings/integrations → "Clé API" → bouton "Re-générer" (génère nouvelle clé, ancienne devient invalide).

### Teleroute (sous-traitance fret)
- **Pas encore d'accès Achraf**. À recreuser quand l'accès sera obtenu.
- **Si activé** : créer un user technique dédié (pas le user Achraf perso) avec scopes lecture offres uniquement.

### Google Maps API — Planifié (pas encore branché)
- **Statut** : décision prise 2026-05-06 d'intégrer Google Maps Distance Matrix dans MCA pour le calcul auto des km entre adresses livraison (départ → arrivée). À coder plus tard.
- **Setup à faire (quand on y arrive)** :
  1. Aller sur https://console.cloud.google.com → créer projet "MCA Logistics" (ou réutiliser projet existant)
  2. Activer l'API **Distance Matrix API** (et **Geocoding API** si besoin)
  3. Créer une clé API → Credentials
  4. **Restrictions OBLIGATOIRES** (sinon n'importe qui peut utiliser la clé = facturé sur ton compte) :
     - Application restrictions → **HTTP referrers** :
       - `https://*.mca-logistics.pages.dev/*`
       - `https://*.mca-logistics.fr/*` (si domaine prod)
       - `http://localhost:*/*` (dev)
     - API restrictions → **Restrict key** → cocher **Distance Matrix API**, **Geocoding API**
  5. Quota / budget : poser un cap mensuel à 5-10 € pour éviter explosion facture si la clé fuite
  6. Coller la clé dans `script.js` (place-holder déjà présent ligne 2791 : `/* GOOGLE MAPS — DISTANCE AUTO */`)
  7. Mettre à jour ce MD avec la clé + restrictions
- **Code MCA à écrire** :
  - Fonction `calculerDistanceAuto(depart, arrivee)` qui appelle Distance Matrix API
  - Trigger : à la création/modif d'une livraison, pré-remplit le champ "distance" avec le résultat
  - Cache localStorage : éviter de re-query la même adresse 50x
- **Coût** : ~5 € / 1000 requêtes (Distance Matrix). Pour un usage MCA normal (50 livraisons/mois), gratuit (premiers $200/mois offerts par Google).
- **Révocation** : Console GCP → API & Services → Credentials → la clé → Disable / Delete.

---

## Procédure de révocation rapide (en cas de doute / fuite)

1. **Sentry** (si token temporaire encore actif) :
   - https://mca-logistics.sentry.io/settings/account/api/auth-tokens/
   - Cliquer "Revoke" sur "Claude MCA LOGISTICS"
2. **GitHub** :
   - https://github.com/settings/applications
   - "Claude Code" → Revoke
3. **Supabase** :
   - https://supabase.com/dashboard/account/tokens
   - Token MCP → Revoke
4. **Rotation database password Supabase** (si DB compromise) :
   - https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/settings/database
   - Reset database password → mettre à jour les secrets GitHub Actions
5. **Google Maps key** (si fuite) :
   - Console GCP → Credentials → la clé → Regenerate

---

## Bonnes pratiques

- **Tokens à durée limitée** : préférer les tokens avec expiration (90 j max) quand le service le permet.
- **Scopes minimum** : toujours donner le minimum nécessaire (lecture seule si suffisant).
- **Token séparé par usage** : un token "debug Sentry" ≠ un token "prod monitoring". Plus facile à révoquer ciblé.
- **Audit annuel** : revoir cette liste 1x/an, révoquer les tokens dormants.

---

## TODO

- [ ] **Révoquer le token Sentry temporaire** une fois la session de debug actuelle finie.
- [ ] Recréer un MCP Sentry propre quand Achraf est sur son PC perso (`claude mcp add --transport http sentry https://mcp.sentry.dev/mcp`).
- [ ] **Implémenter Google Maps Distance Auto** — créer projet GCP + clé API restreinte + coder `calculerDistanceAuto()` dans MCA + brancher sur formulaire livraison (PR dédiée, voir détails section "Google Maps API" ci-dessus).
- [ ] Configurer Teleroute quand l'accès sera obtenu.
- [ ] **Rotation Pennylane** : token actuel illimité, à rotate tous les 6 mois ou si suspicion fuite.
- [ ] **Workflow GitHub Actions import FEC mensuel** : exploiter le token Pennylane pour importer FEC → MCA charges/paiements automatique. À coder dans une PR dédiée.
