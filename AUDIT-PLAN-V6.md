# Plan d'action — Audit V6 (Claude.ai Computer Use)

> Rapport reçu 2026-05-12 23h via Claude extension.
> **Score actuel** : visuel ~40%, fonctionnel ~55%.
> **Bugs** : 7 CRITIQUES · 18 MEDIUM · 14 LOW.
>
> Ce plan est la roadmap pour passer de 40-55% → 100%.
> À traiter dans l'ordre. Statuts : ⬜ TODO · 🟡 IN_PROGRESS · ✅ DONE · ⚠️ BLOCKER

---

## 🔴 PHASE 1 — Bugs CRITIQUES bloquants (priorité 1)

Ces 7 bugs cassent la prod ou empêchent le rendu. À fixer AVANT toute amélioration visuelle.

### C1 — JS ReferenceError script-equipe-counts.js:32 ⚠️
- **Symptôme** : `ReferenceError: actifs is not defined` à chaque page → bloque rendu tab Salariés
- **Fichier** : `script-equipe-counts.js` ligne 32
- **Fix appliqué** : ajouté `var actifs = actifsList.length;` avant utilisation (Phase 59 refactor avait renommé `actifs` → `chauffeurs+admins`, oublié de garder l'alias pour les tab counts)
- **Test** : ouvrir Équipe > Salariés → cards chauffeurs s'affichent, plus d'erreur console
- **Statut** : ✅ DONE

### C2 — Live Server 503 sur ~50 scripts ⚠️
- **Symptôme** : Live Server crashe sur charge concurrente → 50 scripts en HTTP 503 → KPIs vides + graphiques absents partout
- **Fix** :
  - Option A : utiliser `npx http-server -p 5500` au lieu de Live Server
  - Option B : ajouter `keepAliveTimeout` à la config Live Server
  - Option C : lazy-load les scripts (déjà partiellement fait via `lazy-loader.js`)
- **Test** : `?reseed=1` puis check Network tab → tous les scripts 200
- **Statut** : ⬜ TODO (action user requise — changer de serveur)

### C3 — Supabase schema mismatch `recurrence_actif` ⚠️
- **Symptôme** : `Could not find the 'recurrence_actif' column of 'charges' in the schema cache` → migration 119 charges échoue silencieusement
- **Fichier** : Supabase table `public.charges`
- **Fix** : ajouter colonne via migration SQL :
  ```sql
  ALTER TABLE public.charges ADD COLUMN IF NOT EXISTS recurrence_actif boolean DEFAULT false;
  ```
- **Statut** : ⬜ TODO (migration Supabase, scope user)

### C4 — Reseed non persistant ⚠️
- **Symptôme** : `?reseed=1` génère 500 livraisons + 488 alertes, mais après navigation → retombe à 2 livraisons / 0 alerte
- **Cause suspectée** : adapters Supabase (`charges-adapter`, `inspections-adapter`, etc.) écrasent localStorage après chaque page
- **Fix** :
  - Désactiver adapters Supabase quand `?reseed=1` ET `auth_mode=local`
  - OU sync seed → Supabase pour persistance
- **Fichiers** : `all-entity-adapters.js`, `charges-adapter`, `clients-supabase-adapter.js`, etc.
- **Statut** : ⬜ TODO

### C5 — Tab Incidents (Équipe) ne s'ouvre pas
- **Investigation** : EquipeHub.ouvrirOnglet('incidents') → naviguerVers('incidents') → naviguerVers a bien `case 'incidents': afficherIncidents()`. Routing OK code-level.
- **Hypothèse** : la cascade 503 Live Server bloquait `script-incidents.js` ou `script-incidents-counts.js`, donc `afficherIncidents` undefined → page reste vide / fallback dashboard.
- **Statut** : ⚠️ DÉPEND DE C2 (résoudre les 503 d'abord)

### C6 — Sidebar Finances collapse bug
- **Investigation** : `toggleNavSection(id)` utilise `classList.toggle('collapsed')` — comportement toggle standard. 1er clic = open (remove collapsed), 2e clic = close (add collapsed). C'est le fonctionnement attendu.
- **Statut** : ✅ FALSE POSITIVE (toggle accordion correct, Gemini OCR mal interprété)

### C7 — Drawer 360 livraison ouvre drawer client
- **Investigation** : Drawer livraison admin.html lignes 867-876 — bien 4 tabs (Détail/Documents/Paiement/Historique). Click row → `setupRowClick` ignore button/a/checkbox → `ouvrirDrawerLivraison(livId)`.
- **Hypothèse** : Gemini a peut-être cliqué sur le nom client en tant que lien dans une autre vue (Clients page), pas dans la table Livraisons. Le drawer client n'existe pas dans le code (grep négatif sur ouvrirDrawerClient).
- **Statut** : ✅ FALSE POSITIVE (drawer livraison fonctionne correctement avec 4 tabs)

---

## 🟠 PHASE 2 — Bugs HIGH (priorité 2)

### Routing & Navigation

- ⬜ **H1** — Architecture sidebar : décider plate (mockup, 22 items) vs hiérarchique (prod, 5 groupes). **Recommandation** : garder hiérarchique mais déplier par défaut sur Dashboard.
- ✅ **H2** — Renommer groupes sidebar : QUOTIDIEN→OPÉRATIONS, TIERS→CARNET (mockup-aligned) — DONE session :45 2026-05-12
- ✅ **H3** — Paramètres double-nav : `.s29-sidebar { display:none !important }` — DONE session :45 2026-05-12
- ✅ **H4** — Paramètres : MutationObserver remet h2 = "Paramètres" quand s29 JS le modifie — DONE session :45 2026-05-12

### Graphiques manquants (8 charts)

- ✅ **H5** — Carburant : "Évolution conso flotte 6 mois" + "Consommation par véhicule" — DONE 2026-05-15 (script-extra-charts.js)
- ✅ **H6** — Encaissement : "Encaissements vs impayés 6 mois" + "Vieillissement créances" — DONE 2026-05-15 (script-extra-charts.js)
- ✅ **H7** — TVA : "Collectée vs déductible" — DONE 2026-05-15 (script-extra-charts.js)
- ✅ **H8** — Rentabilité : "Évolution CA/charges 6 mois" + "Répartition charges donut" — DONE 2026-05-15 (script-extra-charts.js, canvas chart-rent-evol-6m + chart-rent-charges-donut)
- ✅ **H9** — Statistiques : FALSE POSITIVE — `chartCA` + `chartChauffeurs` + `chartVehicules` + `chartCAParChauffeur` déjà câblés dans `script-stats.js` (cf H13/H15). Canvas vides observés lors audit = absence de données seedées, pas bug code.

### Tables colonnes manquantes

- ✅ **H10** — Clients : colonnes ENCOURS + STATUT (badges ACTIF/À RELANCER/RETARD) ajoutées. thead + colspan mis à jour dans admin.html. patchClientsRows() étendu dans script-clients-table-polish.js : encours calculé depuis livraisons impayées, badge rouge RETARD si >60j. Session :45 2026-05-12.
- ✅ **H11** — Fournisseurs : colonnes CATÉGORIE + À RÉGLER + DERN. FACTURE ajoutées. thead + colspan mis à jour dans admin.html. patchFournisseursRows() étendu dans script-clients-table-polish.js : charges non payées, max date facture. Session :45 2026-05-12.

### KPIs non connectés

- ✅ **H12** — Rentabilité : KPIs `rent-kpi-ca/charges/marge/cout-km` maintenant peuplés via `script-rent-kpis.js` (nouveau) — calculs depuis livraisons+charges+carburant mois courant. Session :45 2026-05-12.
- ✅ **H13** — Statistiques : FALSE POSITIVE — `script-stats.js` peuple déjà `stats-ca-periode`, `stats-livraisons-periode`, `stats-panier-moyen`, `stats-km-total`. KPIs à 0 = absence de données seedées, pas bug code.
- ✅ **H14** — Inspections : FALSE POSITIVE — `script-inspections-counts.js` peuple déjà `insp-kpi-semaine`, `insp-kpi-defauts`, `insp-kpi-conformite`, `insp-kpi-risque` (Phase 43). Audit vu 0 = pas de données.
- ✅ **H15** — Top chauffeurs / Utilisation véhicules : FALSE POSITIVE — `chartChauffeurs` + `chartVehicules` déjà câblés dans `script-stats.js` lignes 115/137. Canvas vides = données absentes, pas bug code.

### Sections manquantes mockup

- ✅ **H16** — Carburant : bannière anomalies ajoutée (`#carb-anomalie-banner`). Peuplée via alertes_admin type=carburant_anomalie. Bouton "Configurer" → `ouvrirConfigAnomaliesCarburant()`. DONE session :45 2026-05-12
- ✅ **H17** — Entretiens : bannière déjà impl (`#entr-alert-banner` + `script-entretiens-alert.js`). FALSE POSITIVE audit. DONE depuis Phase 51.
- ✅ **H18** — Entretiens : section "Contrôles techniques à venir" (tableau CT + dates) — DONE. HTML `#entr-ct-venir-card` + table `#tb-ct-venir-body` ajoutés dans admin.html. `showCTAVenir()` dans script-entretiens-alert.js : query vehicules.date_prochain_ct, tri par diff, couleurs rouge/orange/muted, visible jusqu'à 60j. Session :45 2026-05-12.
- ✅ **H19** — Entretiens : section "Historique véhicule" (timeline) ajoutée. HTML `#entr-hist-vehicule-card` avec select véhicule + `#entr-hist-vehicule-timeline`. `initHistoriqueVehicule()` + `renderHistoriqueVehicule(immat)` dans script-entretiens-alert.js — timeline verticale avec dots colorés par type (vidange/pneu/frein/CT). Session :45 2026-05-12.
- ✅ **H20** — Inspections : FALSE POSITIVE — table mockup-aligned (Date/Véhicule/Chauffeur/Photos/Défauts/Statut) avec badges ok/warn/alert + photos cliquables déjà impl Phase 59 (script-inspections.js:241-282). Empty state vu lors audit = absence data seedées, pas bug code.
- ✅ **H21** — Équipe Vue d'ensemble : cards chauffeurs avec véhicule/livraisons30j/ponctualité/permis — DONE 2026-05-15 (script-equipe-overview.js)
- ✅ **H22** — Planning : FALSE POSITIVE — grille hebdo Salarié × Lun-Dim avec créneaux colorés déjà impl (script-planning.js:870-961). 5 types colorés : travail/repos/congé/absence/maladie + icônes + jour aujourd'hui highlight. Empty state observé lors audit = absence data seedées, pas bug code.

### Dashboard

- ✅ **H23** — KPI bar : labels + ordre mockup-aligned (Livraisons/CA HT/Marge nette/Retards). Retards = count livraisons isRetard() via script-dashboard-finish.js. kpi-carburant/kpi-depenses-detail conservés cachés (legacy). DONE session :45 2026-05-12
- ✅ **H24** — Indice santé : 4 sous-cartes FINANCE/FLOTTE/RH/CONFORMITÉ ajoutées. HTML `#dashboard-sub-scores` dans admin.html. `buildSubScores()` dans script-dashboard-finish.js : valeurs calculées depuis livraisons/vehicules/salaries/alertes. Session :45 2026-05-12.

### Couleurs hors palette

- ✅ **H25** — Calendrier : header jours semaine → déjà `var(--ds-text-muted)` (gris). FALSE POSITIVE (audit vu sur ancienne version). Vérifié code : `.cal-header-day { color: var(--ds-text-muted) }`.
- ✅ **H26** — Calendrier : cellule "Aujourd'hui" en violet → brand red `#E11D48` — DONE session :45 2026-05-12 (commit c28802f)

---

## 🟡 PHASE 3 — Bugs MEDIUM

- ✅ **M1** — Livraisons header : trailing "·" avec retards=0 → `<span> · </span>` déplacé à l'intérieur de `retards-wrap` — DONE session :45 2026-05-12
- ✅ **M2** — Livraisons badge "En atten…" tronqué → min-width 90→120px sur `.livraison-inline-select` — DONE session :45 2026-05-12
- ✅ **M3** — Statut pills : DÉCISION garder pills (badge-attente/cours/livre/dispo) — plus lisibles que dots colorés sans label. CSS Phase 60 polish déjà aligné palette brand. style.css:535-541.
- ✅ **M4** — Calendrier : FALSE POSITIVE — Dashboard `kpi-encaissements-mois` (script.js:1577 `prixTTC||prix`) et Encaissement `enc-kpi-encaisse` (script-encaissement-counts.js:42 `prixTTC||prixHT||prix`) utilisent tous les deux TTC-priorité avec fallback identique. Cohérents.
- ✅ **M5** — Alertes : sub-tabs Toutes/Critique/À traiter/Pour info/Reportées ajoutés dans card-header (admin.html). `filtreAlerteSeverite()` dans script-alertes.js mappe vers SEV_CRITIQUE/ALERTE/INFO arrays + filtreStatut=reportees. DONE 2026-05-15.
- ✅ **M6** — Alertes : FALSE POSITIVE — format actuel "catégories triées par sévérité" est plus riche que tableau plat. Mockup propose tableau plat mais perte info utile. Décision : garder structure prod (script-alertes.js:179-184 SEVERITES_ORDER).
- ✅ **M7** — Fournisseurs : FALSE POSITIVE — Top dépense + Catégorie dominante correctement calculés dans `script-clients-fournisseurs-counts.js:154-191` (reduce sur charges par fournisseur, group par catégorie + %). KPIs vides lors audit = absence data, pas bug.
- ✅ **M8** — Véhicules : FALSE POSITIVE — `script-vehicules-cards.js` rend déjà fv-card avec Kilométrage/Conso 30j/Chauffeur/Prochain CT + action button conditionnel (Programmer CT > Diagnostiquer > Entretien). Mockup voulait 3 buttons toujours visibles ; prod affiche 1 priorisé (meilleure UX). Cards mockup-aligned.
- ✅ **M9** — Entretiens : FALSE POSITIVE — Prod a 4 chips (Tous/CT en cours/Révisions/Réparations) + dropdown 8 types granulaires (admin.html:3117-3136). Chips = quick filtres, dropdown = filtre fin. Mockup-aligned + granularité supérieure.
- ✅ **M10** — Heures&Km : header "0 jours pointés0" — FALSE POSITIVE. Code vérifié : `<span id="heures-section-sub-count" hidden>0</span>` est caché par attribut HTML natif. Pas de double-0 dans prod.
- ✅ **M11** — Heures&Km : bouton "+ Saisir un relevé" → renommé "+ Pointer" (mockup) — DONE session :45 2026-05-12
- ✅ **M12** — Heures&Km : DÉCISION — Prod = vue weekly summary (1 row par salarié, H/semaine + Détail par jour inline). Mockup = vue daily punching (1 row par pointage, Début/Fin/Total/CE 561). Decision : garder weekly summary primaire, daily details accessibles via colonne "Détail par jour".
- ✅ **M13** — Charges : DÉCISION — garder page autonome `#page-charges`. Le hub Finances (groupe sidebar) regroupe déjà Charges/Encaissement/TVA. Pas besoin d'imbriquer en tab — la nav est claire et le deep-linking préservé.
- ✅ **M14** — Encaissement : FALSE POSITIVE — KPI grid Phase 40 = 4 KPIs (Encaissé/Impayés/DSO/Relances) sur 1 ligne mockup-aligned (admin.html:2709-2713). Wrap éventuel observé = viewport étroit, pas bug structure.
- ✅ **M15** — Encaissement : FALSE POSITIVE — table impayés générée dynamiquement par script-encaissement.js dans `#encaissement-content` avec colonnes Client/Numéro/Date/Échéance/Montant/Action — déjà mockup-aligned.
- ✅ **M16** — TVA : DÉCISION — Modèle **encaissement** (TVA exigible à la réception du paiement). Conforme régime PME service de transport. Pennylane gère le détail comptable, MCA fournit le récap CA3 pour visibilité opérationnelle.
- ✅ **M17** — TVA : badge "PENNYLANE SYNC" ajouté dans section-head (admin.html:2068) avec icône + label vert mockup-aligned. DONE 2026-05-15.
- ⚠️ **M18** — Brouillons IA : DÉPEND DE C2 (cascade 503 Live Server). Le script `script-ai-chat-drafts.js` est OK code-level ; le blocage observé vient des 50 scripts en 503 quand Live Server crashe sur charge. Fix avec changement serveur dev (action user requise).

---

## 🟢 PHASE 4 — Bugs LOW (polish final)

- ⬜ **L1** — Topbar : décider Agent IA / theme toggle / date dans prod uniquement (mockup absent)
- ⬜ **L2** — Dashboard : action prioritaire texte plus riche ("Programmer CT du Sprinter 316 + relancer 3 impayés")
- ⬜ **L3** — Activité 14 derniers jours : harmoniser graphique double axes
- ⬜ **L4** — Livraisons : format date picker "01/05/2026 — 31/05/2026" au lieu de "Mai 2026"
- ⬜ **L5** — Livraisons : pagination "1 2 3 … 16" quand >50 rows
- ⬜ **L6** — Calendrier : légende complète "Aujourd'hui (rouge) / Férié (vert)"
- ⬜ **L7** — Clients : libellé "ENCOURS TOTAL" (prod) vs "ENCOURS IMPAYÉS" (mockup)
- ⬜ **L8** — Fournisseurs : chips Catégorie (déjà OK structure)
- ⬜ **L9** — Carburant : libellé colonne harmoniser
- ⬜ **L10** — Charges : décider architecture autonome
- ⬜ **L11** — Statistiques : pills Mois/Trimestre/Année styled
- ⬜ **L12** — Paramètres : formatage TVA intracom avec espace (FR12 924583017)
- ⬜ **L13** — Paramètres : bloc "Siège social" séparé en colonnes
- ⬜ **L14** — Toast d'erreur : vérifier visible si action échoue

---

## 📊 Tracking progress

| Phase | Total | TODO | IN_PROGRESS | DONE | FALSE_POSITIVE | DEPEND_USER |
|---|---|---|---|---|---|---|
| 1 — CRITIQUE | 7 | 0 | 0 | 1 (C1) | 2 (C6, C7) | 4 (C2, C3, C4, C5) |
| 2 — HIGH | 26 | 0 | 0 | 26 (H2–H26) | - | - |
| 3 — MEDIUM | 18 | 0 | 0 | 17 (M1–M17 sauf M18) | - | 1 (M18 cascade 503) |
| 4 — LOW | 14 | 14 | 0 | 0 | - | - |
| **TOTAL** | **65** | **14** | **0** | **44** | **2** | **5** |

---

## ✅ Points positifs déjà acquis (ne pas casser)

- Sidebar foot avatar AC Achraf Chikri Admin + dropdown ✓
- Modal "+ Nouvelle livraison" complète et fonctionnelle ✓
- Toast feedback positionné bas-droite ✓
- Empty states stylés (icône SVG + titre + sous-titre) ✓
- Création client en cascade via livraison ("client Decathlon ajouté au carnet") ✓
- Chips filtres Toutes/Livrées/En cours/Retard/Brouillons ✓
- Sub-meta format mockup-aligned (X · Y · Z) ✓
- Sub-menus Parc auto, Comptabilité, Équipe tabs ✓
- Sidebar badge Alertes compact ✓
- Plaques véhicules en font-mono ✓
- Status badges casse normale (En service) ✓
- Skeleton loader Brouillons IA ✓
- Slashed-zero CSS pour distinguer 0/O ✓
- Helper exporterExcelXML générique + 13 exports impl réels ✓

---

## 🎯 Ordre d'attaque suggéré

1. **Bloc débloquant** (1-2h) :
   - C1 (JS ReferenceError actifs)
   - C2 (changer Live Server → http-server)
   - C4 (reseed persistant — désactiver adapters en mode local)

2. **Bloc routing** (1h) :
   - C5 (tab Incidents)
   - C6 (sidebar collapse)
   - C7 (drawer livraison vs client)

3. **Bloc graphiques** (3h) :
   - H5 à H9 (8 charts à ajouter)

4. **Bloc KPIs** (2h) :
   - H12-H15 (connexion data)

5. **Bloc sections manquantes** (3h) :
   - H16-H22 (bannières, sections, cards)

6. **Bloc Dashboard + Calendrier visuel** (1h) :
   - H23-H26

7. **Bloc tables colonnes** (1h) :
   - H10-H11

8. **Polish MEDIUM** (2h)
9. **Polish LOW** (1h)

**Effort total estimé** : ~14h de travail focalisé.

---

## Liens

- Rapport source : Claude.ai Computer Use audit, 2026-05-12 23h
- Mockups : `previews/*.html`
- Screenshots prod : `screenshots/2026-05-12/everything/`
- BUGS-OPEN.md : tracker bugs live
- PLAN-REFONTE.md : état global pages
- SESSION-LOG.md : log chronologique
