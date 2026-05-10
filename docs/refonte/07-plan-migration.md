# 07 — Plan de migration recommandé

**Hypothèse :** Phase 4 = refonte HTML uniquement, JS prod inchangé. On migre page par page en respectant `02-ids-data-attrs.md`.

## Ordre + estimations

| # | Page / fichier | LOC HTML estimé | Effort (h) | Priorité | Pourquoi cet ordre |
|---|----------------|-----------------|-----------|----------|---------------------|
| 1 | **Dashboard admin** (`admin.html` section dashboard) | ~280 | 4-6h | 🔴 Critique | Première page vue après login. Définit la barre visuelle. KPIs + 2 charts + activity feed. |
| 2 | **Sidebar + shell admin** (header, nav, layout général) | ~180 | 3-4h | 🔴 Critique | Touchant à 100% des pages, à faire une seule fois. Inclure responsive drawer mobile. |
| 3 | **Login** (`login.html`) | ~120 | 2h | 🔴 Critique | Page seule, simple, donne le ton brand dès l'entrée. |
| 4 | **Livraisons** (CRUD) | ~350 | 6-8h | 🔴 Critique | CRUD principal, le plus utilisé quotidiennement. Inclut bulk-bar, filters, table responsive. |
| 5 | **Modale Nouvelle/Edit livraison** | ~220 | 3-4h | 🔴 Critique | Formulaire à 24 champs, le composant le plus complexe. À valider avant continuation. |
| 6 | **Charges** | ~250 | 4h | 🟡 Important | Volume comptable significatif, structure proche de Livraisons. |
| 7 | **Carburant** | ~220 | 3-4h | 🟡 Important | Inclut anomalies, OCR helper. |
| 8 | **Entretiens** | ~180 | 3h | 🟡 Important | Plus simple, similaire à Carburant. |
| 9 | **Véhicules** + drawer 360 véhicule + TCO panel | ~280 | 5h | 🟡 Important | Cards + drawer. TCO = panel séparé. |
| 10 | **Équipe / Salariés** + drawer 360 salarié + Note interne | ~260 | 4-5h | 🟡 Important | Hub cards + modale note + génération credentials. |
| 11 | **Planning** (grille + saisie rapide + détail jour) | ~340 | 6-7h | 🟡 Important | Grille 7 jours × N salariés, drag/drop, copier semaine. Complexe mais isolé. |
| 12 | **Alertes** (centre + filtres + drawer rules) | ~280 | 5h | 🟡 Important | Sprint 19/25, structure ad-hoc. |
| 13 | **Clients** + drawer 360 client | ~220 | 4h | 🟢 Standard | Pattern hub similaire à Équipe. |
| 14 | **Fournisseurs** + drawer 360 | ~200 | 3h | 🟢 Standard | Quasi-clone Clients. |
| 15 | **Rentabilité** | ~260 | 4h | 🟢 Standard | KPIs + charts + simulateur. |
| 16 | **Stats / Prévisions** | ~200 | 3h | 🟢 Standard | Très proche de Rentabilité. |
| 17 | **Calendrier** (vue mois + filtres) | ~180 | 3h | 🟢 Standard | Grille calendrier réutilisable. |
| 18 | **Paramètres** (multi-sections) | ~320 | 5-6h | 🟢 Standard | Long mais répétitif. À découper en sous-sections. |
| 19 | **Setup wizard** (4 étapes) | ~280 | 5h | 🟢 Standard | Onboarding, pas critique post-install. |
| 20 | **Mobile (`m.html`)** | ~220 | 4h | 🟡 Important | Refonte UI mobile distincte. |
| 21 | **Chauffeur (`salarie.html`)** | ~280 | 5h | 🟡 Important | App chauffeur, distincte. |
| 22 | **Bug report / Help** | ~120 | 2h | 🟢 Standard | Petites pages tertiaires. |
| 23 | **Empty states + Loading + Erreurs** | ~200 (cumulé) | 3h | 🔴 Critique | À insérer dès Dashboard, pour éviter retours. |
| 24 | **Toasts (4 variantes)** | ~80 | 1h | 🔴 Critique | Système notification globale, à faire avec Sidebar. |

**Total estimé :** ~5300 LOC, ~85-100h de refonte HTML pure.

## Jalons recommandés

### Jalon 1 — Fondations (≈ 12-15h)

Items #1, #2, #3, #23, #24. **Livrable :** login + dashboard fonctionnels avec sidebar finale, toasts et empty/loading states cohérents. Si ça passe, le reste est de la duplication de pattern.

### Jalon 2 — CRUD principal (≈ 18-20h)

Items #4, #5, #6, #7, #8. **Livrable :** Livraisons + Charges + Carburant + Entretiens migrés. Couvre 80% de l'usage quotidien.

### Jalon 3 — Hubs entité (≈ 16-18h)

Items #9, #10, #13, #14. Véhicules / Équipe / Clients / Fournisseurs avec drawers 360.

### Jalon 4 — Vues secondaires (≈ 18-22h)

Items #11, #12, #15, #16, #17, #18.

### Jalon 5 — Mobile + extras (≈ 12-15h)

Items #19, #20, #21, #22.

## Règles de validation par page

Avant merge d'une page :
1. Tous les IDs/data-* de `02-ids-data-attrs.md` présents (grep automatique recommandé en CI).
2. `npm test` vert — en particulier `tests/code-quality-no-collisions.test.js`, `tests/dashboard-kpis-parite.test.js`, et les e2e Playwright `02-admin-pages.spec.js`, `06-admin-onglets-smoke.spec.js`.
3. Audit visuel : screenshot diff vs mockup, tolérance ±3px.
4. Accessibilité : `tests/e2e/10-a11y-baseline.spec.js` doit passer.
5. Checklist de `10-checklist-qa.md` cochée dans la PR.

## Anti-patterns à éviter

- ❌ Migrer plusieurs pages en parallèle sur la même PR (impossible à reviewer)
- ❌ Renommer un ID "parce que le nom mockup est plus joli"
- ❌ Réécrire une fonction JS pour s'adapter à un nouveau markup (= explosion du scope)
- ❌ Skip les tests "parce que ça compile"
- ❌ Ajouter des features pendant la refonte (uniquement HTML/CSS)
