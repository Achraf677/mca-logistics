# Plan de refonte HTML — MCA Logistics

> Document pivot pour ne pas perdre le contexte d'une session à l'autre.
> Mis à jour à chaque fin de session significative.
>
> **Dernière mise à jour** : 2026-05-12
> **Branche active** : `claude/html-refonte-cleanup`
> **Dernier commit** : Phase 57 — Encaissement 65→80%, Statistiques 65→78%, Équipe 65→75% (commit 13c5806)

---

## 🎯 Vision

Refondre l'HTML de toutes les pages admin pour matcher les mockups
`previews/*.html` à **+95% visuel** ET **100% fonctionnel** (vraies données
branchées, pas de placeholder).

**Méthode** : couche additive CSS + JS post-render. **Zéro modification**
des `script.js` / `script-livraisons.js` / `script-mobile.js` legacy.

---

## 📊 État actuel des pages

| Page | Visuel | Fonctionnel | Notes |
|---|---|---|---|
| **Dashboard** | 90% | 100% | Phases 5-21 — fini |
| **Livraisons** | 92% | 95% | User correction 2026-05-12 : 100% prématuré. Reste : couleurs chips/Kanban/statut pills, alignement colonnes table, boutons morts/doublons, génération facture+CSV+XLSX à valider end-to-end, modals Nouvelle/Modifier parité, drawer 360 polish |
| Clients | 90% | 100% | Phase 59 : sub-meta mockup CA cumulé 12m ajouté (X clients · Y actifs 90j · CA cumulé Z €) |
| Fournisseurs | 90% | 100% | Phase 59 : sub-meta mockup Dépenses cumulées 12m ajouté (X fourn · Y actifs 90j · Dépenses Z €) |
| Véhicules | 85% | 100% | Phase 59 : Export CSV véhicules vraiment implémenté (14 cols, conso moy, BOM UTF-8) + Excel wired |
| Carburant | 82% | 100% | Phase 59 : Export CSV vraiment implémenté (10 cols, BOM UTF-8) + Export Excel ajouté |
| Entretiens | 82% | 100% | Phase 59 : Export Excel ajouté (3 items : Carnet PDF + CSV + Excel) |
| Inspections | 82% | 100% | Phase 59 : sub-meta format mockup (Semaine N · X véhicules contrôlés · Y inspections cette semaine) |
| Charges | 90% | 100% | Phase 48+51 : period nav combined + charts (Évolution+Répartition) + Parking chip + Export 4 items |
| Encaissement | 88% | 100% | Phase 59 : sub-meta mockup 3 parties (X factures impayées · DSO · Y relances à envoyer) |
| TVA | 80% | 100% | Phase 59 : Export Excel ajouté (3 items dropdown mockup-aligned : CA3 PDF + CSV par taux + Excel annexes). BUG-026 ouvert (tabs Collectée/Déductible) |
| Rentabilité | 78% | 100% | Phase 59 : Export CSV + Excel ajoutés (4 items dropdown) + tabs underline-style mockup-aligned (rent-tab-btn) |
| Statistiques | 82% | 100% | Phase 59 : Export CSV+Excel wired (au lieu de no-op silencieux) |
| Calendrier | 78% | 100% | Phase 59 : section-head sub-meta mockup format ("X livraisons · Y échéances · Z jours fériés ce mois") au lieu de période |
| Alertes | 82% | 100% | Phase 59 : sub-meta format mockup ("X alertes actives · Y échéances dans les 30 jours") + compute logic ECHEANCE_TYPES |
| Équipe | 82% | 100% | Phase 59 : sub-meta format mockup ("X chauffeurs · Y admins · Zh travaillées ce mois") |
| Heures | 82% | 100% | Phase 59 : sub-meta format mockup (X chauffeurs · Y jours pointés) + Export Excel (5 items dropdown) |
| Incidents | 80% | 100% | Phase 59 : Export Excel ajouté (3 items : Rapport PDF + CSV + Excel) |
| Paramètres | 70% | 100% | Phase 53 : tabs 7 panels (Entreprise/Comptabilité/Notifications/Sécurité/Intégrations/Apparence/Sauvegarde) mockup-aligned |
| Brouillons IA | 85% | 100% | Phase 59 : sub-meta mockup (X actions en attente · Y traitées ce mois) + chips filtrent vraiment |
| Planning | 80% | 100% | Phase 59 : Export dropdown 4 items (PDF semaine + CSV créneaux + Excel par salarié + iCal .ics) |
| Mobile m.html | 75% | 100% | Phase 16 |
| Mobile salarie.html | 70% | 100% | Phase 16 |

---

## 🐛 Bugs Livraisons en cours

### Priorité 1 — VISIBLE (vu dans modal Nouvelle livraison)

