# 05 — Responsive

## Breakpoints canoniques

```css
:root {
  --bp-xs: 360px;   /* mobile portrait étroit */
  --bp-sm: 640px;   /* mobile landscape / petite tablette */
  --bp-md: 768px;   /* tablette portrait */
  --bp-lg: 1024px;  /* tablette landscape / petit desktop */
  --bp-xl: 1280px;  /* desktop standard */
  --bp-2xl: 1536px; /* desktop large */
}

/* Media queries */
@media (max-width: 639px)  { /* mobile only */ }
@media (max-width: 767px)  { /* < tablette */ }
@media (max-width: 1023px) { /* < desktop */ }
@media (min-width: 1024px) { /* desktop+ */ }
@media (min-width: 1280px) { /* desktop large */ }
```

**Règle :** mobile-first. Écrire les styles pour mobile, puis ajouter `@media (min-width: 768px)` etc.

## Sidebar admin

| Largeur | Comportement |
|---------|--------------|
| `< 1024px` | sidebar masquée, drawer slide-from-left au tap sur `#toggleSidebar` (`#menuMobile` côté mobile). Overlay sombre derrière, click overlay → fermeture. Animation `transform: translateX(-100%) → 0`, 0.28s quint-out. |
| `1024px – 1279px` | sidebar collapsée par défaut (icônes seules, 64px), expand au hover ou via `#btn-densite` |
| `≥ 1280px` | sidebar expand par défaut (240px), collapse possible via `#btn-densite` |

**Implémentation :** classe `.sidebar--open` sur `#sidebar`, `.sidebar--collapsed`. Overlay `#sidebar-mobile-overlay` toggled `.is-visible`.

## KPI grid (dashboard)

| Largeur | Colonnes |
|---------|----------|
| `< 640px` | 1 col |
| `640 – 1023px` | 2 cols |
| `1024 – 1279px` | 3 cols |
| `≥ 1280px` | 4 cols |

```css
.kpi-row {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: 1fr;
}
@media (min-width: 640px)  { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .kpi-row { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1280px) { .kpi-row { grid-template-columns: repeat(4, 1fr); } }
```

## Tableaux (`tb-*`)

**Stratégie :** table classique en desktop, cards stackées en mobile.

| Largeur | Format |
|---------|--------|
| `≥ 1024px` | `<table>` complet, toutes colonnes |
| `768 – 1023px` | `<table>` mais on masque colonnes secondaires (`th[data-priority="low"] { display: none }`) |
| `< 768px` | conversion en cards : chaque `<tr>` devient une `.card` empilée, en-tête `<th>` devient label inline |

**Pattern HTML pour table responsive :** voir `preview/components/_table-responsive.html`.

## Modales

| Largeur | Comportement |
|---------|--------------|
| `< 640px` | fullscreen, pas de border-radius, header sticky en haut, footer sticky en bas |
| `640 – 1023px` | modal centré 92vw × 90vh max, radius `--radius-lg`, marges 16px |
| `≥ 1024px` | modal centré, largeur max selon contenu (`--modal-sm: 480px`, `--modal-md: 640px`, `--modal-lg: 880px`, `--modal-xl: 1120px`) |

```css
.modal__shell {
  width: min(92vw, var(--modal-md, 640px));
  max-height: 90vh;
}
@media (max-width: 639px) {
  .modal__shell {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
}
```

## Drawers 360

| Largeur | Comportement |
|---------|--------------|
| `< 768px` | fullscreen slide-from-right (occupe 100vw) |
| `768 – 1279px` | 70vw |
| `≥ 1280px` | 480px fixe ou 40vw selon contenu |

## Page chauffeur (`salarie.html`) et mobile (`m.html`)

**Cibles :** smartphones uniquement. Désactiver tout layout >`md`.

- Bottom nav fixe (`.bottom-nav`, 56px de hauteur)
- FAB pour action principale (`.mobile-fab`, 56×56, bottom-right + 80px)
- Bottom sheets (`.bottom-sheet`) plutôt que modales centrées
- Hit targets ≥ 44×44 px (Apple HIG / Google Material)
- Safe area iOS : `padding-bottom: env(safe-area-inset-bottom)` sur bottom-nav

## Charts (`<canvas>`)

```css
.chart-card canvas { width: 100% !important; height: auto !important; }
.chart-card { aspect-ratio: 16 / 9; }
@media (max-width: 767px) { .chart-card { aspect-ratio: 4 / 3; } }
```

Forcer `Chart.js` en `responsive: true, maintainAspectRatio: false` puis sizer le wrapper.

## Hub équipe / Véhicules / Clients

| Largeur | Format |
|---------|--------|
| `≥ 1280px` | grid 3-4 cols de cards |
| `768 – 1279px` | grid 2 cols |
| `< 768px` | liste 1 col, cards compactes |

## Toolbars / filtres

| Largeur | Format |
|---------|--------|
| `≥ 1024px` | tous filtres en ligne, séparés par gap |
| `< 1024px` | bouton "Filtres (3)" → bottom sheet contenant tous les filtres + Apply / Reset |

## Test obligatoire

Tester en visuel à : **320 / 375 / 768 / 1024 / 1280 / 1920 px** (large écrans modernes inclus).
