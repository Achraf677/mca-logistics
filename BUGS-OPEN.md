# Bugs ouverts — MCA Logistics refonte

> Tracker live. À mettre à jour à CHAQUE commit qui résout/ouvre un bug.
> Statuts : **NEW** → **IN_PROGRESS** → **FIXED** → **VERIFIED** (par user)
>
> Format ID : `BUG-XXX` numéroté chronologique.

---

## 🔴 NEW (à traiter)

### BUG-014 — Modal-livraison invisible quand openModal() appelé depuis Playwright
- **Page** : Livraisons (audit Playwright)
- **Symptôme** : `window.openModal('modal-livraison')` appelé après nav vers Livraisons → screenshot 02 montre Dashboard layout, pas le modal. Champ `#liv-client` reste détaché ou invisible 30s → Playwright timeout.
- **Severity** : MEDIUM (bloque l'audit automatisé, pas la prod utilisateur — l'utilisateur clique sur "+ Nouvelle livraison" qui marche)
- **Reporter** : audit Claude 2026-05-12
- **Cause suspectée** : (1) `openModal` est défini ailleurs et navigue, (2) le modal est dans un partial lazy-loaded, (3) `MCASetup.later()` n'a pas fini, (4) display:none persistant.
- **Fix proposé** : utiliser `page.locator('button:has-text("+ Nouvelle livraison")').click()` au lieu de `evaluate(openModal)` dans `tools/audit-fill-form.mjs`.
- **Test** : rerun `tools/audit-fill-form.mjs` après fix → modal visible dans screenshot 02 → fill réussit.

---

## 🟡 IN_PROGRESS