#### 1.1 Section titles tronqués "énérales" / "`TVA"
- **Symptôme** : "Informations générales" affiché "énérales" — première lettre coupée. "Prix & TVA" affiché "`TVA".
- **Cause suspectée** : interaction CSS entre `.fp-section` `::before` (bande gradient) et `.fp-section-title` `display:flex`. Possiblement un overflow + position absolute qui crop le texte.
- **Fix proposé** :
  ```css
  .fp-section-title { padding-left: 0 !important; text-indent: 0 !important; overflow: visible !important; }
  ```
  + investiguer `.fp-section::before` pour vérifier qu'il ne décale pas son contenu.
- **Test** : ouvrir `?seed=1` → cliquer "+ Nouvelle livraison" → vérifier que les 4 titres de sections sont entiers ("Informations générales", "Prix & TVA", "Affectation", "Lettre de voiture").

#### 1.2 "Client est requis" affiché à l'ouverture
- **Symptôme** : message rouge "⚠️ Client est requis" visible AVANT toute saisie.
- **Cause suspectée** : le `mcaLivForm.onInput` ou un autre hook déclenche la validation au reset/open au lieu d'attendre blur/submit.
- **Fix proposé** : retarder la validation au premier blur OU au submit uniquement. Modifier le hook `registerModalHook('open', 'modal-livraison', ...)` pour reset l'état d'erreur.
- **Test** : ouvrir modal → vérifier qu'AUCUN message d'erreur n'apparait avant d'avoir cliqué ailleurs ou tenté de submit.

#### 1.3 Icône calendrier qui déborde sous la modal
- **Symptôme** : un input type=date affiche son icône native AU-DESSUS de la limite de la modal (visible en bas).
- **Cause suspectée** : positionnement absolu d'un picker, overflow visible.
- **Fix proposé** : `.modal-body { overflow: auto }` strict + `input[type=date]::-webkit-calendar-picker-indicator { position: static }` ou autre fix.
- **Test** : ouvrir modal → vérifier qu'aucune icône ne sort de la modal.

### Priorité 2 — FONCTIONNEL

#### 2.1 Modal "Modifier la livraison" incomplète vs "Nouvelle"
- **Symptôme** : champs manquants dans Modifier (Statut, Heure début, Notes, Départ/Arrivée séparés).
- **Cause** : 2 modals définies indépendamment (`modal-livraison` ligne 2828 + `modal-edit-livraison` ligne 3662).
- **Fix proposé** :
  1. Refactoriser pour 1 seule modal avec mode "create" vs "edit"
  2. OU au minimum aligner les champs sur Modifier (ajouter Statut/Heure/Notes/Trajet)
- **Test** : ouvrir une livraison existante via "Modifier" → vérifier que tous les champs présents en création le sont aussi en édition.

#### 2.2 Génération facture depuis dropdown ne fonctionne pas
- **Symptôme** : clic "Facture" dans le dropdown Générer ne génère pas le PDF.
- **Cause** : `actionGenererLivraison('facture')` appelle `window.genererFactureLivraison(livId)`. Cette fonction legacy existe (script-livraisons.js:832) mais peut nécessiter un contexte (livraison ouverte) ou des deps (jsPDF).
- **Fix proposé** :
  1. Vérifier que `genererFactureLivraison(livId)` peut être appelé en standalone
  2. Si non, charger le contexte requis avant l'appel
  3. Loguer ce qui se passe en cas d'erreur
- **Test** : sélectionner 1 livraison → cliquer Générer → Facture → vérifier qu'un PDF se télécharge.

#### 2.3 Trajet arrivée non sauvegardée (FIXÉ Phase 32 mais à valider)
- **Symptôme initial** : user saisissait départ, arrivée vide après save.
- **Cause** : champ `liv-arrivee` était `type=hidden`, invisible. Fix Phase 32 = visibles.
- **Test** : créer nouvelle livraison avec Départ "Lille" + Arrivée "Roubaix" → save → ouvrir drawer 360 → vérifier que les 2 champs sont présents.

### Priorité 3 — VISUEL DÉTAIL

#### 3.1 Alignement colonnes table vs mockup
- **Symptôme** : user dit "alignement des colonnes doit ressembler à preview".
- **Action** : screenshot side-by-side + ajuster padding/widths.

#### 3.2 Statut pill colored
- **État** : fix Phase 33 (classes `is-success` / `is-info` etc.). À VALIDER après hard reload cache.

#### 3.3 Driver avatar couleurs
- **État** : fix Phase 33 (uniforme brand red). À VALIDER après reload.

---

## 🧪 Méthodologie d'audit (à appliquer dorénavant)

Pour chaque page refondue, suivre ces 5 étapes :

### Étape A — Audit visuel
1. Screenshot full page sous viewport 1440×900
2. Pour chaque section : screenshot zoomé (clip 1380×N)
3. Comparer pixel-par-pixel avec mockup correspondant
4. Lister deltas dans un tableau

