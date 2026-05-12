# Audit visuel statique — `style.css` + `style-mobile.css`

Généré le 2026-05-09 par `tools/visual-hunter-css-static.js`.

Total règles parsées : **2132** (style.css + style-mobile.css = 9579 lignes).

## Résumé

| Catégorie | Trouvés | Action prise |
|---|---|---|
| 1. Conflits z-index cross-files (familles différentes) | 8 | Documenté (intentionnel pour la plupart) |
| 2. Contrast ratio < seuil AA (statique) | 12 | Documenté (revue manuelle requise — couleurs marque) |
| 3. `overflow:hidden` sans ellipsis ni scroll fallback | 32 | Documenté (la plupart sont des conteneurs voulus) |
| 4. `outline:none` non couverts par le `:focus-visible` global | 0 (sur 13 occurrences) | OK : tous couverts par le bloc global `!important` H2.3 |
| 5. `!important` chains contradictoires | 7 | Documenté (la plupart sont des responsive/light overrides voulus) |
| 6. Vendor prefix manquants (post-fix) | 7 | 15 corrigés cette PR (`-webkit-backdrop-filter` + `-webkit-/-moz-user-select`) ; 7 `-moz-appearance` restants doc only (Firefox <80 only) |
| 7. Fixed positioning conflicts (mêmes ancrages) | 1 | Documenté (mobile-bottom-nav fallback PC + bottom-nav mobile + sheet : intentionnel, z-index séparés) |
| 8. Animations/transitions !important pouvant by-pass reduced-motion | 5 | OK : 4/5 sont DANS le bloc reduced-motion lui-même (faux positifs du parseur) ; `.m-fab-secondary` est sûr car le bloc reduced-motion gagne par ordre de cascade |

## 1. Conflits z-index cross-files

### Distribution complète

| z-index | Selectors |
|---|---|
| **1** | `.s15-modal-info-close` _(style.css:6616)_ · `.s25-tabs` _(style.css:7909)_ · `.data-table thead th:first-child` _(style.css:8478)_ |
| **2** | `.planning-week-grid thead th:first-child` _(style.css:3427)_ · `.s25-drawer-head` _(style.css:7894)_ · `.s30-ac-scroll table thead th` _(style.css:8328)_ |
| **3** | `.planning-week-grid thead th:first-child` _(style.css:3435)_ |
| **10** | `select` _(style.css:5270)_ |
| **20** | `.planning-search-suggestions` _(style.css:3323)_ |
| **40** | `.m-bottom-nav` _(style-mobile.css:173)_ |
| **45** | `.m-fab` _(style-mobile.css:477)_ |
| **50** | `.topbar` _(style.css:271)_ · `.data-table select` _(style.css:5275)_ · `.m-header` _(style-mobile.css:106)_ |
| **80** | `.m-drawer-overlay` _(style-mobile.css:234)_ |
| **90** | `.mobile-bottom-nav` _(style.css:8569)_ · `.m-drawer` _(style-mobile.css:249)_ |
| **99** | `.sidebar-overlay` _(style.css:1484)_ |
| **100** | `.sidebar` _(style.css:125)_ · `.m-sheet-overlay` _(style-mobile.css:528)_ |
| **110** | `.m-sheet` _(style-mobile.css:543)_ |
| **120** | `.topbar-dropdown` _(style.css:1715)_ · `.inline-dropdown-menu` _(style.css:4381)_ |
| **150** | `#btn-scroll-top` _(style.css:1670)_ |
| **160** | `.livraisons-table .inline-dropdown-menu` _(style.css:3965)_ · `.vehicules-table .inline-dropdown-menu` _(style.css:4417)_ |
| **200** | `.modal-overlay` _(style.css:827)_ · `.m-toast` _(style-mobile.css:452)_ |
| **300** | `.toast` _(style.css:1403)_ |
| **500** | `#modal-confirm` _(style.css:1650)_ |
| **999** | `[data-tooltip]::after` _(style.css:2411)_ · `.s20-drawer-overlay` _(style.css:7537)_ |
| **1000** | `.s20-drawer` _(style.css:7546)_ |
| **1090** | `.bulk-action-bar` _(style.css:1783)_ |
| **1100** | `.side-drawer-overlay` _(style.css:1908)_ |
| **1101** | `.side-drawer` _(style.css:1925)_ |
| **9990** | `.s25-drawer-overlay` _(style.css:7888)_ |
| **9998** | `.s15-modal-info-overlay` _(style.css:6588)_ |
| **9999** | `.sal-dropdown` _(style.css:4993)_ · `.toast-stack` _(style.css:5592)_ · `.s15-palette-overlay` _(style.css:6661)_ |

