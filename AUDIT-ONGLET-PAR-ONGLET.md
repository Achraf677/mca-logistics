# Audit Onglet par Onglet — Reste à faire

> **Source unique de vérité** consolidée depuis le plan v9 audit 8 agents (2026-05-16 17h59),
> TODO-LIVRAISONS-BACKLOG.md, TODO-BACKLOG-CROSS-TAB.md et PLAN-REFONTE.md.
>
> **Règle stricte** : on attaque onglet par onglet, dans l'ordre listé ci-dessous.
> Aucun ajout en cours de route. Aucune dispersion. Si un item ici est en réalité déjà
> fait, on le coche et on passe au suivant — on ne s'éparpille pas sur du polish hors liste.
>
> Statut : `[ ]` = TODO · `[x]` = DONE · `[~]` = partiel (à finir)
> Source : agent du plan v9 (A à H) entre crochets.

---

## 🧭 Ordre d'exécution (verrouillé)

1. Livraisons (admin)
2. Dashboard
3. Calendrier
4. Planning
5. Alertes
6. Clients
7. Fournisseurs
8. Véhicules
9. Carburant
10. Entretiens
11. Inspections
12. Équipe / Salariés
13. Heures & Km
14. Incidents
15. Charges
16. Encaissement
17. TVA
18. Rentabilité
19. Statistiques
20. Paramètres
21. Brouillons IA
22. Mobile m.html
23. Espace chauffeur salarie.html
24. Transverse (sync, perf, a11y, dette tech)

On termine **complètement** un onglet (= tous ses `[ ]` deviennent `[x]` ou `[~]` documenté) avant de passer au suivant.

---

## 🔁 Checklist cross-tab (à vérifier sur CHAQUE onglet 2 → 21)

Émergé de l'audit Onglet 1 (2026-05-17). Ces 3 checks systématiques s'ajoutent aux items spécifiques de chaque onglet :

- **A. Topbar non collée** : titre H1/H2 a une marge ≥ 20px avec la topbar (règle CSS `.page > ...:first-child { margin-top: 20px }` couvre les cas standards + les pages avec `<span hidden>` en tête). Sinon → fix CSS ciblé.
- **B. Cohérence labels chip ↔ select ↔ badge** : si un chip filtre dit "Brouillons" mais le select statut dit "En attente" et le badge dit "Brouillon", c'est une drift. Unifier le terme visible (la `value=` reste pour rétro-compat data).
- **C. Drawer auto-refresh après mutation** : si une mutation (ajout, edit, génération facture/document) ne re-renderise pas le drawer 360 ouvert, le compteur reste figé. Vérifier que la mutation appelle `refreshDrawerX` (client / fournisseur / vehicule / salarie / etc.).

---

## 1. Livraisons

- [x] Colonne Véhicule td manquant / désaligné [Agent B] — *fixé 2026-05-17 commits a3d0e65 + 455e77b*
- [x] Drawer typo `vehImmat || vehImmat` [Agent B] — *fixé 2026-05-17*
- [x] Auto-fill véhicule depuis chauffeur (vehImmat canonical) — *fixé 2026-05-17*
- [x] Brouillon filtre désynchro : `getLivraisonsFiltresActifs` accepte maintenant `brouillon || en-attente` *(commit 2026-05-17)*
- [x] Refresh chain `ajouterLivraison` alignée avec `confirmerEditLivraison` (ajout `refreshDrawerClient` + `refreshDrawerLivraisonDetail`) *(commit 2026-05-17)*
- [x] Chip "Parking" : déjà compté (script-charges-kpis-categorie.js:50,100, Phase 91.55 Bug E). En réalité dans onglet Charges, pas Livraisons.
- [x] Nom client tronqué : `slice(0,48) + '…'` dans `formatClientLabel`, title attribut conserve nom complet via `clientFull` *(commit 2026-05-17)*
- [x] Bulk Edit Modal N>1 livraisons *(commit 2026-05-17)*
  - Modal HTML `modal-bulk-edit-livraisons` ajouté dans admin.html
  - `script-livraisons-bulk-edit.js` créé avec `bulkEditLivraisons(ids)` + `confirmerBulkEditLivraisons()`
  - 7 champs cochables : statut, statutPaiement, chaufId, vehId, date, modePaiement, tauxTVA
  - Verrou édition vérifié par id (skip + count si verrouillé par autre admin)
  - synchroniserAffectationLivraison appelé si chauffeur/véhicule changé
  - Audit log 1 entrée pour le batch, refresh chain complète
