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
- [ ] PR-2 : Sidebar + shell admin (en cours)
- [ ] PR-3 : Login refondu
- [ ] PR-4 : Dashboard admin (KPIs + charts + activity feed)
- [ ] PR-5 : Empty states + Loading + Toasts unifies

### Jalon 2 — CRUD principal
- [ ] PR-6 : Livraisons (table + filters + bulk-bar + kanban)
- [ ] PR-7 : Modale Nouvelle/Edit livraison (24 champs)
- [ ] PR-8 : Charges
- [ ] PR-9 : Carburant (+ anomalies + OCR)
- [ ] PR-10 : Entretiens

### Jalon 3 — Hubs entité
- [ ] PR-11 : Véhicules + drawer 360 + TCO panel
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
| 2 | #118 shell admin | `design-checkpoint-2-shell` | `01fe8251` | 2026-05-10 ~17:00 | style-design-shell.css : restyle sidebar + topbar admin avec --ds-*. CSS-only, IDs/data-attrs preserves. Visuel : palette Speed Red sur sidebar + topbar. |

## Règles de sécurité

1. **Mobile boot test** lancé après chaque PR (`node tests/_design-pr-mobile-boot.mjs`). Si rouge → revert immédiat de cette PR.
2. **CI rouge = pas de merge.** Si Smoke E2E ou Tests fail → PR reste draft, on s'arrête.
3. **Une PR à la fois en flight** vers main.
4. **Tokens préfixés `--ds-*`** : zéro override des tokens existants. Refactor au fur et à mesure.
5. **IDs / data-* / onclick préservés** (voir `docs/refonte/02-ids-data-attrs.md`). Sacrés.
