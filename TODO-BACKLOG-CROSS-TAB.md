# Backlog Cross-Tab — Gros chantiers >1j (audit 8 agents Opus 4.7, 2026-05-16)

Audit complet de 8 onglets admin par 8 agents Opus 4.7 en parallèle : Planning, Heures, Alertes, Incidents, Inspections, TVA, Encaissement, Stats+Rentabilité.

Bugs urgents (Phase 91.42) déjà fixés en parallèle : 50+ corrections + clés storage incorrectes + TZ + filtres statut + refresh chains.

Reste 6 gros chantiers hors scope hotfix :

---

## 1. Mobile parité Heures/Inspections/Incidents
**Estimation : 1-2 j**

- [ ] Module Heures mobile : aujourd'hui = vue chauffeur sans saisie pointage admin (m.html missing)
- [ ] Inspections mobile : module total absent — chauffeur ne peut pas faire inspection véhicule
- [ ] Incidents mobile : signalement OK mais aucun filtre statut/gravité, pas d'export
- [ ] Drawer 360 PC Incidents (modal édition uniquement aujourd'hui)
- [ ] Drawer 360 PC Inspections (idem)

**Files** : `script-mobile.js`, `m.html`, `script-incidents.js`, `script-inspections.js`

---

## 2. Migration plannings_hebdo → plannings (clé unifiée)
**Estimation : 1 j**

Audit Agent 1 : 3 fichiers lisent `plannings_hebdo` alors que toute la stack écrit `plannings`.

- [x] script-heures-counts.js (fixé Phase 91.42)
- [x] script-planning-counts.js (fixé Phase 91.42)
- [ ] script-dev-seed.js:666 → écrit `plannings_hebdo` au lieu de `plannings` (orphelin)
- [ ] Helper `migrerCleLegacy('plannings_hebdo', 'plannings')` au boot pour data utilisateurs existants
- [ ] Vérifier qu'aucun adapter Supabase ne référence encore l'ancien nom

**Files** : `script-dev-seed.js`, nouveau script boot `script-storage-migration.js`

---

## 3. Refonte schémas date_debut/date_fin → debut/fin (absences)
**Estimation : 1 j**

Audit Agent 1 : `absences_periodes` divergence storage local (camelCase `dateDebut`/`dateFin`) vs Supabase (snake_case `date_debut`/`date_fin`) vs UI (`debut`/`fin`).

- [ ] Normaliser via helper `normalizeAbsence` dans `script-core-utils.js`
- [ ] Migration boot idempotente pour data utilisateurs existants
- [ ] Mettre à jour `legacy-entity-adapters.js` (mapping bi-directionnel)
- [ ] Tests : `tests/data-schemas.test.js` ajouter cas absences

**Files** : `script-core-utils.js`, `legacy-entity-adapters.js`, nouveau test

---

## 4. Workflow guidé "Saisie pointage" mobile chauffeur
**Estimation : 2-3 j — BLOQUANT prod**

Audit Agent 6 : actuellement pointage = saisie manuelle, pas de start/stop in-app.

- [ ] Bouton "Démarrer ma journée" sur salarie.html → enregistre heureDebut + position GPS
- [ ] Bouton "Pause / Reprise" pour CE 561 (45 min après 4h30 de conduite)
- [ ] Bouton "Fin de journée" → calcule total + signature électronique facultative
- [ ] Notification push si dépassement seuil journalier (9h/10h selon contrat)
- [ ] Validation admin via drawer "Heures à valider" PC
- [ ] Sync supabase `heures` table avec champs `debut_gps`, `fin_gps`, `validee`, `valideeLe`

**Files** : `salarie.html`, `script-salarie.js`, nouvelle migration `043_heures_validation.sql`

---

## 5. Module TVA — Refonte complète déclaration
**Estimation : 2 j**

Audit Agent 7 : page TVA est en grande partie placeholder, pas de génération CA3.

- [ ] Tableau récap mois/trimestre : CA collecté + TVA collectée + TVA déductible + TVA à payer
- [ ] Export PDF déclaration CA3 préformatée (séries directes Pennylane)
- [ ] Bouton "Marquer déclaré" + date butoir + statut
- [ ] Historique des déclarations passées avec drilldown
- [ ] Alerte automatique 5j avant date limite déclaration
- [ ] Sync avec Pennylane (la déclaration officielle s'y fait — MCA ne fait que la préparer)

**Files** : `script-tva.js`, `admin.html`, edge fn possible `tva-export-ca3`

---

## 6. Bus events cross-entity généralisé
**Estimation : 1 j**

Audit Agent 3 : refresh chains hardcodées dans chaque setter (modal-paiement, livraisons-drawer, etc.). Fragile.

- [x] `<cle>:updated` dispatched par script-core-storage.js sauvegarder() (Phase 91.39)
- [ ] Bus formalisé : `mca.events.on('livraisons:updated', cb)` + `mca.events.emit(...)`
- [ ] Migration de tous les refresh hardcodés vers listeners auto-subscribed
- [ ] Throttle 100ms pour éviter spam de re-renders
- [ ] Listener cleanup au démontage de page (memory leak)
- [ ] Tests : émettre 5 events → 1 seul re-render observé

**Files** : nouveau `script-core-events.js`, refactor `script-dashboard-finish.js`, `script-livraisons-drawer.js`, `script-modal-paiement.js`

---

## Notes audit Agent par Agent

**Planning (Agent 1)** : Sévérité HIGH = clé `plannings_hebdo` inexistante (storage utilise `plannings`). Sévérité MED = `absences_periodes` field divergent.

**Heures (Agent 6)** : HIGH = stockage dual `heures` + `heures_pointage`. MED = éclipse planifié quand réelle partielle.

**Alertes (Agent 3)** : HIGH = topbar bell badge non rafraîchi (élément `topbar-bell-count` jamais ciblé). MED = `niveau` field optionnel mais dashboard-attention assume sa présence → SEVERITY_MAP fallback nécessaire.

**Incidents (Agent 4)** : MED = `changerStatutIncident` ne pose pas `resoluLe` quand statut = traite (KPIs résolution faux). MED = `supprimerLivraison` n'orpheline pas les incidents/paiements/docs liés.

**Inspections (Agent 5)** : LOW = pas de filtre période, pas de drilldown véhicule, pas d'export PDF. Module à creuser en Sprint H3.

**TVA (Agent 7)** : Module quasi-placeholder, voir gros chantier #5.

**Encaissement (Agent 7)** : HIGH = KPI "Encaissé ce mois" fallback sur date livraison si pas de datePaiement (gonfle artificiellement). HIGH = `calculerDSO` lit uniquement `dateLivraison` (champ legacy) au lieu du champ `date` actuel.

**Stats+Rentabilité (Agent 8)** : HIGH = CA inclut brouillons + annulées. HIGH = label "CA HT" mais utilise `l.prix` (TTC) dans graphiques. MED = `buildAreaData` `toISOString().slice(0,10)` décale 1j en CEST.