### Suspects (au moins 2 familles différentes au même z-index)

- **z-index 1** — familles : modal, other
  - `.s15-modal-info-close` _(style.css:6616)_
  - `.s25-tabs` _(style.css:7909)_
  - `.data-table thead th:first-child` _(style.css:8478)_
- **z-index 2** — familles : other, modal
  - `.planning-week-grid thead th:first-child` _(style.css:3427)_
  - `.s25-drawer-head` _(style.css:7894)_
  - `.s30-ac-scroll table thead th` _(style.css:8328)_
- **z-index 50** — familles : nav, other
  - `.topbar` _(style.css:271)_
  - `.data-table select` _(style.css:5275)_
  - `.m-header` _(style-mobile.css:106)_
- **z-index 90** — familles : nav, modal
  - `.mobile-bottom-nav` _(style.css:8569)_
  - `.m-drawer` _(style-mobile.css:249)_
- **z-index 100** — familles : nav, modal
  - `.sidebar` _(style.css:125)_
  - `.m-sheet-overlay` _(style-mobile.css:528)_
- **z-index 200** — familles : modal, toast
  - `.modal-overlay` _(style.css:827)_
  - `.m-toast` _(style-mobile.css:452)_
- **z-index 999** — familles : popover, modal
  - `[data-tooltip]::after` _(style.css:2411)_
  - `.s20-drawer-overlay` _(style.css:7537)_
- **z-index 9999** — familles : popover, toast, overlay
  - `.sal-dropdown` _(style.css:4993)_
  - `.toast-stack` _(style.css:5592)_
  - `.s15-palette-overlay` _(style.css:6661)_

## 2. Contrast ratios (statique, vars resolues)

Limite de l'analyse : on ne calcule le ratio que quand background est explicitement déclaré
dans la même règle, ou héritable depuis un ancêtre direct. Les couleurs en `var()` sont résolues
contre `:root`. Les modes light/dark (themes) ne sont pas réconciliés ici.

- `body.light-mode .searchbar input::placeholder` _(style.css:633)_ — ratio **3.66:1** (seuil 4.5) · rgb(123,134,156) sur rgb(255,255,255)
- `.badge-alertes-nav` _(style.css:1508)_ — ratio **3.82:1** (seuil 4.5) · rgb(255,255,255) sur rgb(231,76,60)
- `.nav-badge` _(style.css:2283)_ — ratio **3.82:1** (seuil 4.5) · rgb(255,255,255) sur rgb(231,76,60)
- `body.light-mode .s15-palette-kbd` _(style.css:6791)_ — ratio **4.39:1** (seuil 4.5) · rgb(107,114,128) sur rgb(243,244,246)
- `.cal16-mois-header` _(style.css:6879)_ — ratio **4.47:1** (seuil 4.5) · rgb(255,255,255) sur rgb(99,102,241)
- `.cal16-day-today .cal16-day-num` _(style.css:6946)_ — ratio **4.47:1** (seuil 4.5) · rgb(255,255,255) sur rgb(99,102,241)
- `.cal16-mini-day.t` _(style.css:7206)_ — ratio **4.47:1** (seuil 4.5) · rgb(255,255,255) sur rgb(99,102,241)
- `.mbn-badge` _(style.css:8637)_ — ratio **2.84:1** (seuil 4.5) · rgb(255,255,255) sur rgb(255,107,53)
- `.m-tab-badge` _(style-mobile.css:217)_ — ratio **2.84:1** (seuil 4.5) · rgb(255,255,255) sur rgb(255,107,53)
- `.m-drawer-badge` _(style-mobile.css:311)_ — ratio **4.17:1** (seuil 4.5) · rgb(255,255,255) sur rgb(230,57,70)
- `.m-btn-primary` _(style-mobile.css:442)_ — ratio **4.44:1** (seuil 4.5) · rgb(26,18,8) sur rgb(230,57,70)
- `.m-alertes-chip.active` _(style-mobile.css:672)_ — ratio **4.44:1** (seuil 4.5) · rgb(26,18,8) sur rgb(230,57,70)

