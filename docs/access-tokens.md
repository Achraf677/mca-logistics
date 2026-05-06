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
| **Pennylane** (compta) | ❌ Pas connecté (futur) | — | bloqué par abo Premium | — | — |
| **Qonto** (banque) | ❌ Pas connecté (futur) | — | bloqué par plan API | — | — |
| **Teleroute** (sous-traitance fret) | ❌ Pas connecté (futur) | — | pas encore d'accès | — | — |
| **Google Maps API** | ⚠️ Côté code uniquement | Clé API publique dans `script.js` | — | Distance Matrix | Console GCP → API & Services → Credentials → Restrict / Delete |

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

### Pennylane (compta)
- **Bloqué par abo Premium** (export FEC).
- **Si activé un jour** :
  - Pennylane → Paramètres → Intégrations → API → Generate token
  - Scopes : lecture factures, paiements (pas d'écriture sauf besoin)
  - Révocation : même page → Revoke

### Qonto (banque)
- **Bloqué par plan API** (Solo Smart / Business uniquement, pas Solo Basic).
- **Si activé un jour** :
  - Qonto → Settings → Integrations → API → Generate token
  - Scopes : lecture transactions uniquement (`payments:read`)
  - Révocation : même page → Revoke
- **⚠️ Sécurité** : ne JAMAIS donner un token avec `payments:write` (permet d'initier des virements).

### Teleroute (sous-traitance fret)
- **Pas encore d'accès Achraf**. À recreuser quand l'accès sera obtenu.
- **Si activé** : créer un user technique dédié (pas le user Achraf perso) avec scopes lecture offres uniquement.

### Google Maps API
- **Pas un accès Claude**, mais une **clé API publique embarquée dans le code** (`script.js`).
- **Risque** : la clé est visible dans le navigateur de tous les utilisateurs.
- **Mitigation actuelle** : restriction par referrer (`*.mca-logistics.pages.dev`, `*.mca-logistics.fr`) à vérifier dans Console GCP.
- **À auditer** : Console GCP → API & Services → Credentials → vérifier les restrictions de la clé.

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
- [ ] Auditer les restrictions de la clé Google Maps (referrer + scopes).
- [ ] Quand Qonto / Pennylane / Teleroute seront activés, créer leurs tokens **lecture seule** dédiés et les ajouter ici.
