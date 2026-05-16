# Livraisons — Backlog gros chantiers (>1 jour chacun)

Audit complété : 19 agents (Sonnet + Opus 4.7), 50+ fixes appliqués (data loss, propagation cross-entity, timezone, edge cases monétaires, a11y, kanban XSS, drawer historique, BL impression, storage cap, KPIs).

Reste 5 chantiers majeurs hors scope "boucler v305" :

---

## 1. Mobile `m.html` — Parité PC Livraisons
**Estimation : 1-2 j**

- [ ] Drawer 360 mobile (sheet fullscreen avec onglets Détail/Documents/Paiement/Historique)
- [ ] Pull-to-refresh (déjà dispo PC `script.js:2845`, à porter `script-mobile.js`)
- [ ] Chips filtre par STATUT (mobile a uniquement chips paiement aujourd'hui)
- [ ] Bouton Export PDF/CSV liste filtrée (utilitaire `script-mobile-exports.js` existe, à câbler)
- [ ] Renommer "En attente" → "Brouillon" (parité Phase 91.24 PC)
- [ ] Drag-drop kanban touch-friendly (actuellement tap seul)
- [ ] Brouillons IA pré-remplis (page admin existe, pas d'intégration `formNouvelleLivraison` mobile)

**Files** : `script-mobile.js:4363-4818`, `m.html`, `script-mobile-exports.js`

---

## 2. Espace chauffeur (`salarie.html`) — Preuve de livraison
**Estimation : 2-3 j — BLOQUANT prod transport**

- [ ] **Signature électronique client** : canvas signature pad + bucket Supabase `livraisons-signatures` + champ `liv.signatureClient` (path)
- [ ] **Photo BL émargé** : upload photo, bucket `livraisons-bl`, champ `liv.photoBL`
- [ ] **GPS tracking** : `navigator.geolocation.watchPosition` au démarrage de tournée, géo-stamp à la livraison (`liv.posLivraison = {lat, lng, ts}`)
- [ ] **Notifications push réelles** : `PushManager` + VAPID + SW handler `push` (actuellement localStorage polling)
- [ ] **Filtre étendu J+1, retards** (actuellement = jour J uniquement)
- [ ] **Détail marchandise/destinataire/ADR** affiché côté chauffeur (manque actuellement)
- [ ] **Signalement incident métier** depuis fiche livraison (refus, retard, casse)
- [ ] **Workflow guidé "Livraison terminée"** : signature → photo → km arrivée → statut=livré → horodatage

**Files** : `salarie.html`, `script-salarie.js:828-947`, `sw.js`, `supabase-storage-sync.js`, nouvelles migrations buckets

---

## 3. Supabase sync — Robustesse multi-device
**Estimation : 1-2 j**

- [ ] **Race condition boot** : si flush en attente quand `pullAll()` arrive → données locales écrasées. Ajouter merge ou flush-before-pull (entity-supabase-adapter.js:220-249)
- [ ] **Conflict resolution** : Last-write-wins silencieux → ajouter `updated_at` versionning + toast warning sur conflit détecté
- [ ] **Retry online côté admin** : `offline-queue.js` est mobile-only. Brancher pour admin (window.addEventListener('online'))
- [ ] **Edit locks réels** : `admin_edit_locks` table existe (migration 042) mais pas intégrée à `ajouterLivraison`/`confirmerEditLivraison`
- [ ] **Sanitize `extra` jsonb** : nettoyer les champs déjà colonnes (évite double stockage, indexation Supabase)

**Files** : `entity-supabase-adapter.js`, `all-entity-adapters.js`, `supabase-storage-sync.js`, `offline-queue.js`

---

## 4. Bulk Edit Modal — N > 1 livraisons
**Estimation : 1 j**

Plan d'implémentation détaillé fourni par agent Opus :

- [ ] Étape 1 : Modal HTML `modal-bulk-edit-livraisons` (admin.html:4883)
- [ ] Étape 2 : `window.bulkEditLivraisons(ids)` (script-livraisons-bulk-edit.js nouveau)
- [ ] Étape 3 : `confirmerBulkEditLivraisons()` avec verifierVerrouEdition par id
- [ ] Étape 4 : Refresh chain (chips/dashboard/rent/drawer/encaissement)
- [ ] Étape 5 : Brancher stub `ouvrirBulkEditLivraisons` (script-livraisons-polish.js:441-470)
- [ ] Étape 6 : `<script defer>` dans admin.html

Champs candidats : statut, statutPaiement, chaufId, vehId, date, modePaiement, tauxTVA (exclus : client, depart/arrivee, prix*, marchandise, exp/dest, notes, adr — spécifiques par livraison)

**Files** : nouveau `script-livraisons-bulk-edit.js`, `admin.html`, `script-livraisons-polish.js`

---

## 5. Migration localStorage → IndexedDB
**Estimation : 1-2 j**

Risque scaling : >100 livraisons × 3 docs HTML capturés = 9-24 MB → dépasse quota 5-10 MB.

- [ ] Étendre `offline-queue.js` (déjà IDB pour photos) pour `livraisons` + `documents_livraison_*`
- [ ] API `charger`/`sauvegarder` (script-core-storage.js) routent IDB pour gros datasets, localStorage pour petits
- [ ] Upload PDF/HTML docs vers Supabase Storage bucket `livraison-docs` au lieu de localStorage
- [ ] Helper `estimerTailleLocalStorage()` + alerte sidebar quand > 70% quota
- [ ] Purge LRU automatique des `documents_livraison_*` anciens
- [ ] Propager `sauvegarder()` return `false` vers callers (évite toast "✅ Livraison ajoutée" si write échoué)

**Files** : `script-core-storage.js`, `offline-queue.js`, `script-livraisons-drawer.js`, nouveau bucket Supabase
