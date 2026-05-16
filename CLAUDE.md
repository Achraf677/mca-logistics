# MCA Logistics — Notes pour Claude

> Source de vérité courte pour cadrer le travail au démarrage de chaque
> session. La doc complète est dans `docs/`. Si une décision contredit ce
> fichier, c'est ce fichier qui gagne — il doit refléter l'état réel.

Dernière mise à jour : 2026-05-09

---

## Contexte business

- PGI transport/logistique pour MCA Logistics (Achraf + 1 admin associé + chauffeurs).
- PWA vanilla JS, hostée Cloudflare Pages, backend Supabase (`lkbfvgnhwgbapdtitglu`).
- Branche de dev courante : `main` (24 PRs mergées le 2026-05-08/09, voir Changelog ci-dessous).
- **Compta** tenue en parallèle sur **Pennylane** (factures, TVA, paiements, charges récurrentes).
- **Banque** sur **Qonto** (virements, soldes, transactions, rapprochement).

---

## Règles de dev imposées par Achraf

### Parité & cohérence (priorité 1)
- **Parité PC ↔ mobile systématique** : toute fonctionnalité ajoutée/modifiée côté
  mobile doit aussi être livrée côté PC, et inversement. Pas de delta sauf
  justification explicite. *Rappel utilisateur : "Systématiquement tout ce que tu
  changes sur mobile change le sur pc aussi" — répété 60+ fois sur 6 mois.*

### Architecture & code
- **Pas de migration framework JS** : vanilla JS only, zéro dépendance npm front.
- **Un fichier = un domaine métier** : chaque table métier (livraisons, charges,
  carburant, etc.) a son propre `script-<domaine>.js`. Pas de fourre-tout. Pas de
  fichier > 1500 lignes — sinon découper avant d'ajouter.
  - **Dette tech connue** (mise à jour 2026-05-17, branche `claude/html-refonte-cleanup`) :
    - `script.js` **4 204 l** (Phase X — 72 modules extraits, partant de 14 428 l → -70.8%)
    - `script-mobile.js` 12 360 l, `script-salarie.js` 2 725 l, `script-ai-chat.js` 1 759 l
      → reste à découper en sprint H2 suivant.
- **Toutes les fonctions au scope global** (`window.X = ...`) côté front pour que
  les `onclick="X()"` HTML continuent de fonctionner.
- **Pattern dual-read transitoire** pour les schémas data divergents PC↔mobile :
  helpers `normalizeLDV` / `normalizeVehicule` dans `script-core-utils.js` ;
  forms dual-write nested+flat ; migration boot idempotente avec flags
  `_*_migrated_v1`. Voir PR #49.
- **RLS Supabase obligatoire** sur toute nouvelle table — jamais d'INSERT/SELECT
  ouvert sans politique.

### Tests & qualité
- **Tests unitaires obligatoires** sur les calculs critiques : TVA, rentabilité,
  heures, km, dates timezone. Doivent passer avant merge. État au 2026-05-09 :
  - ✅ TVA (43 tests), Pennylane FEC parsing (12), Qonto matching (16),
    SIREN/Luhn (4), data schemas normalize (21), visual-audit parser (14).
  - ❌ **Manque encore (sprint H2)** : rentabilité, heures, carburant-anomalies,
    edge fns ai-* (helpers reproduits dans tests/, drift garanti).
- **Audit log obligatoire** sur toute écriture admin. Trigger `audit_log_trigger()`
  attaché à 18 tables depuis migration 038 (initial 7 + 11 ajoutées : carburant,
  entretiens, incidents, plannings_hebdo, inspections, alertes_admin,
  salaries_documents, app_state, ai_pending_actions, ai_memory, absences_periodes).
- **Postmortem obligatoire** pour tout incident impactant connexion ou données
  utilisateur. Format markdown rangé dans `docs/archive/`.
- **Chaque ajout détaillé** : commit message clair + PR description complète, pas
  de "misc updates", pas de "stuff".

