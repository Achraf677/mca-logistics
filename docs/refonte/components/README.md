# Composants génériques (shells)

10 composants HTML autonomes, copy-pasteable, à utiliser comme référence pour la Phase 4 (refonte HTML page-par-page).

## Liste

| # | Fichier | Pour quoi |
|---|---------|-----------|
| 1 | `_kpi-card.html` | KPI tile (variants neutral/green/orange/red/blue) |
| 2 | `_status-badge.html` | Badge statut (5 variants livré/cours/attente/dispo/inactif) |
| 3 | `_empty-state.html` | État vide (icon + title + sub + CTA) |
| 4 | `_modal-shell.html` | Coque modale (header + body + footer, 5 tailles) |
| 5 | `_drawer-shell.html` | Coque drawer 360 (slide-right + 4 onglets) |
| 6 | `_table-responsive.html` | Table desktop + cards stackées <768px |
| 7 | `_form-group.html` | Field complet (input/textarea/select/checkbox/radio/toggle) |
| 8 | `_toast.html` | Toast 4 variants (success/warning/error/info) |
| 9 | `_skeleton.html` | Placeholders loading (line/rect/circle/row/kpi) |
| 10 | `_section-head.html` | Header page (title + sub + actions + breadcrumb optionnel) |

## Règles d'usage

1. Copier le markup dans la page cible
2. Remplacer `ID_PRESERVE` par l'ID réel de `02-ids-data-attrs.md`
3. Adapter le contenu (texte, options select, etc.)
4. Le CSS est déjà dans `style-design-v2.css` (sections 1-24) et `style-tokens.css`

## CSS attendu

Tous les selectors utilisés ici sont définis dans :
- `style-tokens.css` : tokens canoniques (couleurs, typo, spacing)
- `style-design-v2.css` : 24 sections d'overrides (KPI, sidebar, buttons, badges, tables, cards, modals, drawer, toasts, empty states, skeletons, etc.)

Pas besoin de CSS additionnel sauf cas spéciaux (ex: `.table-responsive` mobile breakpoint, `.toggle-switch` custom).
