# 06 — Animations

**Principe :** sobres, courtes, jamais bloquantes. Toujours opt-out via `prefers-reduced-motion`.

## Easings canoniques (à mettre dans `colors_and_type.css`)

```css
:root {
  --ease-quint-out: cubic-bezier(0.22, 1, 0.36, 1);   /* sortie naturelle, défaut */
  --ease-quint-in:  cubic-bezier(0.64, 0, 0.78, 0);
  --ease-quart-in-out: cubic-bezier(0.76, 0, 0.24, 1); /* déplacements */
  --ease-back-out: cubic-bezier(0.34, 1.56, 0.64, 1);  /* léger overshoot, à utiliser parcimonie */
  --ease-spring: cubic-bezier(0.5, 1.5, 0.5, 1);
}
```

## Table exhaustive

| Trigger | Élément | Animation | Durée | Easing | Delay | Notes |
|---------|---------|-----------|-------|--------|-------|-------|
| Page nav (entrée) | `.page > section` | fade-up cascade (translateY 8px → 0, opacity 0→1) | 0.4s | quint-out | 0 / 0.05s / 0.10s / 0.15s par enfant | utiliser `nth-child` ou JS |
| Bouton hover | `.btn-primary` | reflet (sheen) gauche → droite | 0.7s | linear | 0 | gradient `::before`, `transform: translateX(-100% → 100%)` |
| Bouton press | `.btn-*` | scale 1 → 0.98 | 0.08s | quint-out | 0 | `:active` |
| Bouton hover lift | `.btn-primary`, `.btn-secondary` | translateY -1px | 0.18s | quint-out | 0 | + ombre |
| KPI hover | `.kpi-card` | translateY -2px + ombre | 0.18s | quint-out | 0 | |
| Card hover | `.card[data-clickable]` | bg légèrement plus clair, ombre | 0.18s | quint-out | 0 | |
| Modal open | `.modal__shell` | scale 0.95 → 1 + opacity 0 → 1 | 0.25s | quint-out | 0 | overlay fade en parallèle 0.2s |
| Modal close | `.modal__shell` | scale 1 → 0.97 + opacity 1 → 0 | 0.18s | quint-in | 0 | |
| Drawer open | `.drawer` | translateX(100%) → 0 | 0.3s | quint-out | 0 | overlay fade 0.2s parallèle |
| Drawer close | `.drawer` | translateX(0) → 100% | 0.22s | quart-in-out | 0 | |
| Toast in | `.toast` | slide-from-right (translateX 16px → 0) + opacity 0→1 | 0.3s | back-out | 0 | |
| Toast out | `.toast` | opacity 1→0 + translateY -4px | 0.2s | quint-in | 0 | |
| Skeleton shimmer | `.skeleton` | background-position -200% → 200% | 1.4s | linear | 0 | infini, gradient `linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)` background-size: 200% 100% |
| Tooltip in | `.tooltip` | opacity 0→1 + translateY 4px → 0 | 0.12s | quint-out | 0.5s (anti-flash) | |
| Tab switch | `.tab-panel` | crossfade (out 0.1s, in 0.15s) | 0.25s total | quint-out | 0 | |
| Bulk bar in | `#bulk-action-bar` | slide-up (translateY 100% → 0) | 0.3s | quint-out | 0 | |
| Bulk bar out | `#bulk-action-bar` | slide-down (translateY 0 → 100%) | 0.22s | quint-in | 0 | |
| Sidebar drawer mobile | `#sidebar` | translateX(-100%) → 0 | 0.28s | quint-out | 0 | overlay fade parallèle |
| Accordion expand | `.accordion__panel` | max-height + opacity (mieux : `details` natif + `interpolate-size`) | 0.25s | quart-in-out | 0 | |
| Sort col change | `<tr>` réordonnés | FLIP : capture rect → swap DOM → animer transform inverse → 0 | 0.35s | quint-out | 0 | utiliser View Transitions API si supporté |
| Filtre add/remove | `.chip` | scale 0→1 + opacity 0→1 | 0.18s | back-out | 0 | |
| Drag start | `.drag-source` | opacity 1→0.4 | 0.12s | quint-out | 0 | |
| Drag over zone | `.drag-over` | scale 1→1.02 + bg `--brand-soft` | 0.15s | quint-out | 0 | |
| Drop accepted | item dropé | flash bg `--success-soft` 0.4s | 0.4s | quint-out | 0 | |
| Drop rejected | `.drag-rejected` | shake (translateX -8 / 8 / -4 / 4 / 0) | 0.4s | linear | 0 | |
| KPI value update | `.kpi-card__value` | crossfade nombre + flash bg subtil | 0.4s | quint-out | 0 | utiliser `view-transition-name` |
| Notification badge | `.badge-alertes` (count change) | pop (scale 1→1.3→1) | 0.3s | back-out | 0 | |
| Loading spinner | `.spinner` | rotate 360deg | 0.9s | linear | 0 | infini |
| Progress bar | `.progress__fill` | width 0→X% | 0.6s | quint-out | 0 | |

## Cascade de page (entrée)

```css
.page > * {
  opacity: 0;
  transform: translateY(8px);
  animation: fade-up 0.4s var(--ease-quint-out) forwards;
}
.page > *:nth-child(1) { animation-delay: 0s; }
.page > *:nth-child(2) { animation-delay: 0.05s; }
.page > *:nth-child(3) { animation-delay: 0.10s; }
.page > *:nth-child(4) { animation-delay: 0.15s; }
.page > *:nth-child(n+5) { animation-delay: 0.20s; }

@keyframes fade-up {
  to { opacity: 1; transform: none; }
}
```

## Reflet de bouton (sheen)

```css
.btn-primary {
  position: relative;
  overflow: hidden;
}
.btn-primary::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 0.7s linear;
  pointer-events: none;
}
.btn-primary:hover::before {
  transform: translateX(100%);
}
```

## prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  /* Garder les opacités (instantanées) */
  .page > * { opacity: 1; transform: none; }
  /* Désactiver lift, sheen, scale, shake */
  .btn-primary::before { display: none; }
}
```

## Règles d'or

1. **Jamais d'animation > 0.4s** sur une interaction directe (sauf entrée de page cascade).
2. **Ne pas animer `width` / `height`** (mauvaise perf) → préférer `transform` + `opacity`.
3. **Pas d'animation infinie visible** (sauf spinner/skeleton). Pas de pulsation décorative.
4. **Toujours `will-change` SI nécessaire**, retirer après l'animation pour libérer la GPU.
5. **Les animations ne doivent jamais bloquer un click** (utiliser `pointer-events`).