- [x] Génération facture depuis dropdown : try/catch wrapper en place (script-livraisons-polish.js:565-584) + SIRET vide handler (script-livraisons.js:1028-1032 toast + redirect Paramètres)
- [x] 🆕 Statut "En attente" → "Brouillon" (label visuel dropdown statut, value=en-attente conservée rétro-compat) — 4 renderers mis à jour *(commit 2026-05-17, signalé par user screenshot)*
- [x] 🆕 Génération facture ne refresh pas le drawer client ouvert (compteur "Factures (0)" figé) — `refreshDrawerClient` défini dans script-core-sprint25-drawer-360.js + appelé depuis `assurerArchiveFactureLivraison` *(commit 2026-05-17)*
- [x] 🆕 Topbar collée sur écrans <1920px : padding-top `.page` harmonisé sur tous breakpoints (24/20/18/16px selon viewport, au lieu de 18/14/12/10px) *(commit 2026-05-17, signalé par user)*
- [x] 🆕 Facture liée canoniquement au client via clientId (avant : match par nom uniquement, fragile). assurerArchiveFactureLivraison écrit maintenant `facture.clientId` + `facture.clientSiren` + `facture.date` canonique. Migration boot R9 backfill toutes les factures pre-existantes via livraison.clientId puis fallback nom *(commit 2026-05-17)*
- [x] 🆕 Topbar Livraisons parité layout avec Alertes : `<div class="title-row">` H1+sub-meta restauré (la suppression Phase 91.5 avait cassé l'aération en haut sur écrans < 1920px). User feedback : "copie exactement le même code". *(commit 2026-05-17)*
- [x] 🆕 Garde-fous métier génération documents (drawer Documents + toolbar dropdown) :
  - **Facture** bloquée si statut ≠ "livré" (CGI art. 289, facture pour prestation effective)
  - **Bon de livraison** bloqué si statut = "brouillon"/"en-attente" (livraison non engagée)
  - **Lettre de voiture (CMR)** : AUCUN blocage (document légal transport, arrêté 09/11/1999, doit être en cabine AVANT départ)
  Toast d'erreur explicite citant la règle métier au lieu d'un échec silencieux. *(commit 2026-05-17)*
- [x] 🆕 Title-row sub-meta "7s à traiter" corrigée → "7 retards" (le span -s était mal placé) *(commit 2026-05-17)*
- [x] 🆕 **Facture wipée au refresh** : `supabase-storage-sync.js` n'excluait pas `factures_emises` de `applyRemoteSnapshot`. Le snapshot remote (qui ne contient pas ce registre local-only) écrasait les factures fraîchement émises au prochain boot. Exclu : `factures_emises`, `avoirs_emis`, `encaissements`, `encaissements_manuels`, `acomptes`, `relances` (registres financiers sans miroir Supabase aujourd'hui). *(commit 2026-05-17, root cause user "facture disparaît au refresh")*

## 2. Dashboard

- [ ] Topbar `margin-top:20px` global sur `.page > .ds-section-head:first-child` [Agent A] — *à vérifier appliqué*
- [ ] Sub-meta date "Mai 2026" wired (était vide) [PLAN-REFONTE] — *à vérifier*
- [ ] KPI bar mockup-aligned (Livraisons/CA HT/Marge nette/Retards) — *à vérifier*
- [ ] Indice santé 4 sous-cartes FINANCE/FLOTTE/RH/CONFORMITÉ — *à vérifier*

## 3. Calendrier

