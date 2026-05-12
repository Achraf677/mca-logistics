# Bugs ouverts — MCA Logistics refonte

> Tracker live. À mettre à jour à CHAQUE commit qui résout/ouvre un bug.
> Statuts : **NEW** → **IN_PROGRESS** → **FIXED** → **VERIFIED** (par user)
>
> Format ID : `BUG-XXX` numéroté chronologique.

---

## 🔴 NEW (à traiter)




---

## 🟡 IN_PROGRESS

_(vide pour l'instant)_

---

## ✅ FIXED (à vérifier par user)

### BUG-023 — Inspections : rendu cards-photo-grid au lieu de table mockup
- **Status** : FIXED Phase 59 (2026-05-12)
- **Fix** : `afficherInspections()` dans `script-inspections.js` refactore pour render `<table class="data-table">` mockup-aligned (Date / Véhicule / Chauffeur / Photos / Défauts / Statut / Actions). Badges statut : Conforme (ok green), Défaut majeur (alert red, ≥3 KO), Défaut mineur (warn yellow, 1-2 KO). Photos count clickable → `voirPhotoAdmin(id, 0)` lightbox. Défauts list tronquée à 2 + "+N".
- **À vérifier** : ouvrir Inspections → tableau compact au lieu de cards. Clic sur "X photos" ouvre la première photo.

### BUG-026 — TVA : tabs Collectée/Déductible (mockup-aligned)
- **Status** : FIXED Phase 59 (2026-05-12)
- **Fix** : nouveau `<nav class="tva-tabs-bar">` avec 2 tabs underline-style + count badges. `script-tva-tabs.js` expose `switchTvaTab(which)` qui toggle display:none/'' sur `#tva-panel-collectee`/`#tva-panel-deductible`. CSS `.tva-tab-btn` underline brand active (style-design-rentabilite-stats.css).
- **À vérifier** : ouvrir TVA → 2 tabs visibles, clic Déductible → cache Collectée. Count badges mis à jour.

### BUG-025 — Brouillons IA : chips Validées/Rejetées/OCR ne filtrent pas la liste
- **Status** : FIXED Phase 58 polish 2026-05-12
- **Cause** : `fetchDrafts()` dans `script-ai-brouillons.js:175` hardcodait `.eq('status', 'pending')`. Les chips `brouillonsChipFilter()` ne changeaient que la classe active, pas le fetch.
- **Fix** :
  - `fetchDrafts(statusFilter)` accepte un paramètre + lit `state.statusFilter` (défaut 'pending'). Cas spécial 'ocr' = `.like('action', 'propose_create_charge%')`.
  - Nouveau `AIBrouillons.setStatusFilter(filter)` qui set state + recharge + re-render.
  - `brouillonsChipFilter(btn)` dans `script-brouillons-counts.js` appelle désormais `setStatusFilter` avec `data-brouillons-statut`.
- **À vérifier** : ouvrir Brouillons IA → cliquer "Validées" → la liste affiche les drafts validés du mois (au lieu de rester sur les pending).

### BUG-024 — Inspections : status filter "Conforme/Défaut mineur/Défaut majeur" pas wiré
- **Status** : FIXED Phase 58 polish 2026-05-12
- **Fix** : `afficherInspections()` dans `script-inspections.js:217` lit `#filtre-insp-statut` et applique heuristique (`'conforme'` exact, `'defaut-majeur'` = ≥3 KO, `'defaut-mineur'` = 1-2 KO). Onchange dropdown ré-appelle `afficherInspections()`.
- **Limite connue** : heuristique sur `pointsKO.length`, pas vraie severite typée. Affiner quand vraie severite ajoutée au data model.
- **À vérifier** : ouvrir Inspections → sélectionner "Défaut majeur" → seules les inspections avec 3+ KO s'affichent.

### BUG-022 — title-row masqué pour Livraisons (régression Phase 46 global hide)
- **Status** : FIXED (session :30 2026-05-12)
- **Cause** : `style-design-section-pattern.css` applique `.title-row { display:none !important }` globalement depuis Phase 46. La page Livraisons affiche pourtant ce titre dans le mockup.
- **Fix** : `style-design-livraisons-refonte.css` — `#page-livraisons .title-row { display: flex !important }` surcharge le hide global.
- **À vérifier** : ouvrir Livraisons → voir "Livraisons N ce mois · N retards à traiter" au-dessus de "Toutes les livraisons".

### BUG-021 — Driver avatars rouge au lieu de gris (Livraisons)
- **Status** : FIXED (session :30 2026-05-12)
- **Cause** : `.livraisons-table .driver-av` avait `background: var(--ds-brand)` (rouge). Le mockup montre de petits ronds gris (bg-card-hover + text-muted + border).
- **Fix** : `style-design-livraisons-refonte.css` — avatars 24px, gray bg, text-muted, border-strong.
- **À vérifier** : table livraisons → tous les avatars chauffeur sont gris.

### BUG-020 / BUG-019 — period-row (Tableau/Kanban/Calendrier) masqué
- **Status** : FIXED (sessions autonome + :30 2026-05-12)
- **Cause** : `#page-livraisons > .period-row { display: none }` depuis Phase 32.
- **Fix** : `display: flex` sur `#page-livraisons > .period-row`.
- **À vérifier** : Livraisons → "Tableau | Kanban | Calendrier" + "Jour | Semaine | Mois | Année" visibles.

### BUG-watchdog — [watchdog] afficherDashboard manquante (fausse alerte console)
- **Status** : FIXED (session autonome 2026-05-12)
- **Fix** : retrait de `afficherDashboard` de ADMIN_REQUIRED dans `watchdog.js`.
- **À vérifier** : ouvrir admin.html → console → pas de `[watchdog] MANQUANTES : afficherDashboard`.

### BUG-014 — Modal-livraison invisible quand openModal() appelé depuis Playwright
- **Status** : FIXED (session :16 + :30 2026-05-12)
- **Cause** : `page.evaluate(() => openModal('modal-livraison'))` appelé avant que le modal soit dans le DOM / avant que `openModal` pointe la bonne fonction.
- **Fix** : `tools/audit-fill-form.mjs` utilise désormais `btnNouv.click()` avec fallback `evaluate`. `tools/audit-livraisons-full.mjs` appelle `toggleLivraisonsFilters()` avant de tester `#filtre-recherche-liv` (barre collapsée par design CSS `.expanded`).
- **À vérifier** : rerun `tools/audit-fill-form.mjs` → screenshot 02 montre modal visible.

### BUG-006b — Arrivée toujours vide à la création (régression BUG-006)
- **Status** : FIXED (session :30 2026-05-12)
- **Cause** : `ajouterLivraison()` dans `script-livraisons.js:149` avait `const arrivee = ''` hardcodé. Le champ `#liv-arrivee` rendu visible en phase 32 mais valeur jamais lue.
- **Fix** : `const arrivee = document.getElementById('liv-arrivee')?.value.trim() || ''` + `const depart = document.getElementById('liv-depart')?.value.trim() || zoneGeo`.
- **À vérifier** : créer livraison avec Départ "Paris" Arrivée "Lyon" → save → drawer 360 → Arrivée = "Lyon".

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

### BUG-016 — View-toggle active class sur boutons cachés
- **Status** : FIXED (commit `9e88622`)
- **Découverte** : analyse statique — `changerVueLivraisons()` dans `script-livraisons.js` utilise `getElementById('btn-vue-X')` pour appliquer la classe `active`. Les IDs étaient sur les boutons cachés (`display:none !important` dans section-head), jamais sur les boutons visibles du `period-row`. Clic Kanban/Calendrier → vue change mais aucun bouton ne s'allume.
- **Fix** : déplacement des IDs `btn-vue-{tableau,kanban,calendrier}` des boutons cachés vers les boutons period-row visibles (admin.html lignes 680/684/688).
- **À vérifier** : cliquer Kanban → bouton "Kanban" s'allume ; Tableau → "Tableau" s'allume.

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

### BUG-019 — FAB chat recouvre le bouton "Modifier" du drawer footer
- **Status** : FIXED (session :30 2026-05-12)
- **Cause** : `#ai-chat-fab` est `position:fixed; bottom:20px; right:20px; width:56px`. Quand le drawer 360 livraison est ouvert (560px depuis la droite), le bouton "Modifier" (x=1335–1424) chevauche horizontalement et verticalement le FAB (x=1364–1420, y=824–880).
- **Fix** : `style-design-livraisons-drawer.css` — `body:has(#dr-liv-panel.open) #ai-chat-fab { bottom: 80px }` lève le FAB au-dessus de la zone footer pendant que le drawer est ouvert.
- **À vérifier** : ouvrir drawer 360 livraison → bouton "Modifier" pleinement visible, aucun chevauchement FAB.

### BUG-018 — Champ CLIENT affiche ring rouge à l'ouverture de modal (avant toute frappe)
- **Status** : FIXED (session :30 2026-05-12)
- **Cause** : `openModal()` dans `script-core-ui.js` auto-focus le premier champ focusable (CLIENT) via `target.focus()`. La règle CSS `:focus` applique `border-color: var(--brand)` + `box-shadow` immédiatement. `:focus:not(:focus-visible)` inefficace — Chrome headless considère `focus()` programmatique comme `:focus-visible: true`.
- **Fix** :
  - `script-core-ui.js` : ajout classe `modal-just-opened` sur l'overlay à l'ouverture, retirée au 1er keydown/pointerdown user.
  - `style-design-modals-refine.css` : règle `.modal-just-opened .modal-body input:focus` supprime `outline`, `border-color` et `box-shadow` pendant cette fenêtre.
- **À vérifier** : ouvrir modal "+ Nouvelle livraison" → champ CLIENT a bordure normale (gris) → taper → bordure rouge apparaît → fermer/réouvrir → reprend gris.

### BUG-017 — Titres de section tronqués dans modal-body (pill border-radius)
- **Status** : FIXED (session :30 2026-05-12)
- **Cause** : `script.js` ligne ~9127 set `body.dataset.s11Progress = '1'` sur `.modal-body` comme flag d'init. CSS dans `style-design-parametres.css` applique `[data-s11-progress] { border-radius: 9999px; overflow: hidden }` — créant un clip pill qui masque le début des titres.
- **Fix** : `style-design-modals-refine.css` — `.modal-body { border-radius: 0 !important }` pour annuler le pill de parametres.css.
- **À vérifier** : ouvrir modal "+ Nouvelle livraison" → 4 titres entiers visibles : "Informations générales", "Prix & TVA", "Affectation", "Lettre de voiture".

### BUG-001 — Section titles tronqués dans modal Nouvelle livraison
- **Status** : FIXED (commit `d036955`)
- **À vérifier** : ouvrir modal "+ Nouvelle livraison" → vérifier 4 titres entiers.

### BUG-002 — "Client est requis" affiché à l'ouverture sans interaction
- **Status** : FIXED (commit `9876fc6`)
- **À vérifier** : ouvrir modal → aucun message → submit vide → erreurs apparaissent → fermer → réouvrir → erreurs disparues.

### BUG-003 — Icône calendrier déborde sous la modal
- **Status** : FIXED (commit `d036955`)
- **À vérifier** : ouvrir modal → aucune icône hors limites.

### BUG-014 — Modal-livraison invisible quand openModal() appelé depuis Playwright
- **Status** : FIXED (tooling seulement — pas un bug prod)
- **Cause réelle** : `window.openModal('modal-livraison')` via `page.evaluate()` bloqué par setup wizard intercept. L'utilisateur cliquant sur le bouton natif → modal s'ouvre normalement.
- **Fix** : `tools/audit-fill-form.mjs` — utilise maintenant `page.locator('button:has-text("Nouvelle livraison")').click()` avec fallback `evaluate`.
- **Confirmé** : audit direct via `[data-livraisons-statut="brouillon"]` → filtre='brouillon' ✓, `modal-charge` s'ouvre ✓.

---

## ✔️ VERIFIED

_(vide pour l'instant — user à valider)_

---

## 📊 Stats

| Statut | Count |
|---|---|
| NEW | 0 |
| IN_PROGRESS | 0 |
| FIXED (à vérifier) | 24 |
| VERIFIED | 0 |
| **Total** | **24** |
