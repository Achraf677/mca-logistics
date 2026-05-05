# Documentation MCA Logistics

Source de vérité unique pour comprendre, maintenir et faire évoluer
l'application MCA Logistics.

> Cette doc remplace les anciens fichiers éparpillés dans `infra/`. Les
> rapports historiques (audits, plans, intégrations) restent disponibles
> dans [`archive/`](./archive/) à titre de référence.

## Sommaire

| # | Document | Quand le lire |
|---|---|---|
| 01 | [Vue d'ensemble](./01-overview.md) | Première lecture, vision produit, périmètre |
| 02 | [Architecture](./02-architecture.md) | Comprendre la stack, le flux de données local↔Supabase |
| 03 | [Application mobile](./03-mobile-app.md) | Tout sur `m.html` + `salarie.html` (pages, parité, limites) |
| 04 | [Application PC](./04-pc-app.md) | Tout sur `admin.html` (modules, lazy-loading, sidebar) |
| 05 | [Base de données](./05-database.md) | Schéma Supabase, tables, RLS, migrations |
| 06 | [Fonctionnalités par page](./06-features-by-page.md) | Détail entité par entité (Livraisons, TVA, etc.) |
| 07 | [Intégrations](./07-integrations.md) | Pennylane, Qonto, Teleroute, sous-traitance |
| 08 | [Développement](./08-development.md) | Conventions, lint, tests, conventions de code |
| 09 | [Déploiement](./09-deployment.md) | Cloudflare Pages, secrets, cache busting, releases |
| 10 | [Roadmap & backlog](./10-roadmap-backlog.md) | Dette technique, sprints à venir |

## Archive

Documents historiques figés, conservés pour référence — **ne pas
mettre à jour** :

| Document | Date | Sujet |
|---|---|---|
| [2026-05-03-bundle-splitting.md](./archive/2026-05-03-bundle-splitting.md) | 2026-05-03 | Plan de découpage de `script.js` (664 Ko) |
| [2026-05-03-periodes-harmonisation.md](./archive/2026-05-03-periodes-harmonisation.md) | 2026-05-03 | Audit + plan d'harmonisation des sélecteurs de périodes |
| [2026-05-03-cleanup-utile-inutile.md](./archive/2026-05-03-cleanup-utile-inutile.md) | 2026-05-03 | Audit UX (57 findings sur ton, emojis, redondances) |
| [2026-05-03-design-options.md](./archive/2026-05-03-design-options.md) | 2026-05-03 | Trois propositions de palette (Charcoal / Asphalt / Light) |
| [2026-05-03-backup-runbook.md](./archive/2026-05-03-backup-runbook.md) | 2026-05-03 | Runbook backup chiffré GPG → Cloudflare R2 |
| [2026-05-04-site-readiness.md](./archive/2026-05-04-site-readiness.md) | 2026-05-04 | Audit "site prêt à utiliser" (score 81 %) |
| [2026-05-04-qonto-pennylane-sous-traitance.md](./archive/2026-05-04-qonto-pennylane-sous-traitance.md) | 2026-05-04 | Étude de faisabilité intégrations comptables et fret |

## Conventions

- Ces fichiers sont la **source de vérité**. Si une décision produit ou
  technique est prise, elle doit y figurer.
- Les notes opérationnelles éphémères (todo, idées) restent dans
  `CLAUDE.md` à la racine.
- Le `README.md` racine reste léger et pointe vers cette documentation.