- [ ] `script-stats-calendrier-counts.js:125` écrase fix Phase 91.50 sur `cal16-kpi-pai` → "Encaissé 600€" non vraiment fixé. Supprimer ce bloc legacy. [Agent B]
- [ ] Cellule "Aujourd'hui" en brand red `#E11D48` [Agent E, audit H26] — *à vérifier*
- [ ] Légende complète Aujourd'hui/Férié/Livraison/Échéance — *à vérifier*

## 4. Planning

- [ ] `script-dev-seed.js:666` écrit `plannings_hebdo` au lieu de `plannings` (orphelin) [TODO-BACKLOG #2]
- [ ] Helper `migrerCleLegacy('plannings_hebdo', 'plannings')` au boot [TODO-BACKLOG #2]
- [ ] Vérifier qu'aucun adapter Supabase ne référence l'ancien nom `plannings_hebdo` [TODO-BACKLOG #2]
- [ ] `absences_periodes` divergence schéma : `dateDebut/dateFin` (local) vs `date_debut/date_fin` (Supabase) vs `debut/fin` (UI). Helper `normalizeAbsence` dans `script-core-utils.js` + migration boot idempotente [TODO-BACKLOG #3]

## 5. Alertes

- [ ] Topbar bell badge non rafraîchi : élément `topbar-bell-count` jamais ciblé par le code [Audit Agent 3 HIGH]
- [ ] `niveau` field optionnel mais `dashboard-attention` assume sa présence → ajouter SEVERITY_MAP fallback [Audit Agent 3 MED]

## 6. Clients

- [ ] Drawer 360 PC clients (mobile PR #33 a livré drawer mobile, PC = modal édition simple) [PLAN-REFONTE H2.4]
- [ ] Tables Clients add `class="card table-card"` [Agent A]

## 7. Fournisseurs

- [ ] Drawer 360 PC fournisseurs (idem clients) [PLAN-REFONTE H2.4]
- [ ] Tables Fournisseurs add `class="card table-card"` [Agent A]

## 8. Véhicules

- [ ] Drawer 360 PC véhicules (mobile PR #32 livré, PC = modal édition) [PLAN-REFONTE H2.4]

## 9. Carburant

- [ ] (rien d'identifié hier hors items transverses)

## 10. Entretiens

- [ ] (rien d'identifié hier hors items transverses)

## 11. Inspections

- [ ] Drawer 360 PC Inspections (modal édition uniquement aujourd'hui) [TODO-BACKLOG #1]
- [ ] Filtre période + drilldown véhicule + export PDF (Sprint H3, low prio) [Audit Agent 5 LOW]

## 12. Équipe / Salariés

- [ ] Drawer 360 PC Salariés (PR #29 a livré mobile, PC = modal édition) [PLAN-REFONTE H2.4]
- [ ] Hub Équipe Sprint 22 : actuellement entrées plates (Planning/Heures/Incidents/Salariés sont 4 entrées plates au lieu d'un hub) [PLAN-REFONTE H2.4]

## 13. Heures & Km 🚨 BLOQUANT PROD

- [ ] Stockage dual `heures` + `heures_pointage` à unifier [Audit Agent 6 HIGH]
- [ ] Éclipse planifié quand réelle partielle [Audit Agent 6 MED]
- [ ] **Workflow guidé "Saisie pointage" mobile chauffeur** (2-3j) [TODO-BACKLOG #4] :
  - Bouton "Démarrer ma journée" sur salarie.html → enregistre heureDebut + position GPS
  - Bouton "Pause / Reprise" pour CE 561 (45 min après 4h30 conduite)
  - Bouton "Fin de journée" → calcule total + signature électronique facultative
  - Notification push si dépassement seuil journalier (9h/10h selon contrat)
  - Validation admin via drawer "Heures à valider" PC
  - Migration `043_heures_validation.sql` avec champs `debut_gps`, `fin_gps`, `validee`, `valideeLe`

## 14. Incidents

- [ ] Drawer 360 PC Incidents (modal édition uniquement) [TODO-BACKLOG #1]
- [ ] `changerStatutIncident` ne pose pas `resoluLe` quand statut=traite → KPIs résolution faux [Audit Agent 4 MED]
- [ ] `supprimerLivraison` n'orpheline pas les incidents/paiements/docs liés [Audit Agent 4 MED]

## 15. Charges

- [ ] Fusion filtres + mini-KPI dans grille [Plan v9 Phase IV.91.57]
- [ ] Déplacer catégories custom Paramètres → Charges [Plan v9 Phase IV.91.57]

## 16. Encaissement

- [ ] KPI "Encaissé ce mois" fallback sur `dateLivraison` si pas de `datePaiement` (gonfle artificiellement) [Audit Agent 7 HIGH]
- [ ] `calculerDSO` lit uniquement `dateLivraison` (legacy) au lieu du champ `date` actuel [Audit Agent 7 HIGH]
- [ ] DSO calculé pour brief IA + KPI page Encaissement [CLAUDE.md H3.4]
- [ ] Tabs internes 4 onglets (Suivi/Relances/Historique/Analyse) [Plan v9 Phase IV.91.58]

## 17. TVA 🚧 quasi-placeholder

- [ ] Bannière sticky "à payer" + chips Mois/Trim/An [Plan v9 Phase IV.91.59]
- [ ] **Refonte complète déclaration** (2j) [TODO-BACKLOG #5] :
  - Tableau récap mois/trimestre : CA collecté + TVA collectée + TVA déductible + TVA à payer
  - Export PDF déclaration CA3 préformatée
  - Bouton "Marquer déclaré" + date butoir + statut
  - Historique des déclarations passées avec drilldown
  - Alerte automatique 5j avant date limite déclaration
  - Sync Pennylane (la déclaration officielle s'y fait — MCA prépare)
  - Edge fn possible `tva-export-ca3`

## 18. Rentabilité

- [ ] Simulateur en drawer/modal séparé [Plan v9 Phase IV.91.60]
- [ ] Donut "Répartition charges" à supprimer (doublon Charges) [Plan v9 Phase III.3.3 + Agent E]

## 19. Statistiques

- [ ] Source `chauffeurs` localStorage → Supabase [Plan v9 Phase IV.91.61]
- [ ] Unifier period chips [Plan v9 Phase IV.91.61]
- [ ] CA inclut brouillons + annulées (à exclure) [Audit Agent 8 HIGH]
- [ ] Label "CA HT" mais utilise `l.prix` (TTC) dans graphiques [Audit Agent 8 HIGH]
- [ ] `buildAreaData` `toISOString().slice(0,10)` décale 1j en CEST [Audit Agent 8 MED]
- [ ] Sub-meta : drop dates redondantes [Plan v9 Phase III.3.2]

## 20. Paramètres

- [ ] Déplacer "Identité visuelle" → onglet Apparence [Plan v9 Phase IV.91.62]
- [ ] Notifications toggles : créer handler + persist localStorage [Plan v9 Phase II.2.4]
- [ ] Polices globales dynamiques [Plan v9 Phase V.91.63] :
  - `script-core-fonts.js` lit localStorage, applique `setProperty(':root', '--ds-font-body', value)`
  - UI sélecteur cards visuelles dans Apparence
  - Chargement Google Fonts dynamique
  - Body : DM Sans / Inter / Manrope / Outfit / IBM Plex Sans
  - Display : Syne / Space Grotesk / Sora / Manrope

## 21. Brouillons IA

- [ ] (rien d'identifié hier hors items transverses)

## 22. Mobile m.html — parité PC

- [ ] `script-mobile-exports.js` chargé dans m.html [Agent F]
- [ ] `monitoring.js` ajouté à m.html [Agent F]
- [ ] `offline-queue.js` ajouté à m.html [Agent F]
- [ ] Realtime Supabase chauffeur (channel filtré + RLS) [Agent F]
- [ ] Renommage "En attente" → "Brouillon" côté mobile [Agent F]
- [ ] Chips filtre statut mobile + KPI Encaissé cohérence [Agent F]
- [ ] Drawer 360 mobile livraisons (sheet fullscreen 4 onglets) [TODO-LIVRAISONS #1]
- [ ] Pull-to-refresh mobile (existe PC `script.js:2845`, à porter) [TODO-LIVRAISONS #1]
- [ ] Drag-drop kanban touch-friendly (actuellement tap seul) [TODO-LIVRAISONS #1]
- [ ] Brouillons IA pré-remplis dans `formNouvelleLivraison` mobile [TODO-LIVRAISONS #1]
- [ ] **Module Inspections mobile** (TOTAL ABSENT — chauffeur ne peut pas faire inspection) [TODO-BACKLOG #1]
- [ ] Module Heures mobile : aujourd'hui = vue chauffeur sans saisie pointage admin [TODO-BACKLOG #1]
- [ ] Module Incidents mobile : signalement OK mais aucun filtre statut/gravité, pas d'export [TODO-BACKLOG #1]

## 23. Espace chauffeur salarie.html 🚨 BLOQUANT PROD TRANSPORT

[TODO-LIVRAISONS #2 — chantier 2-3j]

- [ ] Migration Design System complète (style-tokens + tokens --ds-*) [Agent F]
- [ ] **Signature électronique client** : canvas signature pad + bucket Supabase `livraisons-signatures` + champ `liv.signatureClient` (path)
- [ ] **Photo BL émargé** : upload photo, bucket `livraisons-bl`, champ `liv.photoBL`
- [ ] **GPS tracking** : `navigator.geolocation.watchPosition` au démarrage de tournée, géo-stamp à la livraison (`liv.posLivraison = {lat, lng, ts}`)
- [ ] **Notifications push réelles** : `PushManager` + VAPID + SW handler `push` (actuellement localStorage polling)
- [ ] **Filtre étendu J+1, retards** (actuellement = jour J uniquement)
- [ ] **Détail marchandise/destinataire/ADR** affiché côté chauffeur
- [ ] **Signalement incident métier** depuis fiche livraison (refus, retard, casse)
- [ ] **Workflow guidé "Livraison terminée"** : signature → photo → km arrivée → statut=livré → horodatage

---

## 24. Transverse (à attaquer après les onglets)

### 24.A — Supabase sync robustesse multi-device [TODO-LIVRAISONS #3 — 1-2j]

- [ ] Race condition boot : flush en attente vs `pullAll()` → données locales écrasées. Ajouter merge ou flush-before-pull (entity-supabase-adapter.js:220-249)
- [ ] Conflict resolution : Last-write-wins silencieux → ajouter `updated_at` versionning + toast warning
- [ ] Retry online côté admin : `offline-queue.js` est mobile-only, brancher pour admin
- [ ] Edit locks réels : `admin_edit_locks` table existe (migration 042) mais pas intégrée à `ajouterLivraison`/`confirmerEditLivraison`
- [ ] Sanitize `extra` jsonb : nettoyer les champs déjà colonnes

### 24.B — Migration localStorage → IndexedDB [TODO-LIVRAISONS #5 — 1-2j]

- [ ] Étendre `offline-queue.js` (déjà IDB pour photos) pour `livraisons` + `documents_livraison_*`
- [ ] API `charger`/`sauvegarder` (script-core-storage.js) routent IDB pour gros datasets, localStorage pour petits
- [ ] Upload PDF/HTML docs vers Supabase Storage bucket `livraison-docs` au lieu de localStorage
- [ ] Helper `estimerTailleLocalStorage()` + alerte sidebar quand > 70% quota
- [ ] Purge LRU automatique des `documents_livraison_*` anciens
- [ ] Propager `sauvegarder()` return `false` vers callers (évite toast success si write échoué)

### 24.C — Bus events cross-entity généralisé [TODO-BACKLOG #6 — 1j]

- [ ] Bus formalisé : `mca.events.on('livraisons:updated', cb)` + `mca.events.emit(...)`
- [ ] Migration des refresh hardcodés vers listeners auto-subscribed
- [ ] Throttle 100ms pour éviter spam de re-renders
- [ ] Listener cleanup au démontage de page (memory leak)
- [ ] Tests : émettre 5 events → 1 seul re-render observé

### 24.D — Performance [Plan v9 Phase IX — Agent H]

- [ ] `pullLimit: 500` sur livraisons/charges/carburant (-3-5s boot)
- [ ] Scheduler unifié 14 timers → 1 (-50% CPU)
- [ ] Lazy `script-salaries.js` (56KB) + `script-planning.js` (57KB) + `script-vehicules.js` (52KB) + `script-charges.js` (43KB) = 208KB économisés
- [ ] CSS bundle 33→1 fichier (script build)
- [ ] localStorage quota guard + toast
- [ ] SW CORE_ASSETS split SHELL_ASSETS / ROUTE_ASSETS (-2MB précache)

### 24.E — Accessibility WCAG/RGAA [Plan v9 Phase VIII — Agent G]

- [ ] Skip link `<a href="#mainContent">` admin.html (présent salarie/m, manque admin) — *à vérifier*
- [ ] salarie.html `<main>` + `<h1>` — *vérifier complétude*
- [ ] `aria-invalid` + `aria-describedby` pattern formulaires
- [ ] `<th scope="col/row">` sur 205 th admin.html
- [ ] `aria-sort` sur 28 tables triables
- [ ] `aria-busy` pendant async loads
- [ ] `outline: none !important` fix `style-design-modals-refine.css:144`
- [ ] `role="alert"` séparé pour erreurs (vs `role="status"` toasts)
- [ ] `aria-expanded` mobile drawers
- [ ] `@axe-core/playwright` intégration tests E2E

### 24.F — Dette technique [Plan v9 Phase X — Agent D]

- [x] `renderLivraisonsAdminFinal` refactor pipeline unique — *Phase X.BW lock-down*
- [x] `afficherToast` double définition supprimée — *Phase X.AV extraction toast*
- [ ] `fermerFiche360` double définition supprimée
- [ ] Doublons HT functions (carburant/entretiens) consolidés
- [ ] `patchClientsRows/Fournisseurs` no-ops + observers supprimés
- [ ] Migration SQL 009 `ON CONFLICT DO NOTHING` + 005 wrap `DO $$ IF EXISTS`
- [ ] Indigo legacy `#6366f1` → `var(--ds-brand)` (30+ occurrences)
- [ ] `script-dev-seed.js` conditionnel `<script>` (charger uniquement si `?seed=1`)
- [ ] `version-bump.js` tooling (20 lignes Node)
- [ ] ESLint `no-unused-vars` config
- [ ] Pré-commit hook `node --test`

### 24.G — Reseed persistant [Audit V6 C4 — DEPEND_USER]

- [ ] Désactiver adapters Supabase quand `?reseed=1` ET `auth_mode=local`, OU sync seed → Supabase

### 24.H — Supabase schema mismatch [Audit V6 C3 — DEPEND_USER]

- [ ] Migration SQL : `ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS recurrence_actif boolean DEFAULT false;`

---

## 📊 Résumé

- **Onglets bloqués prod** : Salarié espace chauffeur (preuve livraison), Heures & Km (workflow pointage)
- **Onglets refonte majeure** : TVA (quasi-placeholder)
- **Drawers 360 PC manquants** : Clients, Fournisseurs, Véhicules, Salariés, Incidents, Inspections
- **Migration mobile parité** : m.html (Inspections absent, Heures vue chauffeur, Incidents filtres/export)
- **Transverse critique** : Sync robustesse, IDB scaling, Bus events, A11y th/aria-sort

## 🎯 Règle d'engagement

Quand on attaque l'onglet N, on :
1. Ouvre la section dans ce MD
2. Pour chaque `[ ]` : code → test → commit → coche `[x]`
3. Si pendant le fix on découvre un bug non listé ici → on le note en bas de la section onglet avec préfixe `🆕` (mais on continue à finir les `[ ]` existants AVANT de l'attaquer)
4. Aucun ajout d'item depuis sources externes (autres MD, ma "mémoire", suggestions agents)
5. Une fois tous les `[ ]` cochés → on passe à l'onglet suivant
