# Bugs ouverts — MCA Logistics refonte

> Tracker live. À mettre à jour à CHAQUE commit qui résout/ouvre un bug.
> Statuts : **NEW** → **IN_PROGRESS** → **FIXED** → **VERIFIED** (par user)
>
> Format ID : `BUG-XXX` numéroté chronologique.

---

## 🔴 NEW (à traiter)

### BUG-001 — Section titles tronqués dans modal Nouvelle livraison
- **Page** : Livraisons
- **Symptôme** : "Informations générales" → "énérales" / "Prix & TVA" → "`TVA"
- **Severity** : HIGH (visible)
- **Reporter** : user 2026-05-11
- **Cause suspectée** : interaction `.fp-section::before` (gradient bar) + `.fp-section-title` display:flex. Overflow ou position absolute crop le texte.
- **Fix proposé** : `.fp-section-title { padding-left: 0 !important; text-indent: 0 !important; overflow: visible !important; }` + investiguer parent overflow.
- **Test** : ouvrir modal "+ Nouvelle livraison" → vérifier 4 titres entiers ("Informations générales", "Prix & TVA", "Affectation", "Lettre de voiture").

### BUG-002 — "Client est requis" affiché à l'ouverture sans interaction
- **Page** : Livraisons (modal Nouvelle livraison)
- **Symptôme** : message rouge "⚠️ Client est requis" visible AVANT toute saisie.
- **Severity** : MEDIUM (UX gênant)
- **Reporter** : user 2026-05-11
- **Cause trouvée** : 2 systèmes de validation parallèles (`fp-invalid` form-progress + `field-invalid` field-rules). `reset()` au modal open clear `fp-invalid` mais PAS `field-invalid` ni les error slots. Si user avait submitted avant et réouvert, les erreurs persistaient.
- **Status** : FIXED (commit à venir)
- **Fix** : étendu `reset()` dans `script.js` ligne 14046 pour clear aussi `field-invalid` + error slots.
- **Test** : ouvrir modal → aucun message → submit vide → erreurs apparaissent → fermer → réouvrir → erreurs disparues.

### BUG-003 — Icône calendrier déborde sous la modal
- **Page** : Livraisons (modal Nouvelle livraison)
- **Symptôme** : icône native date picker visible en bas de la modal.
- **Severity** : LOW (cosmétique)
- **Reporter** : user 2026-05-11
- **Fix proposé** : `.modal-body { overflow: hidden }` + repositionner picker.
- **Test** : ouvrir modal → aucune icône hors limites.

### BUG-004 — Modal "Modifier la livraison" incomplète vs "Nouvelle"
- **Page** : Livraisons
- **Symptôme** : champs manquants dans Modifier (pas de Statut, Heure début, Notes, Départ/Arrivée séparés).
- **Severity** : HIGH (fonctionnel)
- **Reporter** : user 2026-05-11
- **Cause** : 2 modals séparées (modal-livraison ligne 2828 + modal-edit-livraison ligne 3662).
- **Fix proposé** : extraire les champs dans un partial `partials/livraison-form-fields.html` injecté dans les 2 modals → source de vérité unique.
- **Test** : ouvrir une livraison existante via "Modifier" → tous les champs présents en création le sont en édition.

### BUG-005 — Génération facture depuis dropdown ne déclenche pas le PDF
- **Page** : Livraisons (dropdown Générer)
- **Symptôme** : clic "Facture" → rien ne se passe (aucun téléchargement).
- **Severity** : HIGH (fonctionnel)
- **Reporter** : user 2026-05-11
- **Cause** : `actionGenererLivraison('facture')` appelle `window.genererFactureLivraison(livId)` mais cette fonction legacy a peut-être des deps non chargées (jsPDF) ou besoin de contexte.
- **Fix proposé** : (1) vérifier que `genererFactureLivraison` peut être appelée standalone, (2) charger contexte (jsPDF lazy) si manquant, (3) loguer erreurs.
- **Test** : sélectionner 1 livraison → Générer → Facture → vérifier PDF téléchargé.

---

## 🟡 IN_PROGRESS

_(vide pour l'instant)_

---

## ✅ FIXED (à vérifier par user)

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

---

## ✔️ VERIFIED

_(vide pour l'instant — user à valider)_

---

## 📊 Stats

| Statut | Count |
|---|---|
| NEW | 5 |
| IN_PROGRESS | 0 |
| FIXED (à vérifier) | 7 |
| VERIFIED | 0 |
| **Total** | **12** |
