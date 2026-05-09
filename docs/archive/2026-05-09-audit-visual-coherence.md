# Audit cohérence visuelle cross-composants — 2026-05-09

Chasseur d'incohérences visuelles sur `style.css` (8 808 l) +
`style-mobile.css` (745 l). Objectif : repérer les patterns qui dégradent
la perception de qualité.

Branche : `claude/visual-hunter-components`. Base : `main` au commit
7001982 (PR #58 mergée).

---

## 1. Tailles de police (`font-size`)

### style.css : **81 valeurs distinctes** sur ~500 occurrences

Top usages : `.82rem` (53), `.72rem` (52), `.78rem` (38), `.85rem` (30),
`.88rem` (38), `.75rem` (20), `1rem` (16), `0.95rem` (12).

**Aberrations corrigées (fix trivial appliqué dans cette PR)** :

| Valeur | Occ. | Action | Localisation |
|---|---|---|---|
| `.62rem` | 3 | → `.66rem` | `.dz-section-title`, `.nav-section-label`, `.cal16-day-ferie-tag` |
| `.6rem` | 1 | → `.66rem` | `.sante-ring-unit` |

**Aberrations à valider (laissées telles quelles, à arbitrer)** :

- `.83rem` (2), `.86rem` (5), `.84rem` (10) — devraient toutes converger sur `.85rem`
- `.98rem` (1) — devrait être `1rem`
- `.74rem` (11), `.76rem` (11) — entre `.72rem` et `.78rem`, choisir une valeur
- `.64rem` (2) — entre `.65rem` (7) standard
- `.92rem` (17) — proche de `.9rem` (16) et `.95rem` (21)

### style-mobile.css : **20 valeurs distinctes** sur 35 occurrences
Plus saine. Mais valeurs `.65rem` (1) et `.66rem` (1) côte-à-côte =
duplication inutile.

### Recommandation architecturale (sprint H2.3 ou H3)

Définir une échelle typographique sur 6 paliers maxi dans `:root` :

```css
--fs-xs:   0.72rem;  /* labels caps, badges */
--fs-sm:   0.82rem;  /* tableau body, hint */
--fs-base: 0.95rem;  /* body défaut */
--fs-md:   1rem;
--fs-lg:   1.15rem;
--fs-xl:   1.5rem;
```

Migration : ~500 occurrences → mécanique mais pas trivial. À planifier avec
PR dédiée + revue visuelle.

---

## 2. Border-radius

### Tokens existants (déjà en place) :
```
--radius-sm: 6px  --radius-md: 10px  --radius-lg: 14px  --radius-xl: 20px
--radius: var(--radius-md)  /* alias */
--m-radius: 12px  --m-radius-large: 18px  /* mobile */
```

### style.css : 23 valeurs distinctes

| Valeur | Occ. | Token équivalent | Statut |
|---|---|---|---|
| `8px` | 76 | (ø) — entre `--radius-sm` et `--radius-md` | **Aberration majeure** |
| `10px` | 51 | `--radius-md` | Migrer |
| `12px` | 33 | (ø) — proche `--m-radius` mobile | Mismatch PC/mobile |
| `6px` | 24 | `--radius-sm` | Migrer |
| `14px` | 20 | `--radius-lg` | Migrer |
| `4px` | 17 | (ø) | À ajouter `--radius-xs: 4px` ? |
| `999px` | 16 | (ø) | À ajouter `--radius-pill` |
| `20px` | 13 | `--radius-xl` | Migrer |

**Constat** : `8px` (76 occ) ne correspond à **aucun token** alors qu'il
domine. PC et mobile divergent : mobile utilise `12px` partout (`--m-radius`),
PC utilise majoritairement `8px` qui n'est tokenisé nulle part.

### Recommandation
Étendre les tokens et homogénéiser PC↔mobile :
```css
--radius-xs: 4px;
--radius-pill: 999px;
/* Migrer 76 × 8px → soit --radius-sm (6px) soit --radius-md (10px) */
```

---

## 3. Espacements (padding / margin)

**Bonne nouvelle** : aucune valeur "au hasard" (0 occurrences de `13px`,
`17px`, `19px`, `21px`, `23px`, `25px`, `27px`, `29px`).

Les paddings suivent une **grille 2pt** plutôt que 8pt :

| Valeur | Occ. | Multiple de 4 ? |
|---|---|---|
| 12px | 105 | oui |
| 10px | 103 | non (mod 2) |
| 14px | 91 | non (mod 2) |
| 8px | 65 | oui |
| 16px | 53 | oui |
| 6px | 49 | non (mod 2) |
| 20px | 40 | oui |
| 4px | 33 | oui |
| 18px | 24 | non (mod 2) |
| 7px | 20 | non (mod 1) |
| 5px | 20 | non (mod 1) |
| 9px | 18 | non (mod 1) |

**Verdict** : pas de chaos, mais grille 2pt assumée. Tokens
`--space-1..8` définis (`4/8/12/16/20/24/32`) mais utilisés 0 fois dans
`style.css` (les CSS hardcodent les pixels). Les paddings type `9px 18px`,
`7px 14px` pour boutons sont volontaires (centrage optique typo).

### Recommandation
Ajouter `--space-1-5: 6px` / `--space-2-5: 10px` / `--space-3-5: 14px`
pour couvrir les inter-paliers récurrents, puis migrer progressivement.

---

## 4. Box-shadows

### style.css : **58 valeurs distinctes**, style-mobile.css : **7 valeurs**

Tokens existants déjà définis :
```
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3)
--shadow-md: 0 4px 12px rgba(0,0,0,0.4)
--shadow-lg: 0 10px 30px rgba(0,0,0,0.5)
--shadow-xl: 0 20px 60px rgba(0,0,0,0.6)
```

`var(--shadow)` n'est utilisé que **4 fois** sur 58 valeurs distinctes
hardcodées. Énorme drift.

### Patterns récurrents non-tokenisés
- `0 4px 14px rgba(0,0,0,0.X)` — variations sur cartes (5+ occurrences)
- `0 8px 24px rgba(0,0,0,0.X)` — variations sur modals/drawers (8+)
- `0 0 0 3px rgba(...)` — focus rings divers (à tokeniser)

### Recommandation (sprint H2 architectural)
Migrer vers les 4 tokens existants (`--shadow-sm/md/lg/xl`) +
ajouter `--shadow-focus: 0 0 0 3px var(--accent-soft)` pour les focus
rings. Cible : **réduire de 58 → 6 valeurs distinctes**.

---

## 5. Couleurs hardcodées

### style.css : **130 hex distincts**, **556 occurrences totales**
Pour comparaison : `var(--*)` est utilisé **680 fois**. Donc ~45 % des
couleurs sont en dur.

### Top 10 couleurs hardcodées non-tokenisées

| Hex | Occ. | Sémantique probable | Token suggéré |
|---|---|---|---|
| `#fff` / `#ffffff` | 61 | blanc text/bg | `--white: #fff` |
| `#6366f1` | 42 | violet legacy (Indigo) | tokeniser ou supprimer (palette est rouge) |
| `#ef4444` | 36 | rouge erreur | `--danger: #ef4444` |
| `#e63946` | 25 | accent brand (déjà `--accent`) | **migrer vers `var(--accent)`** |
| `#0f172a` | 23 | très sombre (slate-900) | `--bg-deep` |
| `#e74c3c` | 19 | rouge alt legacy | **migrer vers `var(--accent)`** |
| `#1a1d27` | 17 | bg-dark legacy | **migrer vers `var(--bg)`** |
| `#94a3b8` | 14 | gris muted | `--text-muted` (existe déjà) |
| `#64748b` | 14 | gris secondary | `--text-secondary` (existe déjà) |
| `#1f2937` | 13 | sombre alt | `--bg-elevated` (existe déjà) |

**Note** : la PR #58 (H3.7) a déjà nettoyé les 96 résidus
`rgba(245,166,35,...)` et les 2 hovers `#d4911d`. Cette PR n'a donc pas
eu à les retoucher.

---

## 6. Transitions

### style.css : **77 valeurs distinctes**
Distribution durations :
- `.15s` (70) + `0.15s` (15) = **85** — dominant
- `.2s` (18) + `0.2s` (22) = **40** — secondaire
- `.18s` (10), `.3s` (10), `.12s` (9), `.25s` (7), `.1s` (7), `.22s` (5)

Tokens existants : `--t-fast: 150ms ease`, `--t-base: 250ms ease`,
`--t-slow: 400ms cubic-bezier`. **Utilisés 0 fois.**

### Recommandation
Migrer à 3 valeurs : `var(--t-fast)` (hover/focus), `var(--t-base)`
(modals), `var(--t-slow)` (drawers). Cible : 77 → 3.

---

## 7. Boutons

### PC : 23 classes `.btn-*`
Canoniques : `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-icon`,
`.btn-close`.
Spécialisés (légitime) : `.btn-bulk`, `.btn-bulk-danger`, `.btn-cat-budget`,
`.btn-collapse-sidebar`, `.btn-density`, `.btn-export`, `.btn-hamburger`,
`.btn-link-inline`, `.btn-maps`, `.btn-menu-mobile`, `.btn-mois`,
`.btn-mois-today`, `.btn-more`, `.btn-page`, `.btn-rapport`,
`.btn-theme-toggle`, `.btn-toggle-tri`, `.btn-view`.

### Mobile : 3 classes
`.m-btn`, `.m-btn-primary`, `.m-btn-danger`. **Aucun équivalent à
`.btn-secondary`** côté mobile alors que la sémantique existe (boutons
secondaires sont restylés ad-hoc inline).

### Aucune duplication détectée
Pas de classes "jumelles" qui font visuellement la même chose. Bon point.

### Recommandation
Ajouter `.m-btn-secondary` et `.m-btn-ghost` pour parité PC↔mobile (sprint H2.4).

---

## 8. Empty states

CLAUDE.md indiquait "6 tables PC utilisent `<tr><td class="empty-row">`".
Audit effectué après PR #56 :

| Fichier | Occurrences `empty-row` |
|---|---|
| script.js | 11 |
| script-rentabilite-multi.js | 4 |
| script-planning.js | 3 |
| script-clients.js | 3 |
| script-livraisons.js | 2 |
| script-tva.js | 2 |
| script-alertes.js | 1 |
| script-core-audit.js | 1 |
| script-entretiens.js | 1 |
| script-fournisseurs.js | 1 |
| script-incidents.js | 1 |
| **Total** | **30** |

À comparer aux 24 utilisations correctes de `emptyState()`. La
migration n'est **pas terminée**. PR #56 a partiellement traité mais 30
occurrences subsistent (dont 11 dans `script.js`). À reprendre.

---

## Synthèse — fixes appliqués vs à planifier

### Appliqués (fix trivial dans cette PR)
- `font-size: .62rem` (3 occurrences) → `.66rem`
- `font-size: .6rem` (1 occurrence) → `.66rem`

### Déjà résolus (PR #58 mergée avant cette PR)
- 96 résidus `rgba(245,166,35,...)` → `var(--accent-soft)`
- 2 hovers `#d4911d` → `var(--accent-hover)`

### À planifier (architectural — H2/H3)
1. Échelle typographique 6 paliers (~500 occurrences à migrer)
2. Compléter tokens `--radius-xs`, `--radius-pill` + harmoniser PC/mobile (76 × `8px`)
3. Tokeniser top-10 couleurs hardcodées (`#6366f1`, `#ef4444`, `#0f172a`, `#e74c3c`, `#1a1d27`)
4. Migrer 58 box-shadows distinctes → 4-6 tokens
5. Migrer 77 transitions distinctes → 3 tokens (`--t-fast/base/slow`)
6. Ajouter `.m-btn-secondary` / `.m-btn-ghost` pour parité PC↔mobile
7. Finir migration `empty-row` → `emptyState()` (30 occurrences restantes)
