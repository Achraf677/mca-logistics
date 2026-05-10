# 01 — Mapping classes mockup → prod

**Convention :** quand `Stratégie = alias`, ajouter une règle CSS qui aliase l'ancienne classe vers la nouvelle (zéro changement HTML). Quand `Stratégie = remplacer`, modifier le markup prod pour utiliser la classe mockup.

## Cas global (toutes pages)

| Mockup | Prod actuel | Stratégie | Note |
|--------|-------------|-----------|------|
| `.kpi-card` | `.stat-pill` (dashboard) / `.kpi-tile` (rentabilité) | **remplacer** | Unifier sur `.kpi-card` du DS. Variantes via `data-tone="neutral|green|orange|red|blue"` |
| `.kpi-card__label` | `.kpi-label` | alias | `.kpi-label { @extend .kpi-card__label }` |
| `.kpi-card__value` | `.kpi-val` | alias | idem |
| `.kpi-card__sub` | `.kpi-sub-line` | alias | idem |
| `.section-head` | `.page-actions` (header de page) | **remplacer** | Le mockup sépare titre + actions |
| `.section-head__title` | aucun (h1 nu) | nouveau | wrap le `<h1>` |
| `.section-head__actions` | `.page-actions` (right) | remplacer | |
| `.alert-item` | `.alerte-row` / `.alerte-item` | alias | les 2 variantes existent en prod |
| `.alert-item__severity` | `.gravite-badge` | alias | |
| `.empty-state` | `.empty-state` ✅ | inchangé | DS déjà aligné |
| `.empty-state__title` | `.empty-state-title` ✅ | inchangé | |
| `.empty-state__icon` | `.empty-state-icon` ✅ | inchangé | |
| `.btn` `.btn-primary` `.btn-secondary` `.btn-ghost` `.btn-icon` | idem ✅ | inchangé | |
| `.badge` `.badge-cours` `.badge-livre` `.badge-attente` `.badge-dispo` `.badge-inactif` | idem ✅ | inchangé | DS déjà aligné |
| `.card` `.card-header` `.card-body` | `.card` `.card-header` (pas de body) | **remplacer** | Ajouter `.card-body` partout |
| `.modal__shell` | `.modal-body` (pas de shell séparé) | **remplacer** | Voir `_modal-shell.html` |
| `.toolbar` | `.filters` | alias | |
| `.toolbar__filter` | `.filters > select`, `.filters > input` | inchangé | |

## Page `admin.html` — Dashboard (`data-page="dashboard"`)

| Mockup | Prod | Stratégie |
|--------|------|-----------|
| `.dashboard-grid` | classes ad-hoc | **remplacer** par grid 12 cols DS |
| `.kpi-row` | wrapper KPI dashboard | nouveau |
| `.chart-card` | `.card` contenant `<canvas>` | **remplacer** wrapper |
| `.activity-feed` | `#tb-livraisons-recentes` (liste) | wrap |

## Page Livraisons

| Mockup | Prod | Stratégie |
|--------|------|-----------|
| `.table-shell` | `.tableau-conteneur` / brut `<table>` | **remplacer** |
| `.table-shell__head` | `<thead>` | inchangé (mais styling via shell) |
| `.row-hover` | `<tr>` | classe ajoutée pour hover |
| `.bulk-bar` | `#bulk-action-bar` | **conserver l'ID**, classe DS dessus |
| `.bulk-bar__count` | `#bulk-count-num` | conserver |
| `.bulk-bar__actions` | conteneur boutons | nouveau |
| `.row-checkbox` | `.bulk-liv-check` | alias |
| `.kanban` | `#kanban-board` | conserver ID |
| `.kanban__col` | colonnes drag-drop | nouveau |

## Page Charges / Carburant / Entretiens

| Mockup | Prod | Stratégie |
|--------|------|-----------|
| `.month-nav` | `#charges-mois-label` + boutons précédent/suivant | wrap, conserver ID |
| `.amount-cell` | `<td>` brut formaté euros | classe ajoutée |
| `.amount-cell--negative` | rouge inline | **remplacer** par classe |
| `.recurrence-badge` | `data-recurrent="1"` | classe + conserver attr |

## Page Planning

| Mockup | Prod | Stratégie |
|--------|------|-----------|
| `.plan-grid` | `#plan-jours-grid` | conserver ID |
| `.plan-cell` | cellule jour | nouveau |
| `.plan-cell--off` | jour off | nouveau |
| `.plan-cell--absence` | absence | nouveau |
| `.semaine-nav` | `#planning-semaine-label` + flèches | wrap, conserver ID |
| `.kpi-mini` | `#planning-kpi-salaries` etc | wrap, conserver IDs |

## Page Véhicules

| Mockup | Prod | Stratégie |
|--------|------|-----------|
| `.veh-card` | ligne tableau ou card prod | **remplacer** |
| `.veh-card__plate` | plaque immat | nouveau |
| `.veh-card__status` | statut dispo/maintenance | utilise `.badge-*` existants |
| `.tco-panel` | `#tco-detail` | conserver ID |

## Page Équipe / Salariés

| Mockup | Prod | Stratégie |
|--------|------|-----------|
| `.hub-grid` | `#tb-salaries` (table) | **remplacer** par grille cards |
| `.salarie-card` | `<tr>` | nouveau composant |
| `.note-pill` | `#note-interne-*` (modale) | inchangé |

## Page Alertes (`data-page="alertes"`)

| Mockup | Prod | Stratégie |
|--------|------|-----------|
| `.alert-list` | `#s19-centre-body` | conserver ID |
| `.alert-item` | row alerte | **remplacer** |
| `.alert-filters` | `#s19-filter-*` | conserver IDs |
| `.alert-kpi-strip` | `#s19-kpis` | conserver ID |
| `.drawer-360` | `#s20-drawer` | conserver ID + structure overlay/title/body |

## Page Rentabilité

| Mockup | Prod | Stratégie |
|--------|------|-----------|
| `.rent-grid` | layout ad-hoc | **remplacer** |
| `.rent-tile` | `#rent-ca`, `#rent-marge`, etc | wrap, conserver IDs |
| `.simulator` | bloc simulateur | nouveau wrapper |

## Pages mobile (`m.html`) et chauffeur (`salarie.html`)

| Mockup | Prod | Stratégie |
|--------|------|-----------|
| `.mobile-shell` | `<body>` | classe sur body |
| `.mobile-card` | `.card` mobile | alias OK |
| `.mobile-fab` | bouton flottant | nouveau |
| `.bottom-sheet` | modale mobile | nouveau |
| `.tap-row` | `<a>` ou `<div>` cliquable | nouveau |

## Règles CSS d'aliasing (à ajouter dans `colors_and_type.css`)

```css
/* Aliases mockup → prod (zéro casse) */
.stat-pill { @extend .kpi-card; }
.kpi-tile { @extend .kpi-card; }
.alerte-row, .alerte-item { @extend .alert-item; }
.filters { @extend .toolbar; }
/* Si pas de Sass : dupliquer les déclarations ou utiliser :is() */
.kpi-card, .stat-pill, .kpi-tile { /* règles communes */ }
```
