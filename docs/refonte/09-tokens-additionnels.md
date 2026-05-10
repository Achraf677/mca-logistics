# 09 — Tokens additionnels manquants

À ajouter dans `colors_and_type.css` (ou un nouveau `tokens.css` importé en premier).

## Z-index canonique

```css
:root {
  --z-base: 0;
  --z-sticky: 100;
  --z-sidebar: 200;          /* sidebar desktop */
  --z-bottom-nav: 300;       /* bottom nav mobile */
  --z-fab: 400;              /* floating action button */
  --z-dropdown: 1000;        /* select natif customisé, autocomplete */
  --z-sticky-header: 1100;   /* en-têtes sticky de tableaux */
  --z-popover: 5000;         /* popovers, command palette */
  --z-tooltip: 6000;
  --z-overlay: 8000;         /* overlay drawer/modal */
  --z-drawer: 8500;          /* drawer 360 */
  --z-modal: 9000;           /* modale centrée */
  --z-toast: 9500;           /* toasts au-dessus de tout */
  --z-debug: 99999;          /* outils dev/audit */
}
```

**Règle :** plus jamais de `z-index: 9999` en dur. Toujours référer un token.

## Breakpoints

```css
:root {
  --bp-xs: 360px;
  --bp-sm: 640px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
  --bp-2xl: 1536px;
}
```

(Voir `05-responsive.md` pour usage.)

## Espacement (échelle 4px)

Si pas déjà présents :

```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
  --space-10: 64px;
  --space-11: 80px;
  --space-12: 96px;
}
```

## Radii

```css
:root {
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
}
```

## Shadows

```css
:root {
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.45);
  --shadow-md: 0 6px 14px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 14px 32px rgba(0, 0, 0, 0.55);
  --shadow-xl: 0 28px 60px rgba(0, 0, 0, 0.6);
  --shadow-glow-brand: 0 0 28px rgba(229, 9, 20, 0.35);
}
```

## Light mode (palette miroir)

**Règle :** définir tous les tokens `--surface-*`, `--text-*`, `--border-*` en deux versions, switchées par `[data-theme="light"]` sur `<html>`.

```css
/* Dark (défaut) */
:root {
  --surface-0: #0a0a0c;       /* fond app */
  --surface-1: #14141a;       /* cards */
  --surface-2: #1c1c24;       /* cards hover, inputs */
  --surface-3: #26262f;       /* élevé */
  --surface-2-hover: #20202a;
  --surface-3-hover: #2c2c36;

  --text:        #f4f4f5;
  --text-strong: #ffffff;
  --muted:       #94949f;
  --muted-strong:#b8b8c2;

  --border:      #2a2a35;
  --border-strong: #3a3a48;
  --border-subtle: #1f1f29;

  --brand:        #e50914;
  --brand-hover:  #c40712;
  --brand-press:  #a8060f;
  --brand-soft:   rgba(229, 9, 20, 0.12);

  --success:      #10b981;
  --success-soft: rgba(16, 185, 129, 0.14);
  --warning:      #f59e0b;
  --warning-soft: rgba(245, 158, 11, 0.14);
  --danger:       #dc2626;
  --danger-hover: #b91c1c;
  --danger-soft:  rgba(220, 38, 38, 0.14);
  --info:         #3b82f6;
  --info-soft:    rgba(59, 130, 246, 0.14);
}

/* Light mirror */
[data-theme="light"] {
  --surface-0: #f7f7f9;
  --surface-1: #ffffff;
  --surface-2: #f1f1f4;
  --surface-3: #e4e4ea;
  --surface-2-hover: #ebebef;
  --surface-3-hover: #dcdce3;

  --text:        #0f0f12;
  --text-strong: #000000;
  --muted:       #5a5a66;
  --muted-strong:#3a3a44;

  --border:      #d6d6dd;
  --border-strong: #b4b4be;
  --border-subtle: #e8e8ee;

  /* Brand reste identique */
  --brand-soft:   rgba(229, 9, 20, 0.10);
}
```

**Toggle :** bouton dans header → écrit `data-theme` sur `<html>` + persiste dans `localStorage("mca-theme")`. Restaurer au boot avant render pour éviter flash.

```js
// Avant tout render
const saved = localStorage.getItem('mca-theme');
if (saved === 'light' || saved === 'dark') {
  document.documentElement.setAttribute('data-theme', saved);
}
```

## Type tokens (rappel pour cohérence)

Si tu n'as pas déjà :

```css
:root {
  --font-display: "Bricolage Grotesque", "Noto Serif", Georgia, serif;
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "JetBrains Mono", Menlo, monospace;

  --fs-xs: 12px;
  --fs-sm: 13px;
  --fs-base: 14px;
  --fs-md: 15px;
  --fs-lg: 17px;
  --fs-xl: 20px;
  --fs-2xl: 24px;
  --fs-3xl: 32px;
  --fs-4xl: 44px;
  --fs-5xl: 56px;

  --lh-tight: 1.15;
  --lh-snug: 1.3;
  --lh-normal: 1.5;
  --lh-loose: 1.7;

  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-bold: 700;
}
```

## Modales (largeurs canoniques)

```css
:root {
  --modal-sm: 480px;
  --modal-md: 640px;
  --modal-lg: 880px;
  --modal-xl: 1120px;
}
```

## Drawers (largeurs canoniques)

```css
:root {
  --drawer-sm: 360px;
  --drawer-md: 480px;
  --drawer-lg: 640px;
}
```
