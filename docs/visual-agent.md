# Agent visuel automatisé — `visual-audit-daily`

> Audit visuel quotidien automatisé de l'app MCA Logistics. Capture les
> screenshots de toutes les pages (PC + mobile), les analyse via Gemini 2.5
> Flash, et publie un rapport Markdown comme issue GitHub.
>
> **Coût : 0 €.** Free tier Gemini 2.5 Flash uniquement (250 RPD). Jamais de
> fallback Pro payant — c'est verrouillé en dur dans l'edge function.

Dernière mise à jour : 2026-05-09

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ GitHub Actions cron (3h30 UTC)                                       │
│    │                                                                 │
│    ├──> Playwright Chromium                                          │
│    │    ├── login admin via /auth/v1/token Supabase                  │
│    │    ├── PC viewport 1920×1080  : 25 routes screenshotées        │
│    │    ├── Mobile viewport 375×812 : 22 routes screenshotées       │
│    │    └── batch de 5 screenshots → POST edge fn ai-visual-audit    │
│    │                                                                 │
│    ├──> Edge function `ai-visual-audit` (verify_jwt: true)          │
│    │    ├── valide admin (profiles.role)                            │
│    │    ├── appel Gemini 2.5 Flash multimodal (HARDCODED)           │
│    │    │   - retry exp 2/4/8s sur 429/503                          │
│    │    │   - JAMAIS de fallback Pro                                │
│    │    ├── parse JSON → issues structurées                         │
│    │    ├── log dans `ai_visual_audit_runs` (Supabase)              │
│    │    └── compteur quota dans `ai_quota_daily`                    │
│    │                                                                 │
│    └──> tools/visual-audit-aggregator.js                            │
│         ├── tests/visual-audit-output/issues.json                   │
│         ├── construit report.md (sections critical/major/minor)     │
│         └── gh CLI :                                                │
│             - si > 0 critical : nouvelle issue GitHub               │
│             - sinon : commentaire sur issue rolling unique          │
└──────────────────────────────────────────────────────────────────────┘
```

## Composants livrés

| Fichier | Rôle |
|---|---|
| `infra/supabase/functions/ai-visual-audit/index.ts` | Edge fn Gemini Flash (verify_jwt: true) |
| `infra/supabase/functions/ai-visual-audit/parser.ts` | Parser réponses Gemini → issues normalisées |
| `infra/supabase/039_ai_visual_audit_runs.sql` | Migration historique des runs (RLS admin only) |
| `tests/visual-audit.spec.js` | Spec Playwright capture + envoi batches |
| `tools/visual-audit-aggregator.js` | Markdown + post issue GitHub |
| `tests/visual-audit-parser.test.js` | Tests unitaires parser & aggregator |
| `.github/workflows/visual-audit-daily.yml` | Workflow cron 3h30 UTC |

## Secrets nécessaires

À ajouter dans **GitHub Settings → Secrets → Actions** (repo
`Achraf677/mca-logistics`) :

| Nom | Source | Description |
|---|---|---|
| `PLAYWRIGHT_ADMIN_EMAIL` | identifiant admin MCA | login pour /login.html |
| `PLAYWRIGHT_ADMIN_PASSWORD` | password admin MCA | idem |
| `SUPABASE_URL` | `https://lkbfvgnhwgbapdtitglu.supabase.co` | base URL projet Supabase |
| `SUPABASE_ANON_KEY` | dashboard Supabase → API → anon | publishable key (pour /auth/v1/token + appel edge fn) |

Le secret runtime côté edge function (`GEMINI_API_KEY`) est déjà configuré
dans Supabase (cf. `docs/access-tokens.md` section "Google AI Studio —
Gemini API"). Aucune action requise pour ce secret.

`GITHUB_TOKEN` est auto-fourni par GitHub Actions (scope `issues: write`
déclaré dans le workflow).

## Trigger manuel

Depuis l'UI GitHub :

1. Repo → **Actions** → workflow **Visual Audit Daily**
2. Bouton **Run workflow** → choisir branche → optionnellement `mode = smoke`
   ou changer `base_url`.
3. Le workflow tourne ~10 min, dépose 2 artifacts (screenshots PNG +
   `report.md`) et publie l'issue.

En CLI local (debug) :

```bash
PLAYWRIGHT_ADMIN_EMAIL=... PLAYWRIGHT_ADMIN_PASSWORD=... \
SUPABASE_URL=https://lkbfvgnhwgbapdtitglu.supabase.co \
SUPABASE_ANON_KEY=eyJ... \
BASE_URL=https://mca-logistics.pages.dev \
npx playwright test tests/visual-audit.spec.js

# Puis aggregator en dry-run
AUDIT_DRY_RUN=1 node tools/visual-audit-aggregator.js
cat tests/visual-audit-output/report.md
```

## Lecture du rapport

Le rapport Markdown contient :

- **Critical** — défauts bloquants (overlap, bouton coupé, texte illisible).
  Si > 0 → **nouvelle issue GitHub** avec labels `audit, bug, visual-audit`.
- **Major** — alignement cassé, contraste faible, état vide non géré, typo.
- **Minor** — polish, opportunités UX.
- **Stats** — nombre de routes / screenshots / issues.
- **Screenshots** — liens vers l'artifact GitHub Actions (rétention 7 j).

S'il n'y a aucun critical, le rapport est posté en commentaire d'une issue
rolling unique (label `visual-audit-rolling`) — ça évite la pollution de la
liste d'issues mais garde un historique consultable.

## Coût

- Gemini 2.5 Flash, free tier : **0 €**.
- Quota free tier : 10 RPM / 250 RPD.
- 25 routes × 2 viewports = 50 screenshots / run.
- Batch de 5 → 10 appels Gemini / run.
- 1 run / jour → **10 / 250 = 4 % du quota** quotidien.
- Le compteur free vs Pro est tracké dans `ai_quota_daily.requests_flash`.

Si jamais le free tier sature (rare : Gemini Flash est généreux), l'edge fn
retourne 429 friendly et le run est skipped — JAMAIS de fallback payant.

## Désactivation d'urgence

Si l'audit dérape (faux positifs en boucle, spam d'issues) :

1. Repo → Actions → **Visual Audit Daily** → **⋯ → Disable workflow**.
2. Ferme l'issue rolling si elle gêne.
3. (Optionnel) Désactiver la fn Supabase :
   `mcp__supabase__deploy_edge_function` avec un body qui retourne 503,
   ou supprimer via le dashboard Supabase Functions.

## Évolutions possibles (hors scope V1)

- Diff visuel entre runs (pixelmatch) pour détecter les régressions
  uniquement, pas le statu quo.
- Trigger sur PR (mode `pr`) pour catcher les régressions avant merge.
- Dashboard `audit visuel` côté admin lisant `ai_visual_audit_runs`.
- Élargir à 3 viewports (PC, tablette, mobile) si besoin futur.