_(vide pour l'instant)_

---

## ✅ FIXED (à vérifier par user)

### BUG-013 — Toast "Le nom de l'entreprise est requis" affiché au load page Livraisons
- **Status** : FIXED (commit session :15 2026-05-12)
- **Cause réelle** : `later()` dans `script-setup-wizard.js` appelait `readStep1()` qui affiche le toast si `setup-nom` est vide, même sans interaction user. Extrait en `saveStep1Draft()` qui lit sans valider.
- **Fix** : ajout de `saveStep1Draft()` dans `script-setup-wizard.js`, utilisé dans `later()` et `prev()` à la place de `readStep1()`.
- **À vérifier** : `?reset=1` → nav vers Livraisons → aucun toast rouge visible.

### BUG-004 — Modal "Modifier la livraison" incomplète vs "Nouvelle"
- **Status** : FIXED (commit session :15 2026-05-12)
- **Cause** : `edit-liv-depart` et `edit-liv-arrivee` étaient des `type="hidden"`, pas de champ `edit-liv-heure-debut`, `confirmerEditLivraison()` écrasait `arrivee = ''` systématiquement.
- **Fix** :
  - `admin.html` : hidden → visible inputs pour Départ/Arrivée, ajout champ Heure début, suppression `edit-liv-zone` (fusionné redondant).
  - `script-livraisons.js` : `confirmerEditLivraison()` lit depart/arrivee séparément + sauve `heureDebut`. `ouvrirEditLivraison()` peuple `edit-liv-heure-debut` + code zone mort retiré.
- **À vérifier** : ouvrir une livraison existante → "Modifier" → Départ + Arrivée visibles et pré-remplis → Heure début visible → sauvegarder → rouvrir → données persistées.

### BUG-006 — Trajet arrivée non saisie (champ hidden)
- **Status** : FIXED Phase 32 (commit `935fe0f`)
- **Fix** : `liv-arrivee` passé de `type=hidden` → input visible avec label "Arrivée *"
- **À vérifier** : créer nouvelle livraison avec Départ + Arrivée → save → ouvrir drawer 360 → champs présents.

### BUG-007 — Statut col affiche "I" + chevron au lieu de pill colored
- **Status** : FIXED Phase 33 (commit `8b1fd99`)
- **Fix** : CSS targette `.is-success / .is-info / .is-warn / .is-danger` (classes legacy) en plus de `.is-ok / .is-err`. Hard reload requis.
- **À vérifier** : reload `?reseed=1` → table livraisons → statut col affiche pill colored (vert "Livré", bleu "En cours", jaune "Attente", rouge "Retard", gris "Brouillon").

### BUG-008 — Driver avatar couleurs incohérentes avec mockup
- **Status** : FIXED Phase 33 (commit `8b1fd99`)
- **Fix** : avatars uniformes brand red (au lieu de 6 couleurs hash).
- **À vérifier** : table livraisons → tous les avatars chauffeur en rouge.

### BUG-009 — Bouton "Modifier" ouvrait drawer au lieu de modal edit
- **Status** : FIXED Phase 33 (commit `8b1fd99`)
- **Fix** : `ouvrirBulkEditLivraisons` priorise `window.ouvrirEditLivraison` (modal edit).
- **À vérifier** : sélectionner 1 row → cliquer Modifier (1) → modal "Modifier la livraison" s'ouvre.

### BUG-010 — Bulk-action-bar floating cachée par chat bot FAB
- **Status** : FIXED Phase 33 (commit `8b1fd99`)
- **Fix** : `#bulk-action-bar { display: none !important }`. Remplacée fonctionnellement par bouton Modifier(N) en section-head.

### BUG-011 — Bouton "Mo..." tronqué dans drawer footer
- **Status** : FIXED Phase 33 (commit `8b1fd99`)
- **Fix** : drawer width 560px + flex-wrap footer.

### BUG-012 — Dropdowns Générer/Exporter 3 items au lieu de 4
- **Status** : FIXED Phase 32 (commit `935fe0f`)
- **Fix** :
  - Générer : Facture / Bon de livraison / Lettre de voiture / Facture groupée (4)
  - Exporter : PDF / CSV / Excel / Facture groupée (4)

### BUG-015 — Chip "Brouillons" ne filtre pas la table (select manquant)
- **Status** : FIXED (ce commit)
- **Découverte** : analyse statique — `appliquerChipLivraisons` dans `script-livraisons-chips.js` n'incluait pas `'brouillon'` dans le tableau `supported[]`, donc le clic chip tombait dans le fallback retard (reset select) sans filtrer. De plus `#filtre-statut` n'avait pas d'`<option value="brouillon">`.
- **Fix** :
  - `script-livraisons-chips.js` : ajout `'brouillon'` dans `supported[]` (BUG-015 fix)
  - `admin.html` : ajout `<option value="brouillon">Brouillon</option>` dans `#filtre-statut`
  - `admin.html` : `script-livraisons-chips.js?v=1` → `?v=2` (cache busting)
- **À vérifier** : section Livraisons → cliquer chip "Brouillons" → table affiche uniquement les livraisons en statut brouillon.

### BUG-005 — Génération facture depuis dropdown ne déclenche pas le PDF
- **Status** : FIXED partiel (ce commit)
- **Fix** : try/catch wrapper sur `actionGenererLivraison` dans `script-livraisons-polish.js` — toute exception JS est maintenant visible (toast + `console.error` + Sentry). Wrapper hors IIFE principale, s'applique après chargement.
- **Note** : si "rien ne se passe" persiste malgré le wrapper, la cause est probablement le check SIRET absent qui redirecte vers Paramètres sans toast visible (comportement intentionnel).
- **À vérifier** : (1) sans SIRET → toast "Renseigne un SIRET" ou redirect Paramètres ; (2) avec SIRET valide → popup impression ou toast d'erreur explicite.

### BUG-001 — Section titles tronqués dans modal Nouvelle livraison
- **Status** : FIXED (commit `d036955`)
- **À vérifier** : ouvrir modal "+ Nouvelle livraison" → vérifier 4 titres entiers.

### BUG-002 — "Client est requis" affiché à l'ouverture sans interaction
- **Status** : FIXED (commit `9876fc6`)
- **À vérifier** : ouvrir modal → aucun message → submit vide → erreurs apparaissent → fermer → réouvrir → erreurs disparues.

### BUG-003 — Icône calendrier déborde sous la modal
- **Status** : FIXED (commit `d036955`)
- **À vérifier** : ouvrir modal → aucune icône hors limites.

---

## ✔️ VERIFIED

_(vide pour l'instant — user à valider)_

---

## 📊 Stats

| Statut | Count |
|---|---|
| NEW | 1 |
| IN_PROGRESS | 0 |
| FIXED (à vérifier) | 14 |
| VERIFIED | 0 |
| **Total** | **15** |