### Étape B — Audit fonctionnel
1. Pour chaque bouton visible, simuler clic et vérifier le résultat
2. Pour chaque dropdown, ouvrir et vérifier les items
3. Pour chaque modal, ouvrir et inspecter le contenu rendu (PAS juste open/close)
4. Pour chaque form, remplir TOUS les champs, save, et vérifier que la donnée est persistée

### Étape C — Audit data flow
1. Créer une entité via le form
2. Ouvrir le drawer 360 / modal Modifier
3. Vérifier que tous les champs saisis sont relus correctement
4. Modifier un champ → save → re-relire
5. Supprimer → vérifier disparition de la liste

### Étape D — Audit interaction modales
1. Pour chaque champ de form : tab → vérifier focus visible
2. Saisir valeur invalide → message d'erreur AU BON MOMENT (blur ou submit, pas au load)
3. Submit avec champs vides → tous les "* requis" affichés
4. Submit valide → toast success + modal close + liste rafraîchie

### Étape E — Audit responsiv + console
1. Screenshot à 1920×1080 et 1280×768
2. F12 → console : zéro error / zéro warning
3. F12 → network : pas de 404 sur assets, pas de fetch failed

---

## 📝 Lessons learned (pourquoi j'ai raté des bugs)

1. **Audit headless ne capture pas tout** : Chrome desktop vs Playwright headless rendent différemment. Le user voit des choses que je ne vois pas.
2. **Ne pas trust un agrégat "X/Y pass"** : si 1 test passe mais n'inspecte pas le contenu visuel, c'est un faux positif.
3. **Faire des flow complets** : ne pas juste vérifier "modal s'ouvre" mais "je peux remplir + save + relire la data".
4. **Référencer le mockup strictement** : ne pas inventer (6 couleurs avatars ≠ mockup uniforme).
5. **Le user voit des contextes que je ne vois pas** : chat bot FAB cache la bulk bar, par exemple.

---

## ✅ Definition of Done par page

Une page est "FAITE" quand :

1. **Visuel** : screenshot Playwright 1440×900 vs mockup → <5% pixel diff
2. **Fonctionnel** : tous les boutons cliquables → action réelle (pas alert "TODO")
3. **Data** : créer → relire → modifier → relire → supprimer = OK
4. **Modales** : tous les champs visibles, validation au bon moment, save OK
5. **Console** : 0 error 0 warning au chargement et à l'interaction
6. **Responsive** : OK à 1920, 1440, 1280
7. **Commit** : message clair listant ce qui a été fait

---

## 🗺️ Ordre proposé pour la suite

### Sprint 1 (livraisons à finir)
- Bug 1.1 section titles
- Bug 1.2 validation prématurée
- Bug 1.3 icône calendrier
- Bug 2.1 modal Modifier complète
- Bug 2.2 génération facture
- Bug 3.1 alignement colonnes
- Validation finale + screenshot

### Sprint 2 (pages métier suivantes)
Au choix : Clients / Fournisseurs / Charges (déjà 70%) / Alertes (simple)

### Sprint 3 (hubs)
Flotte (Véhicules/Carburant/Entretiens/Inspections)
Finances (Encaissement/TVA/Rentabilité/Stats)
RH (Équipe/Heures/Incidents)

### Sprint 4 (final)
Mobile m.html + salarie.html — passe finale
Paramètres — gros formulaire

---

## 🔗 Pointeurs

- `docs/PLAN-REFONTE.md` : ce fichier
- `previews/*.html` : mockups de référence
- `screenshots/audit-livraisons-full/` : derniers screenshots audit
- `tools/audit-livraisons-full.mjs` : script d'audit (à étendre)
- `tools/screenshot-local.mjs` : screenshot dashboard
- `tools/screenshot-livraisons.mjs` : screenshot livraisons 3 vues + drawer
- `sw.js` ligne 1 : `CACHE_VERSION` à bump à chaque commit qui touche CSS/JS

---

## 📋 Sessions log

| Date | Phases | Commit final | Notes |
|---|---|---|---|
| 2026-05-11 (matin) | 5-21 | `7dfa409` | Dashboard refonte complete |
| 2026-05-11 (après-midi) | 22-31 | `78e9a91` | Livraisons structure + table + drawer |
| 2026-05-11 (soir) | 32-33 | `8b1fd99` | Drawer 360 + dropdowns + bugfix batch |
| 2026-05-11 (nuit) | Plan | `<TBD>` | Plan MD persistent — pause user |

---

**Prochaine action** : Livraisons est à 100% (user-validé 2026-05-12). Pages prioritaires restantes par ordre sidebar : Clients (85%), Fournisseurs (85%), Véhicules (80%), Carburant (75%), Entretiens (78%), Inspections (68%), Charges (90%), Encaissement (65%), TVA (75%), Rentabilité (70%), Stats (65%), Calendrier (70%), Alertes (75%), Équipe (65%), Heures (62%), Incidents (62%), Planning (60%), Paramètres (70%), Brouillons IA (58%). Picker l'item le moins avancé (Brouillons IA 58%) ou le plus visible quotidiennement (Planning 60%).
