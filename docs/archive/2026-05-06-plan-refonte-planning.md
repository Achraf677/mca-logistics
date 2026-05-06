# Plan — Refonte planning : semaines indépendantes + pattern récurrent

Date : 2026-05-06
Statut : **PROPOSITION** — à valider par Achraf avant implémentation.

## Contexte

Le planning actuel stocke un **pattern hebdomadaire** (`planning.semaine[]`)
qui se répète identiquement à toutes les semaines. Achraf veut :
1. **Semaines indépendantes** : chaque semaine peut avoir des saisies dédiées.
2. **Récurrence facultative par salarié** : pré-remplir automatiquement les
   nouvelles semaines avec un pattern type.
3. **Copier une journée vers une autre** (ou plusieurs).
4. **Copier une semaine complète vers une autre** (ou plusieurs).

## Modèle de données

### Avant

```js
plannings = [
  { salId, semaine: [{ jour:"lundi", typeJour, heureDebut, heureFin }, ...] }
]
```

### Après

```js
plannings = [
  {
    salId: "abc",
    pattern: {
      actif: true,
      semaine: [{ jour:"lundi", typeJour:"travail", heureDebut:"08:00", heureFin:"18:00" }, ...]
    },
    semaines: {
      "2026-05-04": [{ date:"2026-05-04", typeJour:"travail", heureDebut:"08:00", heureFin:"18:00" }, ...],
      "2026-05-11": [{ date:"2026-05-11", typeJour:"travail", heureDebut:"06:00", heureFin:"14:00" }, ...]
    },
    absences: [...]
  }
]
```

### Logique d'affichage

1. Si `semaines["lundi-de-la-semaine-affichée"]` existe → on affiche.
2. Sinon si `pattern.actif` → on applique le pattern (lecture seule, pas écrit
   en base tant que l'utilisateur n'a pas saisi sur cette semaine).
3. Sinon → semaine vide.

## Fonctionnalités UX

### A. Saisie d'un jour
Inchangé visuellement. Mais l'écriture va dans `semaines["lundi-courant"]`
au lieu de `pattern`.

### B. Copier journée → journée(s)
Bouton "⋯" sur l'entête d'un jour, menu :
- Copier vers un autre jour de cette semaine
- Copier vers tous les jours similaires (ex : tous les lundis du mois)

### C. Copier semaine → semaine(s)
Bouton "⋯" sur la barre nav semaine, menu :
- Copier vers semaine suivante
- Copier vers les 4 prochaines semaines
- Copier vers une semaine choisie (sélecteur)

### D. Définir comme récurrence
Bouton dans le menu jour : "Faire de ce jour le pattern récurrent" → ouvre
dialogue de confirmation puis écrit dans `pattern.semaine[<jour>]`.

### E. Page "Planning type" (récurrence par salarié)
Sous-page accessible depuis fiche salarié → édite directement le `pattern`
(vue 7 jours simplifiée). Pour configurer le récurrent en bloc.

## Migration données existantes

Au boot, si `planning.semaine` existe et pas `planning.pattern` :
```js
p.pattern = { actif: true, semaine: p.semaine };
p.semaines = {};
delete p.semaine;
```
Aucune perte de données. Compatible avec le code legacy en lecture pendant la transition.

## Phasing (PR par PR)

| # | Sprint | Effort | Livre |
|---|---|---|---|
| 1 | Migration data + lecture pattern | 2 h | Pattern affiché, comportement identique à aujourd'hui |
| 2 | Saisie indépendante par semaine | 3 h | Modifier un jour ne change que cette semaine |
| 3 | Copier jour → jour | 1 h | Bouton menu sur jour |
| 4 | Copier semaine → semaine(s) | 2 h | Bouton menu sur barre nav |
| 5 | Édition pattern (page dédiée) | 2 h | Formulaire "Planning type" salarié |
| 6 | Synchro PC (parité) | 2-3 h | Mêmes fonctionnalités côté PC |

**Total : ~12-15 h**, réparties.

## Risques

- **Quota Supabase** : 52 semaines × 7 jours = 364 entrées max par salarié/an
  (~50 KB JSON par salarié/an). Reste largement dans les limites.
- **Régression PC** : code PC (`afficherPlanningSemaine`) doit comprendre la
  nouvelle structure. Migrer PC en même temps OU garder lecture compatible.
- **Surcharge UX** : trop de menus "⋯" peut perdre. Tester sur 1-2 chauffeurs
  avant de généraliser.

## Recommandation

Sprint 1 + 5 = 80% de la valeur (4 h de dev). Les copies (3-4) sont utiles
mais secondaires si le pattern fonctionne bien.

**Ordre proposé** : 1 → 5 → 2 → 3 → 4 → 6.

## Décision en attente

À valider :
- [ ] Modèle de données proposé (pattern + semaines + absences)
- [ ] UX des copies (boutons "⋯" vs autre interaction)
- [ ] Ordre de phasing
- [ ] Démarrer par mobile ou PC ?
