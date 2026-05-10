# 04 — États interactifs (hover / focus / active / disabled)

**Objectif :** rendre tous les composants prévisibles, accessibles (WCAG 2.2 AA) et cohérents avec le DS.

## Tokens d'état (ajouter à `colors_and_type.css` si manquants)

```css
:root {
  /* Anneaux focus */
  --ring-brand: 0 0 0 3px rgba(229, 9, 20, 0.35); /* crimson DS */
  --ring-brand-strong: 0 0 0 3px rgba(229, 9, 20, 0.55);
  --ring-neutral: 0 0 0 3px rgba(148, 163, 184, 0.35);
  --ring-danger: 0 0 0 3px rgba(220, 38, 38, 0.4);

  /* Lift / elevation deltas */
  --lift-sm: -1px;
  --lift-md: -2px;
  --press-scale: 0.98;

  /* Durées d'état */
  --t-hover: 0.18s;
  --t-press: 0.08s;
  --t-focus: 0.12s;

  /* Disabled */
  --disabled-opacity: 0.5;
  --disabled-cursor: not-allowed;
}
```

## Composants

### Boutons

| Composant | Default | Hover | Focus-visible | Active (pressed) | Disabled |
|-----------|---------|-------|---------------|------------------|----------|
| `.btn-primary` | bg `--brand`, color blanc | bg `--brand-hover`, lift `--lift-sm`, ombre `--shadow-md` | + `box-shadow: var(--ring-brand)` | `transform: scale(.98)`, ombre off | `opacity: .5`, `cursor: not-allowed`, pas de hover |
| `.btn-secondary` | bg `--surface-2`, border `--border` | bg `--surface-3`, border `--border-strong` | `box-shadow: var(--ring-neutral)` | scale .98 | idem |
| `.btn-ghost` | transparent, color `--text` | bg `--surface-2-hover` (rgba 6%) | ring neutre | bg `--surface-3` | idem |
| `.btn-icon` | transparent rond 36x36 | bg `--surface-2-hover` | ring neutre | bg `--surface-3` | idem |
| `.btn-danger` | bg `--danger`, color blanc | bg `--danger-hover` (-8% lightness), lift -1px | `box-shadow: var(--ring-danger)` | scale .98 | opacity .5 |
| `.btn-link` | color `--brand`, underline none | underline | ring brand | color `--brand-press` | opacity .5 |

**Reflet (sheen) sur hover btn-primary :** `06-animations.md`.

### Champs de formulaire

| Composant | Default | Hover | Focus | Invalid | Disabled |
|-----------|---------|-------|-------|---------|----------|
| `.input`, `.textarea`, `.select` | border `--border`, bg `--surface-1` | border `--border-strong` | border `--brand`, `box-shadow: var(--ring-brand)` | border `--danger`, `box-shadow: var(--ring-danger)` | bg `--surface-0`, opacity .6 |
| `.checkbox`, `.radio` | border `--border` 2px | border `--border-strong` | ring brand autour | — | opacity .5 |
| `.toggle-switch` | bg `--surface-3` | bg `--surface-3-hover` | ring brand | — (state via `aria-checked`) | opacity .5 |

### Navigation

| Composant | Default | Hover | Focus | Active (current page) |
|-----------|---------|-------|-------|------------------------|
| `.nav-item` | color `--muted`, bg transparent | bg `--surface-2-hover`, color `--text` | outline 2px `--brand` offset 2 | bg `--brand-soft` (rgba 12%), color `--brand`, barre gauche 3px `--brand` |
| `.tab` | color `--muted`, border-bottom transparent | color `--text` | ring brand | color `--text`, border-bottom 2px `--brand` |
| `.breadcrumb a` | color `--muted` | color `--text`, underline | ring neutre | (last item) color `--text` no link |

### Cards / Tiles

| Composant | Default | Hover | Focus (si focusable) |
|-----------|---------|-------|----------------------|
| `.kpi-card` | border `--border` subtle, ombre none | border `--border-strong`, ombre `--shadow-sm`, lift -2px | ring neutre |
| `.veh-card`, `.salarie-card`, `.client-card` (cliquable) | idem | idem + bg légèrement plus clair | ring brand |
| `.chart-card` | border subtle | border-strong | — (pas focusable globalement) |
| `.alert-item` | bg `--surface-1`, border-left 3px gravité | bg `--surface-1-hover`, border-left 4px | ring gravité |

### Tables

| Composant | Default | Hover | Focus row | Selected (bulk) |
|-----------|---------|-------|-----------|------------------|
| `tr` (data row) | bg `--surface-1` | bg `--surface-1-hover` (3% darker) | outline 2px brand inset | bg `--brand-soft`, border-left 3px brand |
| `th[data-sort-key]` | color `--muted`, cursor pointer | color `--text`, icône tri visible | ring neutre | (sorted asc/desc) icône orientée + color `--text` |
| `.bulk-liv-check` | checkbox standard | + bg row hover | ring neutre | check + row selected |

### Modales / Drawers / Toasts

| Composant | États |
|-----------|-------|
| `.modal__overlay` | fade-in 0.2s, click → close |
| `.modal__shell` | scale 0.95→1 + opacity 0→1, 0.25s quint-out à l'open ; reverse au close |
| `.drawer` | translateX(100%)→0, 0.3s quint-out ; overlay fade |
| `.toast` | slide-in droit + fade, 0.3s ; auto-dismiss timer ; hover → pause timer |

### Drag & drop (kanban / planning)

| État | Style |
|------|-------|
| `.drag-source` (en cours de drag) | opacity .4, cursor grabbing |
| `.drag-over` (zone cible) | bg `--brand-soft`, border 2px dashed `--brand`, scale 1.02 |
| `.drag-rejected` | shake 0.4s, bg `--danger-soft` |

### Liens

| Composant | Default | Hover | Focus | Visited |
|-----------|---------|-------|-------|---------|
| `a` (texte courant) | color `--brand`, no underline | underline | ring brand | color `--brand-visited` (légèrement violet) |
| `.table-link-button` | color `--brand`, no underline | underline + lift bg `--brand-soft` | ring brand | — |

## Règles transverses

1. **focus-visible obligatoire** : tous les composants interactifs doivent afficher leur ring uniquement avec `:focus-visible`, jamais `:focus` seul (évite les rings au clic souris).
2. **Pas de `outline: none`** sans remplacement immédiat par un `box-shadow` ou border équivalent.
3. **Respect `prefers-reduced-motion`** : désactiver lift, scale, sheen, slide. Garder uniquement opacity (cf `06-animations.md`).
4. **Disabled = `aria-disabled="true"` + `pointer-events: none`** (pas seulement opacity, sinon clic enregistré).
5. **Hover sur écrans tactiles** : utiliser `@media (hover: hover)` pour ne pas appliquer les hovers sur mobile (sinon ils restent "collés" après tap).

```css
@media (hover: hover) {
  .btn-primary:hover { /* … */ }
}
```
