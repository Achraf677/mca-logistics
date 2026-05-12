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

- ⬜ **H5** — Carburant : "Évolution conso flotte 6 mois" + "Consommation par véhicule"
- ⬜ **H6** — Encaissement : "Encaissements vs impayés 6 mois" + "Vieillissement créances"
- ⬜ **H7** — TVA : "Collectée vs déductible"
- ⬜ **H8** — Rentabilité : "Évolution CA/charges 6 mois" + "Répartition charges donut"
- ⬜ **H9** — Statistiques : "Évolution CA 6m" + "Top chauffeurs" + "Utilisation véhicules"

### Tables colonnes manquantes

- ⬜ **H10** — Clients : ajouter ENCOURS + STATUT (badges ACTIF/À RELANCER/RETARD)
- ⬜ **H11** — Fournisseurs : ajouter CATÉGORIE + À RÉGLER + DERNIÈRE FACTURE

### KPIs non connectés

- ⬜ **H12** — Rentabilité : KPIs vides (CA, Charges, Marge, Coût/km) → connecter calculs
- ⬜ **H13** — Statistiques : KPIs à 0 → connecter calculs
- ⬜ **H14** — Inspections : KPIs vides → connecter (KO count, conformité %, véhicule à risque)
- ⬜ **H15** — Top chauffeurs / Utilisation véhicules : sections vides → connecter

### Sections manquantes mockup

- ✅ **H16** — Carburant : bannière anomalies ajoutée (`#carb-anomalie-banner`). Peuplée via alertes_admin type=carburant_anomalie. Bouton "Configurer" → `ouvrirConfigAnomaliesCarburant()`. DONE session :45 2026-05-12
- ✅ **H17** — Entretiens : bannière déjà impl (`#entr-alert-banner` + `script-entretiens-alert.js`). FALSE POSITIVE audit. DONE depuis Phase 51.
- ✅ **H18** — Entretiens : section "Contrôles techniques à venir" (tableau CT + dates) — DONE. HTML `#entr-ct-venir-card` + table `#tb-ct-venir-body` ajoutés dans admin.html. `showCTAVenir()` dans script-entretiens-alert.js : query vehicules.date_prochain_ct, tri par diff, couleurs rouge/orange/muted, visible jusqu'à 60j. Session :45 2026-05-12.
- ⬜ **H19** — Entretiens : section "Historique véhicule" (timeline)
- ⬜ **H20** — Inspections : table avec 5 rows mockup + badges colorés
- ⬜ **H21** — Équipe Vue d'ensemble : 8 cards chauffeurs avec véhicule/livraisons30j/ponctualité/permis
- ⬜ **H22** — Planning : grille hebdo CHAUFFEUR × LUN-DIM avec créneaux colorés

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
- ⬜ **M3** — Statut pills : harmoniser dots colorés (mockup) vs pills (prod) — décider style unique
- ⬜ **M4** — Calendrier : KPI "ENCAISSÉ" formule différente (HT vs TTC) → harmoniser
- ⬜ **M5** — Alertes : sub-tabs "Critique/À traiter/Pour info/Reportées" — décider ajout mockup ou retrait prod
- ⬜ **M6** — Alertes : cartes individuelles tableau vs liste — décider format
- ⬜ **M7** — Fournisseurs : KPI TOP DÉPENSE / CAT. DOMINANTE vides → bug calcul
- ⬜ **M8** — Véhicules : compléter cards (Entretien/CT/Diagnostiquer buttons, layout 3 colonnes)
- ⬜ **M9** — Entretiens : harmoniser chips filtres (5 prod vs 4 mockup)
- ✅ **M10** — Heures&Km : header "0 jours pointés0" — FALSE POSITIVE. Code vérifié : `<span id="heures-section-sub-count" hidden>0</span>` est caché par attribut HTML natif. Pas de double-0 dans prod.
- ✅ **M11** — Heures&Km : bouton "+ Saisir un relevé" → renommé "+ Pointer" (mockup) — DONE session :45 2026-05-12
- ⬜ **M12** — Heures&Km : aligner colonnes tables (DÉBUT/FIN/TOTAL/CE 561) avec mockup
- ⬜ **M13** — Charges : decider architecture page autonome vs tab Finances
- ⬜ **M14** — Encaissement : harmoniser KPIs (1 ligne au lieu de 2)
- ⬜ **M15** — Encaissement : harmoniser colonnes tableau impayés
- ⬜ **M16** — TVA : décider modèle (encaissement vs débit)
- ⬜ **M17** — TVA : ajouter badge "PENNYLANE SYNC"
- ⬜ **M18** — Brouillons IA : fixer chargement bloqué (cascade 503)

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
| 2 — HIGH | 26 | 16 | 0 | 10 (H2, H3, H4, H16, H17, H18, H23, H24, H25, H26) | - | - |
| 3 — MEDIUM | 18 | 14 | 0 | 4 (M1, M2, M10, M11) | - | - |
| 4 — LOW | 14 | 14 | 0 | 0 | - | - |
| **TOTAL** | **65** | **44** | **0** | **15** | **2** | **4** |

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
