# 10 — Checklist QA visuelle par page

**Usage :** copier ce bloc dans la description de chaque PR de refonte.

```markdown
## Checklist refonte page : <NOM_PAGE>

### Fidélité visuelle
- [ ] Pixel-perfect ±3px aux mockups `preview/<page>.html`
- [ ] Type system respecté (font-family, sizes, line-heights)
- [ ] Palette respectée (aucun hex en dur, tout via tokens CSS)
- [ ] Espacements via `--space-*`, pas de px en dur
- [ ] Radii via `--radius-*`
- [ ] Ombres via `--shadow-*`

### Préservation JS prod
- [ ] Tous les IDs de `docs/refonte/02-ids-data-attrs.md` présents (grep auto)
- [ ] Tous les `data-*` requis présents
- [ ] Tous les `onclick="..."` préservés (grep `onclick=` avant/après)
- [ ] Ordre DOM des `<tr>` dans `tb-*` inchangé (sinon JS qui itère casse)
- [ ] Drawers/modales : structure overlay + container + body + title préservée

### États interactifs (`docs/refonte/04-states-interactifs.md`)
- [ ] Tous les boutons : default / hover / focus-visible / active / disabled
- [ ] Tous les inputs : default / hover / focus / invalid / disabled
- [ ] Toutes les rows tableau : hover + selected (bulk)
- [ ] Nav : current page bien marquée
- [ ] Hover désactivé sur tactile (`@media (hover: hover)`)
- [ ] `:focus-visible` partout, jamais `:focus` seul

### Animations (`docs/refonte/06-animations.md`)
- [ ] Cascade entrée page (0 / 0.05 / 0.10 / 0.15s)
- [ ] Hover boutons : lift + sheen
- [ ] Modales : open scale 0.95→1 / fade 0.25s
- [ ] Drawers : slide-right 0.3s
- [ ] Toasts : slide-from-right + back-out
- [ ] `prefers-reduced-motion` désactive bien lift/scale/sheen/shake

### Responsive (`docs/refonte/05-responsive.md`)
- [ ] Test 320px (iPhone SE) — pas de scroll horizontal
- [ ] Test 375px (iPhone standard)
- [ ] Test 768px (iPad portrait)
- [ ] Test 1024px (iPad landscape / petit desktop)
- [ ] Test 1280px (desktop standard)
- [ ] Test 1920px (desktop large)
- [ ] Sidebar : drawer mobile <1024, collapsed 1024-1279, expanded ≥1280
- [ ] Modales : fullscreen <640
- [ ] Drawers : fullscreen <768, 70vw 768-1279, fixe ≥1280
- [ ] Tables : conversion cards <768
- [ ] Hit targets ≥ 44×44 sur mobile

### Thèmes
- [ ] Dark mode : tous tokens `--surface-*`, `--text-*`, `--border-*` utilisés (zéro hex)
- [ ] Light mode : test rendu complet, pas de bug de contraste
- [ ] Toggle theme persisté `localStorage('mca-theme')`
- [ ] Pas de flash au boot (theme appliqué avant render)

### Accessibilité (a11y)
- [ ] Focus visible sur tous les éléments interactifs
- [ ] ARIA roles sur composants non-natifs (modal `role="dialog"`, drawer idem)
- [ ] `aria-label` sur boutons icônes seuls
- [ ] `aria-current="page"` sur nav-item actif
- [ ] `aria-expanded` sur accordions / dropdowns
- [ ] `aria-live="polite"` sur conteneur toasts
- [ ] Contraste AA minimum (texte 4.5:1, large 3:1)
- [ ] Navigation clavier complète (tab, shift+tab, enter, esc, flèches dans menus)
- [ ] Modales : focus trap + return focus à l'ouvreur
- [ ] Skip link `<a href="#mainContent">` au début du body
- [ ] Headings hiérarchiques (un seul `<h1>` par page, pas de saut)

### Tests automatisés
- [ ] `npm test` vert
- [ ] `tests/code-quality-no-collisions.test.js` vert
- [ ] `tests/dashboard-kpis-parite.test.js` vert (si page dashboard)
- [ ] `tests/e2e/02-admin-pages.spec.js` vert
- [ ] `tests/e2e/06-admin-onglets-smoke.spec.js` vert
- [ ] `tests/e2e/10-a11y-baseline.spec.js` vert
- [ ] Pas de régression linter (`npm run lint`)

### Performance
- [ ] Pas de `width`/`height` animées (uniquement `transform`/`opacity`)
- [ ] `will-change` retiré après animation
- [ ] Pas d'images non optimisées ajoutées (>200KB)
- [ ] CSS additionnel <30KB par page (gzip)

### Documentation
- [ ] CHANGELOG.md mis à jour
- [ ] Si nouveau composant : ajouté à `preview/components/`
- [ ] Si nouveau token : ajouté à `docs/refonte/09-tokens-additionnels.md`
- [ ] Screenshot avant/après dans la PR
```

## Procédure de revue

1. **Auto-checks (CI) :** ESLint, Stylelint, HTMLHint, npm test, Playwright e2e
2. **Visual regression :** `tools/visual-hunter-css-static.js` lancé sur les pages touchées
3. **Manuel :** un reviewer humain coche au moins toutes les sections "Fidélité visuelle", "Préservation JS prod", "Responsive", "Accessibilité"
4. **Sign-off design :** comparaison côte-à-côte mockup vs page prod refondue, validation @achraf

## Si une case ne peut pas être cochée

Documenter dans la PR avec un `// FIXME-refonte: <raison>` dans le code et créer une issue dédiée. Ne jamais cocher faussement.
