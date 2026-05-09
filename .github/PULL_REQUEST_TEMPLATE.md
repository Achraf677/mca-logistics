<!--
Template PR — MCA Logistics. Garde-fou anti-régression.
Décocher les cases qui ne s'appliquent pas, ne pas les supprimer.
-->

## Résumé

<!-- 1-2 phrases : quoi + pourquoi -->

## Type

- [ ] feat (nouvelle fonctionnalité)
- [ ] fix (correction de bug)
- [ ] refactor (sans changement de comportement)
- [ ] chore (build, deps, doc)
- [ ] perf (optimisation)

## Checklist parité PC ↔ mobile

> Règle CLAUDE.md : toute fonctionnalité ajoutée/modifiée côté mobile doit être livrée côté PC, et inversement.

- [ ] Touche PC uniquement → justification ci-dessous (ex: feature admin pure, refonte interface PC)
- [ ] Touche mobile uniquement → justification ci-dessous (ex: parité PC déjà existante)
- [ ] Touche les deux → cohérence vérifiée (UX, calculs, libellés)
- [ ] N/A (refacto core, doc, infra)

**Justification si delta** :

## Cache busting

- [ ] `CACHE_VERSION` bumpé dans `sw.js` (un seul endroit)
- [ ] `?v=NN` bumpé dans `admin.html` / `m.html` / `salarie.html` / `login.html` pour les fichiers modifiés
- [ ] N/A (changement back-only ou doc)

## Tests

- [ ] Tests unitaires ajoutés/mis à jour (`tests/*.test.js`)
- [ ] `node --test tests/` passe en local
- [ ] Tests Playwright E2E mis à jour si UI critique
- [ ] N/A (justifier ci-dessous)

## Sécurité

- [ ] Pas de secret en clair dans le diff
- [ ] RLS ajoutée si nouvelle table Supabase
- [ ] Audit log déclenché si écriture admin (trigger `audit_log_trigger()`)
- [ ] Storage privé + signed URLs si nouveau bucket
- [ ] N/A

## Validation visuelle (obligatoire si UI)

- [ ] Testé en local sur Chrome desktop ≥ 1280×720
- [ ] Testé en local sur émulation mobile 375×812
- [ ] Pas de chevauchement bouton / FAB / nav (z-index doc dans `style.css` lignes 1-30)
- [ ] Focus visible sur tous boutons interactifs
- [ ] Aucun bouton icon-only sans `aria-label`
- [ ] N/A (PR back-only)

## Plan de test pour le reviewer

<!-- Liste des étapes manuelles pour valider en condition réelle.
     Exemple :
     1. Login admin
     2. Aller sur Encaissement → cliquer "Marquer payé" sur la première ligne
     3. Vérifier que le KPI "Encaissé ce mois" se met à jour
-->

1.
2.
3.

## Risques connus

<!-- Régressions possibles, edge cases non couverts, feature flags -->

## Liens

- Issue : #
- Doc : `docs/`
