# Spec refonte HTML — MCA Logistics (Phase 4)

**Pour Claude Code.** Tout ce dont tu as besoin pour migrer pages prod (`admin.html`, `m.html`, `salarie.html`) vers les mockups du design system, sans casser la moitié du JS.

## Comment lire ce pack

| # | Fichier | Pour quoi |
|---|---------|-----------|
| 01 | `01-mapping-classes.md` | Table mockup → prod, classe par classe |
| 02 | `02-ids-data-attrs.md` | Liste exhaustive des IDs / data-* / onclick à PRÉSERVER |
| 03 | `03-mockups-manquants.md` | Mockups qu'il faut me commander avant migration |
| 04 | `04-states-interactifs.md` | hover / focus / active / disabled par composant |
| 05 | `05-responsive.md` | Breakpoints + comportements |
| 06 | `06-animations.md` | Table durations / easings / cascades |
| 07 | `07-plan-migration.md` | Ordre des pages + estimations LOC |
| 08 | `08-composants-generiques.md` | Index des shells `preview/components/_*.html` |
| 09 | `09-tokens-additionnels.md` | Z-index, breakpoints, light mode |
| 10 | `10-checklist-qa.md` | Checklist PR à coller dans chaque pull request |

## Règle d'or

**Les IDs, data-attributes et noms de fonctions globaux dans `02-ids-data-attrs.md` sont SACRÉS.** Tout HTML refondu doit les conserver à l'identique. Le JS prod (`script.js`, 14 038 lignes) les lit directement par `getElementById`, `dataset.*`, `onclick="..."`. Les renommer = casser les fonctionnalités.

## Méthodologie page par page

1. Ouvrir le mockup cible dans `preview/`
2. Ouvrir la page prod (ex `admin.html`)
3. Croiser avec `01-mapping-classes.md` : remplacer les classes
4. Croiser avec `02-ids-data-attrs.md` : remettre tous les `id=`, `data-*=`, `onclick="..."` au bon endroit dans le nouveau markup
5. Appliquer `04-states-interactifs.md` (CSS hover/focus/active)
6. Appliquer `06-animations.md` (cascades nav, hover boutons, etc.)
7. Tester avec `10-checklist-qa.md`
8. `npm test` doit rester vert