### Process git
- Branches toujours préfixées `claude/` (ex: `claude/ai-chat-write-v2`).
- PR créée en **draft** tant qu'incomplète.
- Commit messages au format `type(scope) — description courte`.
- **Cache busting** : bumper UN SEUL endroit, le `CACHE_VERSION` dans `sw.js`.
  - `monitoring.js` extrait automatiquement la version au runtime via
    `fetch('/sw.js')` + regex (depuis PR #50, fix M4). Plus besoin de bump
    manuel `SENTRY_RELEASE`.
  - Le `?v=NN` dans `admin.html` / `m.html` / `salarie.html` / `login.html`
    reste à bump à la main (tooling `version-bump.js` à écrire en sprint H3).
- **Conflits cache version** lors du merge de plusieurs PRs parallèles : utilise
  `git merge -X ours` côté branche, garde la version la plus haute, push.
- **Push proxy bloque parfois force-push** sur branches existantes : créer
  `branche-vN+1` et close l'ancienne PR si nécessaire.

### Sécurité & secrets
- **Aucun token / clé / secret en clair dans le repo. Jamais.** Tous les tokens
  runtime vivent dans **Supabase Edge Function Secrets**. Process complet dans
  `docs/secrets-management.md`. Inventaire dans `docs/access-tokens.md`.
- **Aucun token collé dans le chat Claude.** Le coller directement dans l'UI
  Supabase Secrets.
- **Rotation immédiate** de toute clé suspectée fuite. Mettre à jour le secret
  Supabase (les edge functions relisent `Deno.env.get()` à chaque invoc, pas
  besoin de re-déployer).
- **Storage privé** pour tous les documents (cartes grises, docs salariés, photos
  inspections). Signed URLs TTL 10 min, jamais d'URL publique.

### Communication
- Réponses **synthétiques par défaut** — code > prose, droit au but, pas de
  blabla redondant.
- Quand un sujet est complexe, proposer 2-3 options + tradeoff au lieu d'imposer.

---

## Direction produit

MCA = **couche opérationnelle transport**. Pas de doublon avec :

| Outil | Périmètre exclusif | À NE PAS dupliquer dans MCA |
|---|---|---|
| **Pennylane** | TVA CA3, factures clients officielles, devis, journal comptable | Émission de facture légale, plan de comptes, écritures |
| **Qonto** | Virements sortants, réconciliation bancaire complète | Initier des virements, gestion bénéficiaires |

MCA couvre ce que Pennylane et Qonto ne font pas : rattachement coûts à
véhicule/tournée/chauffeur, planning, inspections, carburant, conformité
réglementaire (ADR / CE 561), rentabilité fine par mission/véhicule.

---

## Stack technique en prod (2026-05-09)

### Edge functions Supabase (toutes ACTIVE, project `lkbfvgnhwgbapdtitglu`)

| Edge fn | Version | Rôle |
|---|---|---|
| `ai-chat` | v22 | Chatbot Gemini, 4 modules splittés (`prompts.ts`, `tools-defs.ts`, `tools-impl.ts`, `index.ts`), 50+ tools dont CRUD complet (13 propose_create + 12 propose_update + 1 propose_delete + add_to_drafts) |
| `ai-chat-write-execute` | v4 | Exécution réelle CREATE/UPDATE/DELETE après confirmation UI + dispatch drafts. `verify_jwt: true` + check role admin redondant. Whitelist colonnes anti-injection. |
| `ai-brief` | v5 | Brief auto au login + cron quotidien. 9 sources (KPIs financiers, top clients risque, activité flotte, docs salariés, anomalies carburant, livraisons impayées, échéances véhicules, alertes admin, audit express) + mémoire long-terme injectée. |
| `ai-ocr` | v3 | OCR multimodal Gemini Flash, modes facture / ticket_carburant / rib + support PDF natif (jusqu'à 1000 pages, 20 MB). |
| `ai-visual-audit` | v1 | Audit visuel quotidien Gemini Flash (free tier uniquement, 0 €/mois). Cron 3h30 UTC sur 25 routes × 2 viewports = 50 screenshots. |
| `qonto-sync-daily` | v4 | Sync quotidien Qonto → MCA (rapprochement automatique paiements/charges). Score matching 0.5 montant + 0.3 date + 0.2 nom, threshold 0.7. Idempotent via `extra->>'qonto_transaction_id'`. |
| `pennylane-fec-import` | v2 | Import FEC mensuel Pennylane. Idempotent via `extra->>'pennylane_ecriture_key'`. |
| `provision-salarie-access` | v1 | Création compte chauffeur (auth admin). |
| `delete-salarie-access` | v1 | Suppression compte chauffeur (auth admin). |
| `ai-debug` | v4 | ⚠️ Drift : déployée en prod mais source absente du repo (à republier ou supprimer). |

### Migrations DB (toutes appliquées en prod)

`033_ai_quota_daily` · `034_ai_memory` · `035_ai_brief_runs` · `035_ai_pending_actions`
· `036_pennylane_idempotency_index` · `037_qonto_idempotency_index`
· `038_audit_log_extend_coverage` (18 tables triggerées)
· `039_ai_visual_audit_runs`.

### Stack IA / maps
- **Gemini API via Google AI Studio** (`https://aistudio.google.com`) → projet GCP
  `budget-achraf` (n° `875383470177`). **Tier 1 payant activé le 2026-05-08**
  (free tier rate-limit 10 RPM/250 RPD trop restrictif pour un chatbot
  interactif). Limites Tier 1 : 1000 RPM / 4M TPM / 10 000 RPD.
  - Coût mensuel attendu : **~€0,55-€0,90/mois** pour 50 questions/jour.
  - **Cap budget Google Cloud : 5 €/mois** (alerte "MCA LOGISTICS"), email à 50 %,
    90 %, 100 %.
  - **Suivi consommation** : 4 endroits documentés dans `docs/access-tokens.md`
    section "Google AI Studio — Gemini API". Quand Achraf dit "conso", privilégier
    AI Studio (vue agrégée) ou Cloud Billing reports (vue €).
  - Procédure de désactivation d'urgence : voir `docs/access-tokens.md` section
    "Procédure de désactivation d'urgence".
  - Secret runtime : `GEMINI_API_KEY`.
  - **`ai-visual-audit` est explicitement contraint à Flash gratuit uniquement**
    (jamais de fallback Pro), pour rester à 0 € quoi qu'il arrive.
- **OpenRouteService (HeiGIT)** remplace Google Maps → 2000 req/jour gratuit,
  sans CB, profil HGV camion natif, optimisation tournée incluse. Secret :
  `ORS_API_KEY`.
- **Google Maps API : abandonné** (CB obligatoire + Distance Matrix payant).

### Intégrations comptables (actives)
- **Pennylane** : token API actif (15 scopes lecture seule, dont **FEC**) →
  l'import FEC n'est plus bloqué. Secret : `PENNYLANE_TOKEN`. Company ID
  `23200904`.
- **Qonto** : Internal API active (lecture seule par design, pas d'écriture
  possible). Secrets : `QONTO_LOGIN`, `QONTO_SECRET_KEY`. Org slug
  `mca-logistics-3134`.

### Visual agent (depuis 2026-05-09, PR #48)
- Cron 3h30 UTC + `workflow_dispatch` (mode full / smoke / base_url custom).
- 25 routes × 2 viewports (PC 1920×1080 + mobile 375×812) = 50 screenshots.
- Batch de 5 screenshots par appel → ~10 req Gemini Flash / run = 4 % du quota free 250 RPD.
- Issue rolling unique commentée chaque jour, ouverture issue dédiée si critical.
- Coût : 0 €. Quota : `ai_quota_daily.requests_flash` incrémenté.
- Secrets requis : `PLAYWRIGHT_ADMIN_EMAIL`, `PLAYWRIGHT_ADMIN_PASSWORD`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Doc complète : `docs/visual-agent.md`.

---

## Changelog 2026-05-08/09 (24 PRs mergées dans `main`)

### Chatbot IA
- **#25** V1 chatbot Gemini + mémoire long-terme (table `ai_memory`)
- **#28** Brief auto au login + intégration panneau-agent (gate session, refresh PC + mobile)
- **#34** V2 écriture chatbot CRUD complet (13 entités) + mode brouillon
- **#42** Page admin "Brouillons IA" (validation batch des actions IA empilées)
- **#30** OCR multimodal Gemini (factures / tickets / RIB) + support PDF natif
- **#50** Hotfix R1 : OCR PC restauré (PR #34 l'avait supprimé par erreur — 821 lignes)

### Comptabilité automatisée
- **#26** Qonto sync quotidien (rapprochement paiements/charges)
- **#27** Pennylane FEC import mensuel
- **#40** Fix Qonto bank_account_id (workflow était cassé sans cet ID)
- **#49** Unification schémas data divergents (LDV PC nested vs mobile flat,
  assurance véhicule, charges fournisseurId/livraisonId orphelins) — pattern dual-read

### Parité mobile (8 domaines, ~95% chacun)
- **#29** salariés (drawer 360 + filtres) · **#31** planning (3 vues + nav semaine ISO)
- **#32** véhicules (drawer 360 + carte grise + échéances)
- **#33** alertes + clients (84%→95% / 87%→95%)
- **#36** entretiens (filtres type/période + alertes échéances)
- **#37** TVA (toggle mois/trim + 4 KPIs + export CSV)
- **#38** rentabilité (KPIs + filtres période + onglet Tournée + drill-down)
- **#39** livraisons enrichie (filtres + tri + recherche étendue + quick-actions)

### UX/Bugs mobile + PC
- **#41** Chat FAB chevauchait les boutons + (z-index, repositionnement)
- **#44** Encaissement intégré dans le hub Finances PC (entre Charges et TVA)
- **#46** Alignement nav Finance mobile sur PC
- **#47** Chat ✨ déplacé dans le header mobile + ☑ sélection multiple discret
- **#50** Hotfix R2 : `.m-fab` z-index 30 → 45 (bouton + invisible derrière nav 40)

### Outils & infra
- **#24** Auditeur statique parité PC↔mobile + workflow CI quotidien
- **#35** Chore gitignore worktrees agents
- **#48** Visual agent quotidien gratuit (Gemini Flash + Playwright + GitHub issue auto)
- **#50** Hotfix M3 (sw.js CORE_ASSETS complet) + M4 (Sentry release auto-extrait CACHE_VERSION) + R6 (audit log 18 tables)

### PRs fermées sans merge (stale ou doublon)
- #17 (snippet diag fetch) · #22 (bundle split) · #23 (V1 chatbot doublon)
- #43, #45 (re-créations suite à push proxy refus de force-push)

---

## Roadmap restante (sprint H2 / H3)

### Sprint H2 — Code quality + a11y + tests (priorité haute)

**H2.1 — Refactor collisions critical names** (~4h)
- `afficherToast` (2 défs), `naviguerVers` (4 wrappers), `afficherLivraisons`
  (5 réassignations), `renderLivraisonsAdminFinal` (2 défs script.js même fichier),
  `fermerFiche360` (2 défs), `openModal`/`closeModal` (3 défs).
- Pattern `const old = window.X; window.X = (...args) => { ... old(...args); ... }`.

**H2.2 — Tests unitaires manquants (règle CLAUDE.md violée)** (~4h)
- `tests/rentabilite.test.js` (script-rentabilite + multi : ~1500 l, 0 test)
- `tests/heures.test.js` (script-heures, calcul CE 561 / contrat horaire)
- `tests/carburant-anomalies.test.js` (formule L/100km, doublons rapprochés)
- Faire échouer CI si secrets E2E absents (au lieu du skip silencieux des 9 specs Playwright).

**H2.3 — A11y batch** (~6h, score actuel 38/100)
- 46 boutons icon-only sans `aria-label` (admin.html + salarie.html)
- 255 inputs sans label associé (placeholder seul ne suffit pas WCAG)
- ESC handler manquant côté `script-mobile.js` (12k lignes, 0 occurrence d'`'Escape'`)
- `outline:none` sans focus-visible alternatif (13 occurrences style.css)
- Contraste muted `#adb5bd` sur fond clair = 2.4:1 (fail AA)
- `prefers-reduced-motion` : 0 occurrence
- `maximum-scale=1.0, user-scalable=no` dans m.html + salarie.html (zoom natif cassé, RGAA bloquant)

**H2.4 — Drawer 360 PC + Hub Équipe** (~5h)
- PR #29 a livré le drawer 360 salarié mobile mais PC = modal édition simple.
- PR #33 idem pour clients (mobile drawer 360 / PC modal historique).
- Hub Équipe Sprint 22 inexistant (planning + heures + incidents + salariés sont 4 entrées plates).

**H2.5 — Terminologie unifiée** (~2h)
- "Salarié" vs "Chauffeur" : même personne, 2 termes selon contexte
  (incident mobile affiche les 2 lignes pour la même personne).
- "Encaisser / Payer / Régler" → un seul verbe par flux.
- "Enregistrer / Sauvegarder / Confirmer / Valider" → "Enregistrer" par défaut,
  "Confirmer" pour les dialogs uniquement.
- Empty states : helper unique `emptyState(icon,title,sub)` partout (6 tables PC
  utilisent encore `<tr><td class="empty-row">`).

### Sprint H3 — Backend + perf + dette tech (priorité moyenne)

**H3.1 — Découpe fichiers > 1500 lignes** (~8h, dette CLAUDE.md)
- `script.js` 13 649 l → extraire S22 (hubs), S25, S26, S29 dans `script-core-*.js`.
- `script-mobile.js` 12 360 l → extraire `script-mobile-stats.js`,
  `script-mobile-exports.js`, `script-mobile-rentabilite.js` (cohérent
  avec lazy-loader.js).
- `script-ai-chat.js` 1 759 l → extraire `script-ai-chat-write-cards.js` +
  `script-ai-chat-ocr.js` (déjà séparable).

**H3.2 — Migrations SQL idempotentes** (~2h)
- Reformatter 5 migrations fragiles (001, 003, 004, 005, 009) avec
  `IF NOT EXISTS` / `OR REPLACE`, ajouter test CI replay.

**H3.3 — Lazy-loader version dynamic** (~30min)
- `lazy-loader.js:23` fige `DEFAULT_VERSION = '20260430-2'` → lire depuis
  `window.CACHE_VERSION_GLOBAL` injecté par sw.js.

**H3.4 — DSO calculé pour brief IA** (~2h)
- Aucune des 2 plateformes ne calcule de DSO (delay sales outstanding) réel.
- Ajouter au snapshot `ai-brief` + KPI dans page Encaissement.

**H3.5 — Workflow GitHub Actions notifications failure** (~30min)
- `pennylane-fec-monthly.yml`, `qonto-sync-daily.yml`, `visual-audit-daily.yml`
  sans `notify on failure` → échec silencieux jusqu'à inspection manuelle.
- Ajouter Slack webhook ou email via SMTP cron Supabase.

**H3.6 — 109 empty `catch(){}` sans logging** (~3h)
- Remplacer par `catch(e) { console.warn('[ctx]', e); Sentry?.captureException?.(e); }`.

**H3.7 — Nettoyage palette legacy** (~1h)
- 66 occurrences `rgba(245,166,35,…)` orange residuel après migration palette rouge.
- Remplacer par `var(--accent-soft)`.

---

## Idées en attente (backlog non priorisé)

### Teleroute / B2PWeb (sous-traitance fret)
- Pas d'accès API self-service côté B2PWeb (contact commercial requis).
- Teleroute : API REST documentée mais pas encore d'accès Achraf.
- À traiter "à fond" dès qu'un accès est obtenu (~1 semaine d'intégration).

### Vue Kanban livraisons mobile
- PC a 3 vues (tableau / kanban / calendrier), mobile = 2 (liste / kanban).
- Calendrier mobile = vue jour seule (PC = jour/semaine/mois/année).

### Drawer 360 fournisseur + véhicule cohérence PC
- Drawer 360 mobile existe pour véhicules (PR #32) mais PC = modal édition.
- Fournisseur : pas de drawer 360 ni PC ni mobile.

---

## Pointeurs

- Architecture détaillée : `docs/02-architecture.md`
- Mobile (m.html + salarie.html) : `docs/03-mobile-app.md`
- PC (admin.html) : `docs/04-pc-app.md`
- Schéma DB Supabase : `docs/05-database.md`
- Roadmap & sprints : `docs/10-roadmap-backlog.md`
- Inventaire tokens / accès tiers : `docs/access-tokens.md`
- Process secrets : `docs/secrets-management.md`
- Visual agent : `docs/visual-agent.md`