## 3. `overflow:hidden` sans ellipsis ni scroll

Risque : texte tronqué invisible. Critère heuristique : la règle contient une dimension
(width / height / max-*) ou cible un élément textuel.

- `body.app-shell` _(style.css:111)_ — `overflow:hidden` sans ellipsis ni scroll
- `.sidebar` _(style.css:125)_ — `overflow:hidden` sans ellipsis ni scroll
- `.logo-icon` _(style.css:152)_ — `overflow:hidden` sans ellipsis ni scroll
- `.kpi-card` _(style.css:409)_ — `overflow:hidden` sans ellipsis ni scroll
- `.card` _(style.css:491)_ — `overflow:hidden` sans ellipsis ni scroll
- `.searchbar` _(style.css:548)_ — `overflow:hidden` sans ellipsis ni scroll
- `.compte-resultat` _(style.css:695)_ — `overflow:hidden` sans ellipsis ni scroll
- `.seuil-barre-bg` _(style.css:804)_ — `overflow:hidden` sans ellipsis ni scroll
- `.modal` _(style.css:831)_ — `overflow:hidden` sans ellipsis ni scroll
- `.fp-section` _(style.css:918)_ — `overflow:hidden` sans ellipsis ni scroll
- `.search-results-global` _(style.css:1129)_ — `overflow:hidden` sans ellipsis ni scroll
- `.rentabilite-form-card` _(style.css:1207)_ — `overflow:hidden` sans ellipsis ni scroll
- `.side-drawer` _(style.css:1925)_ — `overflow:hidden` sans ellipsis ni scroll
- `.nav-section-content` _(style.css:2265)_ — `overflow:hidden` sans ellipsis ni scroll
- `.sidebar.collapsed .nav-section-header` _(style.css:2273)_ — `overflow:hidden` sans ellipsis ni scroll
- `.kanban-col` _(style.css:2739)_ — `overflow:hidden` sans ellipsis ni scroll
- `.ponctualite-bar` _(style.css:3091)_ — `overflow:hidden` sans ellipsis ni scroll
- `.ponctualite-bar` _(style.css:3167)_ — `overflow:hidden` sans ellipsis ni scroll
- `.planning-search-suggestions` _(style.css:3323)_ — `overflow:hidden` sans ellipsis ni scroll
- `.progress-track` _(style.css:4882)_ — `overflow:hidden` sans ellipsis ni scroll
- `.chart-container` _(style.css:4897)_ — `overflow:hidden` sans ellipsis ni scroll
- `.sal-dropdown` _(style.css:4993)_ — `overflow:hidden` sans ellipsis ni scroll
- `.admin-inspection-preview` _(style.css:5155)_ — `overflow:hidden` sans ellipsis ni scroll
- `.toast-stack .toast-stacked` _(style.css:5605)_ — `overflow:hidden` sans ellipsis ni scroll
- `.s15-modal-info-box` _(style.css:6603)_ — `overflow:hidden` sans ellipsis ni scroll
- `.s15-palette-box` _(style.css:6676)_ — `overflow:hidden` sans ellipsis ni scroll
- `.cal16-mois-header` _(style.css:6879)_ — `overflow:hidden` sans ellipsis ni scroll
- `.cal16-mois-body` _(style.css:6898)_ — `overflow:hidden` sans ellipsis ni scroll
- `.s20-drawer` _(style.css:7546)_ — `overflow:hidden` sans ellipsis ni scroll
- `.s21-conso-bar` _(style.css:7775)_ — `overflow:hidden` sans ellipsis ni scroll
- `.s26-sig-canvas-wrap` _(style.css:8035)_ — `overflow:hidden` sans ellipsis ni scroll
- `.topbar` _(style.css:8371)_ — `overflow:hidden` sans ellipsis ni scroll

