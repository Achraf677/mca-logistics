# Audit bundle splitting — état & recommandation

Date : 2026-05-06
Branche : `claude/bundle-splitting` (vide sauf ce doc)

## État actuel (constaté)

- **Tous les `<script>` admin.html sont déjà en `defer`** (57 scripts total). Donc le HTML parse sans blocage.
- **`lazy-loader.js` + `lazy-stubs.js` existent et fonctionnent**, mais utilisés uniquement pour `script-exports.js` (27 fonctions stubs prêtes).
- `script-exports.js` lui-même n'existe pas encore — les 27 stubs pointent vers un module fantôme (à extraire de `script.js` et créer).
- **`script.js` fait 13 612 lignes / ~664 Ko** : c'est lui qui contient la majorité des fonctions invoquées au boot.
- Le plan détaillé existe : `docs/archive/2026-05-03-bundle-splitting.md` (20 nouveaux fichiers proposés).

## Pourquoi je n'ai pas avancé en parallèle

1. **Inter-dépendances opaques** : `script-stats.js` expose `getSalarieStatsMois` utilisé dans `script-salaries.js:651` (fiche salarié). Si je le lazy-load, le rendu salariés casse.
2. **Aucun test E2E couvrant le lazy load** : sans tests qui vérifient "naviguer vers stats charge le module à temps", je risque des régressions silencieuses.
3. **27 stubs `script-exports` orphelins** : avant d'ajouter d'autres lazy modules, il faut d'abord créer `script-exports.js` (extraction de ~700 lignes de `script.js`). Sinon on accumule de la dette.
4. **Effort réaliste** : 4-6 h pour un splitting safe avec tests Playwright associés. Pas faisable en parallèle d'autres modifs sans risque.

## Recommandation : 3 sprints isolés (PR dédiées)

### Sprint A — Extraire `script-exports.js` (le "fantôme")
- Identifier les 27 fonctions exports dans `script.js` (lignes ~7 100-8 200 d'après le plan).
- Créer `script-exports.js` (~700 lignes, ~35 Ko).
- Retirer ces fonctions de `script.js`.
- Les stubs `lazy-stubs.js` (déjà en place) feront le lazy load au premier clic export.
- Tester : cliquer chaque bouton "Export CSV / PDF" et vérifier que ça charge + s'exécute.
- **Effort** : 2-3 h. **Gain** : -35 Ko au boot.

### Sprint B — Lazy load `script-rentabilite-multi.js`
- Module isolé (vue secondaire de Rentabilité), peu d'inter-dépendances.
- Créer stub pour `afficherRentabiliteParVehicule` (seul appel externe, dans `script-core-navigation.js`).
- Retirer de `admin.html`, ajouter au lazy-loader.
- Tester : naviguer vers Rentabilité, vérifier que la vue par véhicule charge.
- **Effort** : 1 h. **Gain** : -15 Ko au boot.

### Sprint C — Lazy load `script-stats.js` (avec dépendance résolue)
- Identifier comment isoler `getSalarieStatsMois` :
  - Option 1 : déplacer dans un nouveau `script-core-stats-helpers.js` (boot)
  - Option 2 : créer un stub synchrone qui renvoie `{}` si pas chargé, et qui se met à jour en arrière-plan
- Lazy load le reste (afficherStatistiques, exporterStatsPDF, navStatsMois, etc.)
- Tester : naviguer vers Salariés (helper synchrone OK), vers Stats (lazy charge OK), exporter PDF.
- **Effort** : 2-3 h. **Gain** : -25 Ko au boot.

### Sprint D (optionnel, gros) — Splitting `script.js` selon le plan complet
- Suivre `docs/archive/2026-05-03-bundle-splitting.md` (20 nouveaux fichiers).
- À tenter seulement après les sprints A+B+C validés.
- Très risqué si fait d'un coup → préférer 4-5 PR successives.
- **Effort** : 8-12 h cumulés. **Gain** : -400 Ko au boot.

## Mesures à prendre AVANT splitting

Sinon on splitte à l'aveugle :

1. **Lighthouse audit** sur la prod actuelle pour avoir le baseline (Performance score, FCP, LCP, TTI).
2. **Coverage report Chrome** : Sources → Coverage → enregistrer la nav initiale → liste des % de code mort par fichier.
3. **Tests Playwright** sur les routes critiques avant chaque split (pour catcher les régressions).

## Décision

Je recommande **NE PAS empiler le bundle splitting sur cette branche**. Le faire dans une PR isolée `claude/bundle-splitting-sprint-A` après validation de `claude/sprint-95pct`. Ordre A → B → C, chacune mergée et testée avant la suivante.
