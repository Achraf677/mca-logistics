# Design Refonte — Checkpoints

Liste des PRs design mergées et leur point de revert. Pour rollback :

```bash
# Revert d'une PR specifique (laisse les suivantes)
git revert <merge-sha>

# Reset complet à un checkpoint anterieur (DESTRUCTIF, perd les commits suivants)
git reset --hard design-checkpoint-N
```

Tags créés AUTOMATIQUEMENT après chaque merge réussi par l'agent.

## Plan d'attaque (référence : `docs/refonte/07-plan-migration.md` du design pack)

### Jalon 1 — Fondations
- [x] PR-1 : Tokens design system (style-tokens.css) → PR #117 mergee 2026-05-10 16:48 UTC, tag `design-checkpoint-1-tokens`
- [x] PR-2 : Sidebar + shell admin → PR #118 mergee 2026-05-10 ~17:00 UTC, tag `design-checkpoint-2-shell`
- [x] PR-3 : Login refondu → PR #119 mergee 2026-05-10 ~17:15 UTC, tag `design-checkpoint-3-login`
- [x] PR-4 : Dashboard admin → PR #120 mergee 2026-05-10 ~17:30 UTC, tag `design-checkpoint-4-dashboard`
- [x] PR-5 : Empty states + Loading + Toasts unifies → PR #121 mergee 2026-05-10 ~17:45 UTC, tag `design-checkpoint-5-feedback` (**Jalon 1 fini**)

### Jalon 2 — CRUD principal
- [x] PR-6 : Livraisons (table + filters + bulk-bar + kanban) → PR #122 mergee 2026-05-10 ~18:00 UTC, tag `design-checkpoint-6-livraisons`
- [x] PR-7 : Modale + form-groups + drawers → PR #123 mergee 2026-05-10 ~18:15 UTC, tag `design-checkpoint-7-modale`
- [x] PR-8 : Charges → PR #124 mergee 2026-05-10 ~18:30 UTC, tag `design-checkpoint-8-charges`
- [x] PR-9 : Carburant → PR #125 mergee 2026-05-10 ~18:45 UTC, tag `design-checkpoint-9-carburant`
- [x] PR-10 : Entretiens → PR #126 mergee 2026-05-10 ~19:00 UTC, tag `design-checkpoint-10-entretiens` (**Jalon 2 fini**)

### Jalon 3 — Hubs entité
- [ ] PR-11 : Véhicules + drawer 360 + TCO panel (en cours)
- [ ] PR-12 : Équipe / Salariés + drawer 360
- [ ] PR-13 : Clients + drawer 360
- [ ] PR-14 : Fournisseurs + drawer 360

### Jalon 4 — Vues secondaires
- [ ] PR-15 : Planning
- [ ] PR-16 : Alertes
- [ ] PR-17 : Rentabilité
- [ ] PR-18 : Stats / Prévisions
- [ ] PR-19 : Calendrier
- [ ] PR-20 : Paramètres

### Jalon 5 — Mobile + extras
- [ ] PR-21 : Setup wizard
- [ ] PR-22 : Mobile (m.html)
- [ ] PR-23 : Chauffeur (salarie.html)
- [ ] PR-24 : Bug report / Help

## Checkpoints (mis à jour après chaque merge)

| # | PR | Tag | Merge SHA | Date (UTC) | Notes |
|---|-----|------|-----------|------------|-------|
| 1 | #117 tokens | `design-checkpoint-1-tokens` | `5f508843` | 2026-05-10 16:48 | style-tokens.css ajoute (--ds-* additif, zero override) + wire admin.html + m.html. Aucun changement visuel attendu. |
| 2 | #118 shell admin | `design-checkpoint-2-shell` | `01fe8251` | 2026-05-10 ~17:00 | style-design-shell.css : restyle sidebar + topbar admin avec --ds-*. Visuel : palette Speed Red sur sidebar + topbar. |
| 3 | #119 login | `design-checkpoint-3-login` | `7d910774` | 2026-05-10 ~17:15 | login.html : nettoyage residus orange (rgba(242,163,59), #f2a33b, #f6b456) -> Speed Red. Bleu salarie conserve. |
| 4 | #120 dashboard | `design-checkpoint-4-dashboard` | `3c0c28c6` | 2026-05-10 ~17:30 | style-design-dashboard.css : KPIs (Syne italic 800), hero-sante, cards, tables (activity feed), btn-primary/secondary/danger. Variants couleur kpi-card preserves. |
| 5 | #121 feedback | `design-checkpoint-5-feedback` | `4eaf8060` | 2026-05-10 ~17:45 | style-design-feedback.css : toasts 4 variantes (success/warning/error/info via classe ou data-toast-type), empty states avec font display, skeletons (.ds-skeleton-rect/circle/text/kpi/row + shimmer), spinner (.ds-spinner). **Jalon 1 termine.** |
| 6 | #122 livraisons | `design-checkpoint-6-livraisons` | `7d25a810` | 2026-05-10 ~18:00 | style-design-livraisons.css : filtres focus brand, tables hover/checked, bulk-bar avec count Syne italic, kanban col headers + cards hover brand, chips active brand-soft, pagination active brand. |
| 7 | #123 modale | `design-checkpoint-7-modale` | `02b6b071` | 2026-05-10 ~18:15 | style-design-modal.css : modal-overlay z-index ds, modal radius xl + shadow-xl + accent-bar bottom brand, modal-title font display, form-group inputs focus ring brand-soft 3px, drawers 360 (side-drawer + s20 + s25). |
| 8 | #124 charges | `design-checkpoint-8-charges` | `6cc166da` | 2026-05-10 ~18:30 | style-design-charges.css : nav-periode-bar + labels mois Syne, recurrence chip ds-info, montants negatif/positif ds-danger/success mono. Reutilise par carburant/entretiens/stats/tva/rentabilite. |
| 9 | #125 carburant | `design-checkpoint-9-carburant` | `09425b2d` | 2026-05-10 ~18:45 | style-design-carburant.css : doublons-warning ds-brand soft, anomalie row ds-warning-soft, conso-l100 mono tnum. |
| 10 | #126 entretiens | `design-checkpoint-10-entretiens` | `6d21e2ab` | 2026-05-10 ~19:00 | style-design-entretiens.css : type-badge variants, source-badge ds-brand, echeance-badge critique/warning/ok. **Jalon 2 fini.** |

## Règles de sécurité

1. **Mobile boot test** lancé après chaque PR (`node tests/_design-pr-mobile-boot.mjs`). Si rouge → revert immédiat de cette PR.
2. **CI rouge = pas de merge.** Si Smoke E2E ou Tests fail → PR reste draft, on s'arrête.
3. **Une PR à la fois en flight** vers main.
4. **Tokens préfixés `--ds-*`** : zéro override des tokens existants. Refactor au fur et à mesure.
5. **IDs / data-* / onclick préservés** (voir `docs/refonte/02-ids-data-attrs.md`). Sacrés.