> Note : la grande majorité de ces règles sont des conteneurs de carte / drawer / modal
> qui clippent volontairement leur contenu pour les arrondis ou pour laisser un enfant
> scroller. Ce ne sont pas des bugs ; le critère statique est un drapeau pour revue.

## 4. `outline:none` sans `:focus-visible` alternatif

Le bloc global `style.css:8757-8777` (sprint H2.3, PR #53) déclare
`outline: 2px solid var(--accent) !important` sur `button, a, [role="button"], [tabindex],
input, select, textarea, .searchbar input, .form-group *, .modal-close, .cal-nav-btn,
.btn-density, .btn-theme-toggle, .btn-hamburger, .btn-menu-mobile`.

Grâce au `!important`, ce fallback gagne sur n'importe quel `outline: none` non-!important,
quelle que soit la spécificité du sélecteur initial. Conséquence : tous les `outline: none`
inventoriés dans le repo sont restaurés en navigation clavier, automatiquement.

### Couverts par le fallback global

- OK : `.searchbar input` _(style.css:569)_
- OK : `.form-group input:focus` _(style.css:1112)_
- OK : `.card input:focus` _(style.css:1186)_
- OK : `.rentabilite-charge-row input:focus` _(style.css:1275)_
- OK : `.broadcast-bar textarea` _(style.css:2571)_
- OK : `.commentaire-input-row input` _(style.css:3029)_
- OK : `.livraison-inline-select:focus` _(style.css:4030)_
- OK : `select:not(.planning-type-select):not(.livraison-inline-select):focus` _(style.css:4745)_
- OK : `.period-selector:focus` _(style.css:4789)_
- OK : `.pagination-select:focus` _(style.css:5391)_
- OK : `.s15-palette-header input` _(style.css:6694)_
- OK : `.s26-inline-edit` _(style.css:8027)_
- OK : `.s29-search` _(style.css:8109)_

### NON couverts (à patcher)

_Aucune lacune — fallback global suffit._

## 5. `!important` chains contradictoires

La majorité de ces conflits sont voulus (responsive override, light-mode override). Ils sont
listés pour audit et n'indiquent pas nécessairement un bug.

- `.empty-row` — propriété `padding`
  - `32px` _(style.css:509)_
  - `20px 10px` _(style.css:4715)_
- `.sidebar` — propriété `width`
  - `var(--sidebar-width)` _(style.css:1416)_
  - `min(84vw, 320px)` _(style.css:2906)_
- `.sidebar` — propriété `width`
  - `var(--sidebar-width)` _(style.css:1416)_
  - `min(84vw, 320px)` _(style.css:4538)_
- `.modal-large` — propriété `max-width`
  - `800px` _(style.css:3219)_
  - `min(100vw - 20px, 900px)` _(style.css:4514)_
- `.kpi-grid` — propriété `grid-template-columns`
  - `repeat(2, 1fr)` _(style.css:5200)_
  - `1fr` _(style.css:8553)_
- `#alertes-categories > div[style*="grid-template-columns"]:first-child` — propriété `grid-template-columns`
  - `repeat(2, 1fr)` _(style.css:8451)_
  - `1fr` _(style.css:8556)_
- `#btn-scroll-top` — propriété `bottom`
  - `calc(20px + env(safe-area-inset-bottom))` _(style.css:8537)_
  - `calc(80px + env(safe-area-inset-bottom))` _(style.css:8662)_

## 6. Vendor prefix manquants

- `.searchbar input[type="search"]` _(style.css:585)_ — `appearance: none` manque -moz-
- `.searchbar input[type="search"]::-webkit-search-cancel-button` _(style.css:590)_ — `appearance: none` manque -moz-
- `.livraison-inline-select` _(style.css:4009)_ — `appearance: auto` manque -webkit- & -moz-
- `select:not(.planning-type-select):not(.livraison-inline-select)` _(style.css:4728)_ — `appearance: none` manque -moz-
- `.period-selector` _(style.css:4771)_ — `appearance: none` manque -moz-
- `.pagination-select` _(style.css:5374)_ — `appearance: none` manque -moz-
- `input[type="text"]` _(style-mobile.css:73)_ — `appearance: none` manque -moz-

## 7. Fixed positioning — collisions d'ancrages

### Inventaire `.position: fixed`

- `.sidebar` _(style.css:125)_ — top:0 left:0 z=100
- `.modal-overlay` _(style.css:827)_ — inset:0 z=200
- `.toast` _(style.css:1403)_ — right:24px bottom:24px z=300
- `.sidebar-overlay` _(style.css:1484)_ — inset:0 z=99
- `#btn-scroll-top` _(style.css:1670)_ — right:28px bottom:28px z=150
- `.bulk-action-bar` _(style.css:1783)_ — bottom:24px left:50% z=1090
- `.side-drawer-overlay` _(style.css:1908)_ — inset:0 z=1100
- `.side-drawer` _(style.css:1925)_ — top:0 right:0 z=1101
- `.toast-stack` _(style.css:5592)_ — right:20px bottom:20px z=9999
- `.s15-modal-info-overlay` _(style.css:6588)_ — inset:0 z=9998
- `.s15-palette-overlay` _(style.css:6661)_ — inset:0 z=9999
- `.s20-drawer-overlay` _(style.css:7537)_ — inset:0 z=999
- `.s20-drawer` _(style.css:7546)_ — top:0 right:0 bottom:0 z=1000
- `.s25-drawer-overlay` _(style.css:7888)_ — inset:0 z=9990
- `.s25-drawer` _(style.css:7892)_ — top:0 right:0 z=auto
- `.mobile-bottom-nav` _(style.css:8569)_ — right:0 bottom:0 left:0 z=90
- `.m-bottom-nav` _(style-mobile.css:173)_ — right:0 bottom:0 left:0 z=40
- `.m-drawer-overlay` _(style-mobile.css:234)_ — inset:0 z=80
- `.m-drawer` _(style-mobile.css:249)_ — top:0 right:0 bottom:0 z=90
- `.m-toast` _(style-mobile.css:452)_ — bottom:calc(var(--m-tabbar-h) + var(--m-safe-bottom) + 16px) left:50% z=200
- `.m-fab` _(style-mobile.css:477)_ — right:calc(16px + var(--m-safe-right)) bottom:calc(var(--m-tabbar-h) + var(--m-safe-bottom) + 12px) z=45
- `.m-sheet-overlay` _(style-mobile.css:528)_ — inset:0 z=100
- `.m-sheet` _(style-mobile.css:543)_ — right:0 bottom:0 left:0 z=110

### Conflits (mêmes ancrages, familles différentes)

- ancrage `|0|0|0`
  - `.mobile-bottom-nav` _(style.css:8569)_ z=90
  - `.m-bottom-nav` _(style-mobile.css:173)_ z=40
  - `.m-sheet` _(style-mobile.css:543)_ z=110

## 8. `!important` sur animations/transitions hors `prefers-reduced-motion`

Note d'analyse : les déclarations `animation-duration: 0.01ms !important` et
`transition-duration: 0.01ms !important` placées DANS le bloc `@media (prefers-reduced-motion: reduce)`
apparaissent ici car le parseur top-level liste leurs sélecteurs sans connaître le wrapping.
Elles sont en fait sûres (le wrapping fait partie de leur spécificité).

Le seul vrai cas à valider : `.m-fab-secondary { transition: ... !important }` (style-mobile.css).
Comme la spec CSS donne au longhand un poids au moins égal au shorthand, et que le bloc
reduced-motion (longhand `transition-duration: 0.01ms !important`) apparaît PLUS BAS dans le
fichier, il l'emporte par ordre de cascade. Pas de bypass effectif.

- `*` _(style.css:8695)_ — `animation-duration: 0.01ms !important`
- `*` _(style.css:8695)_ — `transition-duration: 0.01ms !important`
- `.m-fab-secondary` _(style-mobile.css:500)_ — `transition: opacity 0.2s ease, transform 0.1s ease, background 0.2s ease !important`
- `*` _(style-mobile.css:717)_ — `animation-duration: 0.01ms !important`
- `*` _(style-mobile.css:717)_ — `transition-duration: 0.01ms !important`
