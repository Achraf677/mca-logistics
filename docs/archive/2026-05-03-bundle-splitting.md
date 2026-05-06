# Plan de découpage `script.js` (13 612 lignes / ~664 Ko)

Date : 2026-05-03
Auteur : agent `bundle-split-planner`
Statut : PROPOSITION (lecture seule, aucun code modifié).

---

## Section 1 — État actuel

### 1.1 Inventaire `script.js` par grande zone

| # | Lignes | Taille approx. | Bloc | Domaine | Charge actuelle |
|---|---|---|---|---|---|
| 1 | 1–700 | ~30 Ko | UTILITAIRES (helpers Date, validerSIRET, popup, lifecycle, storage cache, IDs, format euros, compresseur image, prompt, scroll-top) | Helpers globaux | Boot |
| 2 | 703–783 | ~3 Ko | initScrollTop + alertes admin (mostly MOVED, reste init) | Helpers globaux | Boot |
| 3 | 784–939 | ~7 Ko | **`DOMContentLoaded` BOOTSTRAP ADMIN** (auth check, install PWA, listeners nav, init thème, naviguerVers('dashboard'), warmup) | Bootstrap admin | Boot |
| 4 | 940–1008 | ~3 Ko | Garde-fou routes + ouvrir/fermer menu mobile | Bootstrap | Boot |
| 5 | 1009–1143 | ~6 Ko | MODALS (a11y, focus trap) + `mettreAJourSelects` + `changerStatutPaiement` + `resetFiltres` | Helpers UI | Boot |
| 6 | 1144–1192 | ~2 Ko | Synchro `storage` event (salarié→admin) | Bootstrap | Boot |
| 7 | 1273–1327 | ~3 Ko | `afficherReleveKm` (admin véhicules) | Véhicules / KM | Boot (devrait être lazy) |
| 8 | 1339–1405 | ~3 Ko | **Chart.js lazy loader** + helpers gradient/options | Helpers charts | Boot |
| 9 | 1408–1709 | ~16 Ko | **`rafraichirDashboard()`** (énorme, 305 lignes, instancie 6 charts) + état globaux `chartActivite`, `chartRentab`, etc. | Dashboard | Boot |
| 10 | 1735–1809 | ~3 Ko | Globaux gestion salariés (`accessSalarieTargetId`, `editSalarieId`, `genererMotDePasseFort`, `evaluerQualiteMotDePasse`) | Salariés | Boot |
| 11 | 1810–1850 | ~2 Ko | `badgeStatut`, `afficherToast` (utilitaire UI) | Helpers UI | Boot |
| 12 | 1851–1897 | ~3 Ko | Constantes `INSPECTION_STORAGE_RETENTION_DAYS`, `_editLivId`, `_editCarbId` | État global | Boot |
| 13 | 1897–1921 | ~2 Ko | `_msgSalarieActif` (messagerie admin) | Messagerie | Boot |
| 14 | 1922–2023 | ~5 Ko | `JOURS`, `genererGrilleJours`, `verifierConformiteConduiteCE561` | Planning helper | Boot |
| 15 | 2024–2104 | ~5 Ko | **Vue Kanban livraisons** (`afficherKanban`, `dragKanban`, `dropKanban`) | Livraisons (vue) | Boot |
| 16 | 2105–2186 | ~5 Ko | **Vue Calendrier livraisons** (`afficherCalendrier`, `filtrerCalJour`) | Livraisons (vue) | Boot |
| 17 | 2197–2298 | ~5 Ko | Pagination générique, `emptyState`, `majBadgeFavicon` | Helpers UI | Boot |
| 18 | 2303–2325 | ~1 Ko | `csvCelluleSecurisee` (anti CSV-injection) | Helper export | Boot |
| 19 | 2342–2401 | ~3 Ko | `afficherPonctualite`, `toggleChampsFournisseurPro` | Stats / fournisseurs | Boot |
| 20 | 2402–2425 | ~1 Ko | `toggleTypeJour`, `ouvrirTCO` (1-liner forwarder) | Planning / TCO | Boot |
| 21 | 2431–2479 | ~3 Ko | `toggleVueCompacte`, modèles messages (`MODELES_MESSAGES`) | Préférences UI / messages | Boot |
| 22 | 2483–2545 | ~3 Ko | `getHeuresSemaineRange` | Heures | Boot |
| 23 | 2551–2625 | ~4 Ko | `ouvrirNoteInterne`, `afficherDocumentDansFenetre` (PDF/img viewer) | RH / docs | Boot |
| 24 | 2628–2697 | ~3 Ko | `enregistrerConduite`, `initPullToRefresh` | Mobile / véhicule | Boot |
| 25 | 2700–2790 | ~5 Ko | `genererFicheTournee` (PDF tournée journalière) | Exports PDF | Boot (devrait être lazy) |
| 26 | 2794–2835 | ~2 Ko | `initDensiteTableau`, `insererTemplate` (modèles SMS) | UI | Boot |
| 27 | 2836–2957 | ~7 Ko | `verifierNotificationsAutomatiquesMois2`, alertes permis | Alertes auto | Boot |
| 28 | 2966–3003 | ~2 Ko | `afficherTemplatesSMS`, `copierTemplateSMS`, raccourcis clavier | Templates / shortcuts | Boot |
| 29 | 3037–3093 | ~3 Ko | `toggleChampsClientPro`, `copierSemainePrecedente` | Clients / planning | Boot |
| 30 | 3096–3107 | ~1 Ko | `resetTimerInactivite` (déconnexion auto) | Auth | Boot |
| 31 | 3138–3246 | ~6 Ko | Gestion **postes** (`getPostes`, ajouter/supprimer), config trésorerie, `prixHT` | Paramètres | Boot (lazy candidate) |
| 32 | 3286–3401 | ~6 Ko | `marquerPaye`, `afficherTCO`, `getAnneeFactureReference`, `incrementerCompteurFactureAnnee` | Paiements / véhicules / facturation | Boot |
| 33 | 3410–3513 | ~7 Ko | **`genererLettreDeVoiture`** (CMR, gros template HTML) | Exports PDF | Boot (lazy candidate) |
| 34 | 3521–3630 | ~7 Ko | **`genererRegistreRGPD`** (PDF registre traitements) | RGPD / exports | Boot (lazy candidate) |
| 35 | 3722–3800 | ~5 Ko | "NAVIGATION PÉRIODE" + relevé KM (forwarders) | Périodes | Boot |
| 36 | 3823–4210 | ~17 Ko | "CORRECTIONS & AJOUTS — Exports + Planning + Carburant" (résiduel) | Mixte | Boot |
| 37 | 4211–4423 | ~10 Ko | **FINAL ADMIN LOCK** : `ouvrirFenetreImpression`, `construireEnteteExport` (templates PDF unifiés) | Helpers exports | Boot |
| 38 | 4424–4877 | ~22 Ko | **ADMIN FINAL UX / EXPORTS** : `labelPaiement…`, `planningSyncSearchWithSelect`, `renderLivraisonsAdminFinal` (re-render livraisons admin avec bulk + filtres) | Livraisons admin | Boot |
| 39 | 4878–5280 | ~21 Ko | **PLANNING REWRITE FINAL** : absences + planning admin réécrit | Planning admin | Boot |
| 40 | 5281–6654 | ~75 Ko | **PLANNING REWRITE** (grosse réécriture, 1374 lignes) | Planning admin | Boot |
| 41 | 6655–6775 | ~6 Ko | RENTABILITE — calculateur avancé (résiduel : `RENTABILITE_STORAGE_KEY`, fin de fonction `genererRentabilitePDF`) | Rentabilité | Boot |
| 42 | 6776–6840 | ~3 Ko | **Polling synchro admin** (setInterval 5 s, hash localStorage) | Sync background | Boot |
| 43 | 6841–6903 | ~3 Ko | SPRINT 2 — Sidebar repliable | Navigation | Boot |
| 44 | 6904–7149 | ~13 Ko | **SPRINT 3 — Command Palette Ctrl+K** | Recherche | Boot (lazy candidate) |
| 45 | 7150–7245 | ~5 Ko | SPRINT 4 — Score santé + hero ring dashboard | Dashboard | Boot |
| 46 | 7246–7355 | ~5 Ko | SPRINT 5 — Drawer générique (`ouvrirDrawer`/`fermerDrawer`) | Helpers UI | Boot |
| 47 | 7356–7669 | ~17 Ko | **SPRINT 6 — Bulk actions livraisons** (`bulkMarquerPayees`, `bulkSupprimer`, `bulkExporter*`) | Livraisons | Boot (lazy candidate) |
| 48 | 7670–7933 | ~14 Ko | SPRINT 7 — Pagination + recherche instantanée | Helpers UI | Boot |
| 49 | 7934–8202 | ~13 Ko | SPRINT 8 — Tri par colonne | Helpers UI | Boot |
| 50 | 8203–8369 | ~9 Ko | SPRINT 9 — Empty states riches | Helpers UI | Boot |
| 51 | 8370–8621 | ~12 Ko | SPRINT 10 — Toasts stackés + Undo | Helpers UI | Boot |
| 52 | 8622–8826 | ~10 Ko | SPRINT 11 — Formulaires intelligents | Helpers UI | Boot (lazy candidate) |
| 53 | 8827–9075 | ~12 Ko | **SPRINT 15 — Productivité PGI** (auto-création client, badge orpheline, copies, Z quotidien) | Comptabilité | Boot (lazy candidate) |
| 54 | 9076–9713 | ~32 Ko | **SPRINT 16 — Calendrier opérationnel** (vue jour/semaine/mois/année + DnD + impression) | Calendrier | Boot (lazy candidate fort) |
| 55 | 9714–9873 | ~8 Ko | SPRINT 18 — Tri universel `<th>` cliquable | Helpers UI | Boot |
| 56 | 9874–10336 | ~24 Ko | **SPRINT 19 — Centre alertes unifié** (timeline alertes + incidents) | Alertes | Boot (lazy candidate) |
| 57 | 10337–10811 | ~25 Ko | **SPRINT 20 — RH 360°** (drawer fiche salarié + auto-alertes) | RH | Boot (lazy candidate) |
| 58 | 10812–11248 | ~22 Ko | **SPRINT 21 — Parc 360°** (drawer fiche véhicule + auto-alertes) | Parc | Boot (lazy candidate) |
| 59 | 11249–11488 | ~12 Ko | SPRINT 22+23 — Fusion sidebar (hubs Équipe/Parc/Compta) | Navigation | Boot |
| 60 | 11489–11857 | ~19 Ko | **SPRINT 24 — Automatisations** (cron, escalades, raccourcis Enter/Esc/N/E/Ctrl+S) | Background | Boot |
| 61 | 11858–12374 | ~26 Ko | **SPRINT 25 — Drawer 360° Client/Fournisseur + règles alertes perso** | Comptabilité / drawers | Boot (lazy candidate) |
| 62 | 12375–12966 | ~30 Ko | **SPRINT 26 — Timeline globale + stats comparées + signature BL** | Comptabilité / dashboard | Boot (lazy candidate partiel) |
| 63 | 12967–13162 | ~10 Ko | SPRINT 28 — Bugs & cleanup (extension drawer 360°) | Drawers | Boot |
| 64 | 13163–13531 | ~19 Ko | **SPRINT 29 — Refonte Paramètres pro** (sidebar interne 8 sections) | Paramètres | Boot (lazy candidate) |
| 65 | 13532–13612 | ~4 Ko | Form Nouvelle Livraison — progress + validation inline (`window.mcaLivForm`) | Livraisons | Boot |

**Total `script.js` brut : 13 612 lignes / ~664 Ko (non minifié, non gzippé).**

### 1.2 Surface API publique exposée par `script.js` (NE PAS CASSER)

`script.js` assigne **157 propriétés uniques sur `window`**. Les plus critiques (référencées par `onclick="…"` dans `admin.html`, qui contient **243 occurrences `onclick=` / 135 distinctes**, plus `onchange/oninput/onsubmit/onkeyup`) :

**Helpers UI / globaux (DOIVENT rester au boot)** :
- `escapeHtml`, `escapeAttr`, `escHtml`
- `ouvrirPopupSecure`, `promptDialog`, `modalInfo`
- `loadSafe`, `lireStockageJSON`, `genId`, `logMCA`
- `csvCelluleSecurisee`, `resolveStorageImages`
- `openModal`, `closeModal`, `naviguerVers`, `fermerMenuMobile`
- `afficherToast`, `dismissToastById`
- `ouvrirDrawer`, `fermerDrawer`, `fermerInlineDropdowns`
- `toggleNavSection` (sidebar), `toggleAdminMenu`, `toggleHeuresRapportsMenu`
- `mcaLivForm.*` (validation inline form livraison)

**Onclick métiers exposés (cible lazy par module concerné)** :
- Livraisons : `ajouterLivraison`, `supprimerLivraison`, `ouvrirEditLivraison`, `confirmerEditLivraison`, `bulkMarquerPayees`, `bulkSupprimer`, `bulkExporter`, `bulkExporterPDF`, `bulkClear`, `bulkMarquerLivrees`, `toggleBulkSelectAll`, `majBulkActions`, `genererBonLivraison`, `genererFactureLivraison`, `dragKanban`, `dropKanban`
- Carburant : `ajouterCarburant`, `confirmerEditCarburantAdmin`, `confirmerEditKmAdmin`
- Charges : `ajouterCharge`, `ouvrirModalCharge`, `ajusterCategorieCharge`, `resetFiltresCharges`
- Clients : `ajouterClient`, `confirmerEditClient`, `ouvrirHistoriqueClient`, `autoCompleteClient`
- Fournisseurs : `ajouterFournisseur`, `confirmerEditFournisseur`, `ouvrirHistoriqueFournisseur`, `resetFormulaireFournisseur`
- Salariés : `creerSalarie`, `confirmerEditSalarie`, `ouvrirEditSalarie`, `genererMotDePasseSalarie`, `confirmerNoteInterne`
- Véhicules : `ajouterVehicule`, `ouvrirEditVehicule`, `confirmerEditVehicule`, `confirmerAffectationVehicule`, `mettreAJourFinContratVehicule`, `mettreAJourFormulaireVehicule`, `autoRemplirChauffeurDepuisVehicule`
- Entretiens : `ajouterEntretien`, `ouvrirModalEntretien`, `autoFillKmEntretien`
- Inspections : `ajouterInspectionAdmin`, `ouvrirModalInspectionAdmin`, `filtrerInspParSalarieInput`
- Incidents : `ajouterIncident`, `confirmReject`, `confirmResolve`
- Heures : `naviguerHeuresPeriode`, `changerVueHeures`, `reinitialiserHeuresPeriode`, `afficherCompteurHeures`
- Planning : `ouvrirModalPlanning`, `ouvrirPlanningRecurrence`, `ajouterPeriodeAbsence`, `naviguerPlanningPeriode`, `changerVuePlanning`, `reinitialiserPlanningPeriode`, `copierSemainePrecedente`, `sauvegarderPlanning`, `ouvrirEditionTravailRapide`
- Stats : `navStatsPeriode`, `changerVueStats`, `reinitialiserStatsPeriode`, `exporterStatsPDF`
- TVA : `navTvaPeriode`, `changerVueTVA`, `reinitialiserTVAPeriode`, `exporterTvaCSV`, `exporterTvaPDF`
- Rentabilité : `genererRentabilitePDF`, `exporterRapportRentabilitePDF`, `changerSousOngletRentabilite`, `rentabiliteAppliquerPrixCarburantReel`, `rentabiliteChargerChargesReelles`, `rentabiliteChargerDepuisVehicule`, `enregistrerConfigRentabilite`, `ouvrirConfigRentabilite`, `alerteRentabilite`
- Exports / PDF : `exporterCharges`, `exporterChargesPDFMois`, `exporterEntretiens`, `exporterEntretiensPDF`, `exporterHistoriqueClientsCSV`, `exporterHistoriqueClientCourant`, `exporterHistoriqueFournisseursCSV`, `exporterJournalAuditCSV`, `exporterLivraisons`, `exporterPlanningSemainePDF`, `exporterRapportHeuresEtKmPDF`, `exporterRecapHeures`, `exporterRecapHeuresPDF`, `exporterReleveKmPDF`, `exporterSauvegardeAdmin`, `exporterDonneesRGPDClientCourant`, `exporterVehiculesPDF`, `genererRapportClients`, `genererRapportFournisseurs`, `genererRapportMensuelPeriode`
- Drawers 360° (S20/S21/S25) : `ouvrirFiche360Salarie`, `ouvrirFiche360Vehicule`, `ouvrirFiche360Client`, `ouvrirFiche360Fournisseur`, `s20SwitchTab`, `s20GoToHeures`, `s20GoToEdit`, `s21GoToCarburant`, `s21GoToEntretiens`, `s21GoToEdit`, `s25*`, `s26*`, `s28*`, `s29*`, `s24*`, `s19*`
- Paramètres : `sauvegarderConfigurationTresorerie`, `sauvegarderConfigurationTVA`, `sauvegarderParametres`, `sauvegarderMaxTentatives`, `appliquerAccentColor`, `changerLogoEntreprise`, `supprimerLogoEntreprise`, `toggleParamMdp`, `changerMdpAdmin`, `confirmerResetMdp`, `executerResetCompteur`, `enregistrerConfigAnomaliesCarburant`, `ouvrirConfigAnomaliesCarburant`, `ajouterPoste`, `viderAlertes`, `viderJournalAudit`, `importerSauvegardeAdmin`
- Dashboard / divers : `ouvrirRechercheGlobale`, `fermerRechercheGlobale`, `rechercheUniverselle`, `togglePanneauAgent`, `togglePlanningQuickPanel`, `reinitialiserFormulairePlanningRapide`, `toggleTheme`, `toggleFormulaireNewSalarie`, `declencherInstallPWA`, `deconnexionAdmin`, `ouvrirTimelineGlobale`, `ouvrirSignatureBL`

---

## Section 2 — Découpage proposé

### 2.1 Règles directrices

1. **Helpers globaux** (escapeHtml, euros, formatDate, lireStockageJSON, openModal, closeModal, afficherToast, ouvrirPopupSecure, etc.) → **restent boot**, dans un nouveau `script-core-bootstrap.js`.
2. **Bootstrap admin** (DOMContentLoaded async, auth, navigation initiale) → **boot obligatoire** dans `script-core-bootstrap.js`.
3. **Toute fonction appelée uniquement après clic** sur un onglet ou un bouton ciblé → **lazy** via `lazyCreateStub`, comme déjà fait pour `script-exports`.
4. **Sprints UI globaux** (toasts S10, drawer S5, pagination S7, tri S8/S18, empty states S9, form intelligent S11) → boot, mais regroupés dans un seul `script-core-sprints-ui.js` (chargé non-render-blocking).
5. **Sprints "feature" lourds** (S16 calendrier, S19 alertes, S20 RH, S21 Parc, S25 drawer 360°, S26 timeline, S29 paramètres) → **lazy** par leur onglet déclencheur.

### 2.2 Tableau de découpage

| Nouveau fichier | Contenu | Lignes | Taille | Mode chargement | Trigger lazy |
|---|---|---|---|---|---|
| `script-core-bootstrap.js` | Helpers Date proto, lifecycle patches, storage cache, validerSIRET, popup secure, genId, prompt, modals, navigation init, DOMContentLoaded admin (auth + listeners + warmup) | ~1 100 | ~50 Ko | **Boot (defer)** | — |
| `script-core-charts.js` | `ensureChartJs`, `mcaChartGradient`, `mcaChartBaseOptions`, état `chartActivite/chartRentab/…`, `rafraichirDashboard` | ~400 | ~20 Ko | **Lazy** : 1ʳᵉ entrée onglet `dashboard` | `naviguerVers('dashboard')` |
| `script-core-sprints-ui.js` | Sprints 5 (drawer), 7 (pagination), 8 (tri sprint), 9 (empty states), 10 (toasts), 11 (forms), 18 (tri th) — toutes fonctions UI génériques | ~1 200 | ~70 Ko | **Boot après idle** (defer + setTimeout 0) — cf §3.4 | — |
| `script-livraisons-admin.js` | Vue Kanban, vue Calendrier livraisons, `renderLivraisonsAdminFinal` (FINAL ADMIN LOCK + ADMIN FINAL UX), `mcaLivForm` (validation form) | ~700 | ~35 Ko | **Lazy** : entrée onglet `livraisons` ou ouverture modal-livraison | navigation onglet |
| `script-livraisons-bulk.js` | SPRINT 6 — `bulkMarquerPayees`, `bulkSupprimer`, `bulkExporter`, `bulkExporterPDF`, `bulkClear`, `bulkMarquerLivrees`, `toggleBulkSelectAll`, `majBulkActions` | ~315 | ~17 Ko | **Lazy stubs** | premier appel bulk |
| `script-planning-admin.js` | PLANNING REWRITE FINAL + PLANNING REWRITE + helpers `planningSyncSearchWithSelect`, gestion absences | ~1 800 | ~96 Ko | **Lazy** | navigation `planning` |
| `script-rentabilite-resid.js` | Résidu calculateur rentabilité (clé storage v2, helpers, fonction `genererRapportRentabilite` finale) — à fusionner dans `script-rentabilite.js` existant | ~120 | ~6 Ko | **Lazy** (déjà chargé avec script-rentabilite) | navigation `rentabilite` |
| `script-calendrier-s16.js` | SPRINT 16 — Calendrier opérationnel complet | ~640 | ~32 Ko | **Lazy** | navigation `calendrier` |
| `script-alertes-centre-s19.js` | SPRINT 19 — Centre alertes unifié | ~460 | ~24 Ko | **Lazy** | navigation `alertes` ou `incidents` |
| `script-fiche360-rh-s20.js` | SPRINT 20 — Fiche 360° RH + auto-alertes | ~475 | ~25 Ko | **Lazy** | clic sur ligne salarié OU navigation `equipe` |
| `script-fiche360-parc-s21.js` | SPRINT 21 — Fiche 360° Parc + auto-alertes | ~440 | ~22 Ko | **Lazy** | clic sur ligne véhicule OU navigation `parc` |
| `script-fiche360-tiers-s25.js` | SPRINT 25 — Drawer 360° Client/Fournisseur + règles alertes | ~520 | ~26 Ko | **Lazy** | clic ligne client/fournisseur |
| `script-cron-s24.js` | SPRINT 24 — Automatisations (cron rappels, escalades, raccourcis Enter/Esc/N/E/Ctrl+S) | ~370 | ~19 Ko | **Boot après idle** (cron 60 s, mais raccourcis attendus) | — |
| `script-timeline-s26.js` | SPRINT 26 — Timeline globale + stats comparées + double-clic inline + signature BL | ~590 | ~30 Ko | **Lazy** | clic onglet `timeline` ou bouton signature |
| `script-parametres-s29.js` | SPRINT 29 — Refonte Paramètres pro + bloc gestion postes (lignes 3138–3246) + config trésorerie | ~520 | ~25 Ko | **Lazy** | navigation `parametres` |
| `script-pgi-s15.js` | SPRINT 15 — Productivité PGI (auto-création client, badge orpheline, copies, Z quotidien) | ~250 | ~12 Ko | **Lazy** | navigation `factures` ou `livraisons` |
| `script-cmd-palette-s3.js` | SPRINT 3 — Command Palette Ctrl+K | ~250 | ~13 Ko | **Lazy** | au 1ᵉʳ Ctrl+K (pas avant) |
| `script-exports-pdf-templates.js` | `ouvrirFenetreImpression`, `construireEnteteExport`, `genererLettreDeVoiture`, `genererRegistreRGPD`, `genererFicheTournee` | ~700 | ~35 Ko | **Lazy** | bouton "Lettre de voiture", "Registre RGPD", "Fiche tournée" |
| `script-fusion-hubs-s22.js` | SPRINT 22+23 — Hubs sidebar + SPRINT 2 sidebar repliable + SPRINT 28 cleanup | ~400 | ~18 Ko | **Boot** (UI nav, doit être prêt à l'init) — synchrone car déjà appelé via `__s22InitSidebar` au DOMContentLoaded | — |
| `script-misc-resid.js` | Résiduel : `mettreAJourSelects`, `changerStatutPaiement`, `resetFiltres`, `verifierNotificationsAutomatiquesMois2`, `genererGrilleJours`, `genererMotDePasseFort`, `evaluerQualiteMotDePasse`, MODELES_MESSAGES, TEMPLATES_SMS, polling synchro admin, etc. | ~700 | ~35 Ko | **Boot après idle** | — |

### 2.3 Cumul

- **Boot critique** (avant interactivité) : `script-core-bootstrap` + `script-fusion-hubs-s22` ≈ **70 Ko** (vs ~664 Ko aujourd'hui).
- **Boot déféré** (`requestIdleCallback`) : `script-core-sprints-ui` + `script-core-charts` (si dashboard est la home) + `script-cron-s24` + `script-misc-resid` ≈ **160 Ko** supplémentaires.
- **Lazy à la demande** : ~430 Ko répartis sur 13 modules.

---

## Section 3 — Stratégie compatibilité (NE PAS CASSER les `onclick`)

### 3.1 Mécanisme déjà en place (à étendre)

Le mécanisme `lazy-stubs.js` actuel (pour `script-exports`) installe avant le boot d'admin un stub `window.exporterCSV = lazyCreateStub('script-exports', 'exporterCSV')`. Au 1ᵉʳ clic, le stub :
1. Appelle `lazyLoadModule('script-exports')` → injecte `<script src="script-exports.js">` (ordre `async=false` préservé).
2. Une fois chargé, le module a écrasé `window.exporterCSV` par la vraie fonction.
3. Le stub appelle `realFn.apply(self, args)` avec les arguments d'origine.

**Limite actuelle** : la 1ʳᵉ invocation est asynchrone — l'utilisateur clique, attend ~50–200 ms, puis l'action se déclenche. Acceptable pour un export PDF, mais **pas pour `naviguerVers(page)`** qui doit être synchrone.

### 3.2 Patterns à appliquer pour chaque famille

| Famille | Pattern | Notes |
|---|---|---|
| Boutons d'export PDF (`exporterX`) | `lazyCreateStub` standard | Pattern existant, OK |
| Boutons d'action métier (`ajouterX`, `supprimerX`, `ouvrirEditX`) | `lazyCreateStub` mais préfetch silencieux à l'entrée de l'onglet | Réduit la latence du 1ᵉʳ clic |
| Navigation `naviguerVers(page)` | **Modifier `naviguerVers` lui-même** dans `script-core-navigation.js` : avant d'afficher la page X, faire `await lazyLoadModule(MODULE_PAR_PAGE[page])` | C'est la pierre angulaire. Préfetch fluide. |
| Drawers 360° (S20/S21/S25) | `lazyCreateStub` ; le 1ᵉʳ clic ouvre un overlay vide en 1 frame, charge le module, puis le drawer s'auto-render | UX acceptable si overlay visible immédiatement |
| Raccourcis clavier (S24) | Module S24 chargé en boot après idle (50 ms) — sinon le raccourci ne marche pas au 1ᵉʳ appui | Garder boot |
| `s19*`, `s20*`, `s25*`, `s26*`, `s29*` exposés en `window.X` | Déclarer le stub correspondant dans `lazy-stubs.js` | À ajouter au tableau `EXPORTS_FUNCTIONS` (renommer fichier `lazy-stubs.js` ou faire plusieurs blocs) |

### 3.3 Mapping à ajouter à `lazy-stubs.js`

Étendre `lazy-stubs.js` avec une **table `MODULE_FUNCTIONS`** :

```text
MODULE_FUNCTIONS = {
  'script-livraisons-admin': ['renderLivraisonsAdminFinal', 'dragKanban', 'dropKanban', ...],
  'script-livraisons-bulk':  ['bulkMarquerPayees', 'bulkSupprimer', 'bulkExporter', 'bulkExporterPDF',
                              'bulkClear', 'bulkMarquerLivrees', 'toggleBulkSelectAll', 'majBulkActions'],
  'script-planning-admin':   ['ouvrirEditionTravailRapide', 'reinitialiserFormulairePlanningRapide',
                              'sauvegarderPlanning', 'planningSyncSearchWithSelect', ...],
  'script-calendrier-s16':   ['cal16', '_calMois', 'calNaviguer'],
  'script-alertes-centre-s19': ['s19RenderCentre', 's19RefreshNow', 's19MarquerTraitee', 's19EncaisserFacture',
                                's19GoFacture', 's19GoFournisseur', 's19GoLivraison', 's19IncidentStatut',
                                's19IncidentSupprimer', 's19Rouvrir', 's19Supprimer'],
  'script-fiche360-rh-s20':   ['ouvrirFiche360Salarie', 's20SwitchTab', 's20GoToHeures', 's20GoToEdit'],
  'script-fiche360-parc-s21': ['ouvrirFiche360Vehicule', 's21GoToCarburant', 's21GoToEntretiens', 's21GoToEdit'],
  'script-fiche360-tiers-s25':['ouvrirFiche360Client', 'ouvrirFiche360Fournisseur', 's25SaveRule',
                               's25DelRule', 's25ToggleRule', 's25NewRule', 's25EvaluerRegles',
                               's25FermerDrawer'],
  'script-timeline-s26':      ['ouvrirTimelineGlobale', 'ouvrirSignatureBL', 's26EnregistrerSig',
                               's26EffacerSig', 's26SaveFactureEcheance', 's26SaveFactureMontant',
                               's26SaveFactureStatut', 's26SaveLivraisonStatut',
                               's26VerifierChaineSignatures'],
  'script-parametres-s29':    ['ajouterPoste', 'sauvegarderConfigurationTresorerie',
                               'chargerConfigurationTresorerieParametres', 'sauvegarderParametres'],
  'script-cmd-palette-s3':    ['ouvrirRechercheGlobale', 'fermerRechercheGlobale', 'rechercheUniverselle'],
  'script-exports-pdf-templates': ['genererLettreDeVoiture', 'genererRegistreRGPD',
                                   'genererFicheTournee', 'ouvrirFenetreImpression',
                                   'construireEnteteExport'],
  'script-pgi-s15':           ['... fonctions s15 ...']
}
```

Chaque module **doit** réassigner les `window.X` réels lors de son chargement (sinon le stub reste). À auditer module par module.

### 3.4 Imports croisés entre modules

Plusieurs sprints dépendent de helpers globaux (`escapeHtml`, `loadSafe`, `euros`, `afficherToast`, `ouvrirDrawer`). Solution :
- Ces helpers vivent dans `script-core-bootstrap.js` ou `script-core-utils.js` (déjà existant) → **chargés boot** → toujours disponibles quand un lazy se charge.
- Pour les dépendances inter-lazy (ex : S25 utilise `ouvrirDrawer` du S5) → S5 doit être boot (`script-core-sprints-ui.js`) — ce qu'on fait déjà.
- Cas spécial : S26 timeline utilise `s24CronTick` (auto-fact). Si S24 boot et S26 lazy, OK. **Inverse interdit**.

**Règle** : un module **lazy** ne peut dépendre que de modules **boot** ou d'autres lazy chargés AVANT (et c'est `lazyLoadModule` qui garantit l'ordre via `async=false`).

---

## Section 4 — Plan d'exécution étape par étape

> Chaque étape est testable indépendamment. Tag git après chaque étape pour rollback aisé.

### Étape 0 — Préparation (0.5 j)
- [ ] Créer une branche `refactor/bundle-split` depuis `claude/add-supabase-mcp-CuBe2`.
- [ ] Ajouter un script de mesure : `npm run measure-boot` (à créer) qui ouvre admin.html en headless Chromium et logge bytes JS chargés avant `domcontentloaded`.
- [ ] Sauvegarder une référence : `git tag baseline-bundle`.

### Étape 1 — Extraire helpers et bootstrap (1.5 j)
- [ ] Créer `script-core-bootstrap.js` avec lignes 1–700 + 784–1192 + 1009–1107 (modals + nav).
- [ ] Garder `<script defer src="script-core-bootstrap.js">` AVANT `<script defer src="script.js">` dans `admin.html`.
- [ ] Marquer dans `script.js` les blocs déplacés `// MOVED -> script-core-bootstrap.js : <fn>` (cohérent avec convention existante).
- [ ] **Test manuel** : login admin, dashboard s'affiche, sidebar fonctionne.
- [ ] **Test auto** : `npm test` (Playwright) — smoke test connexion.
- [ ] Commit + tag `step-1-bootstrap`.

### Étape 2 — Extraire dashboard charts (1 j)
- [ ] Créer `script-core-charts.js` avec lignes 1339–1709 (`ensureChartJs`, `rafraichirDashboard`, helpers).
- [ ] Référencer `lazyLoadModule('script-core-charts')` dans `naviguerVers('dashboard')` (à modifier dans `script-core-navigation.js`).
- [ ] Stub `window.rafraichirDashboard` créé par `lazy-stubs.js`.
- [ ] **Test** : dashboard se charge à <500 ms après navigation, KPIs et graphiques OK.
- [ ] Commit + tag `step-2-charts`.

### Étape 3 — Extraire sprints UI génériques (2 j)
- [ ] Créer `script-core-sprints-ui.js` (S5, S7, S8, S9, S10, S11, S18) — lignes 7246–8826 + 9714–9873.
- [ ] Charger en boot `defer` (après `script-core-bootstrap.js`).
- [ ] **Test** : toasts apparaissent, drawer s'ouvre, pagination fonctionne, tri colonne marche.
- [ ] Commit + tag `step-3-sprints-ui`.

### Étape 4 — Extraire livraisons admin lourds (1.5 j)
- [ ] Créer `script-livraisons-admin.js` (Kanban, Calendrier, FINAL ADMIN LOCK, ADMIN FINAL UX, mcaLivForm) — lignes 2024–2186 + 4211–4877 + 13532–13612.
- [ ] Créer `script-livraisons-bulk.js` (S6) — lignes 7356–7669.
- [ ] Stubs ajoutés à `lazy-stubs.js`.
- [ ] **Test** : naviguer livraisons, vue tableau OK, vue Kanban OK, vue Calendrier OK, bulk actions OK.
- [ ] Commit + tag `step-4-livraisons`.

### Étape 5 — Extraire planning admin (1.5 j)
- [ ] Créer `script-planning-admin.js` lignes 4878–6654.
- [ ] Hook lazy via `naviguerVers('planning')`.
- [ ] **Test** : planning admin s'affiche, ajout absence, sauvegarde planning, export semaine OK.
- [ ] Commit + tag `step-5-planning`.

### Étape 6 — Extraire fiches 360° (S20, S21, S25) (2 j)
- [ ] Créer `script-fiche360-rh-s20.js`, `script-fiche360-parc-s21.js`, `script-fiche360-tiers-s25.js`.
- [ ] Stubs `ouvrirFiche360Salarie`, `ouvrirFiche360Vehicule`, `ouvrirFiche360Client`, `ouvrirFiche360Fournisseur`.
- [ ] **Test** : clic ligne salarié → drawer 360° RH s'ouvre <300 ms, contenu OK ; idem véhicule, client, fournisseur.
- [ ] **Régression** : auto-alertes RH/Parc déclenchent encore (vérifier que le cron S24 charge S20/S21 si besoin OU que les alertes vivent dans S24 / un module dédié).
- [ ] Commit + tag `step-6-fiches360`.

### Étape 7 — Extraire calendrier S16 + alertes S19 + paramètres S29 (1.5 j)
- [ ] Créer 3 modules. Lazy via `naviguerVers('calendrier' | 'alertes' | 'parametres')`.
- [ ] **Test** : navigation chacune des 3 pages OK.
- [ ] Commit + tag `step-7-features-lazy`.

### Étape 8 — Extraire timeline S26 + signature BL + PGI S15 + Cmd Palette S3 (1 j)
- [ ] Créer 4 petits modules.
- [ ] **Test** : Ctrl+K ouvre palette ; bouton "Timeline globale" charge S26 ; auto-création client (S15) OK.
- [ ] Commit + tag `step-8-misc-lazy`.

### Étape 9 — Extraire templates exports PDF (1 j)
- [ ] Créer `script-exports-pdf-templates.js` (lignes 2700–2790, 3410–3630, 4211–4423).
- [ ] Compléter `lazy-stubs.js`.
- [ ] **Test** : bouton "Lettre de voiture" depuis livraison → PDF s'ouvre. "Registre RGPD" depuis paramètres → PDF s'ouvre.
- [ ] Commit + tag `step-9-pdf-templates`.

### Étape 10 — Cleanup (0.5 j)
- [ ] Le `script.js` résiduel devrait être <500 lignes (juste des `// MOVED` et le code `script-misc-resid.js` non encore extrait).
- [ ] Extraire le résidu vers `script-misc-resid.js` ou supprimer `script.js` complètement.
- [ ] **Test régression complet** (Playwright full suite).
- [ ] Commit + tag `step-10-cleanup`.

### Tests entre chaque étape
- Smoke test Playwright : login admin + navigation dashboard + livraisons + planning.
- Manuel : Chrome DevTools "Coverage" pour vérifier la baisse du bundle initial.
- Manuel : DevTools Network throttling 4G → mesurer Time-To-Interactive.
- Vérifier console JavaScript : aucune erreur "X is not a function" (signe d'un stub non câblé).

### Estimation effort total
- ~12.5 jours-homme (solo, expérimenté JS vanilla).
- Réaliste avec tests : **15 jours-homme**.

---

## Section 5 — Estimation gain

### Avant (état actuel)

Hors librairies CDN tierces, le boot admin charge :
- `monitoring.js` 7.7 Ko + `supabase-*` 25 Ko + `security-utils.js` 6 Ko
- `script-core-*` (10 fichiers) 75 Ko
- `entity-*-adapter` + `repo.js` 100 Ko
- `script-livraisons.js` 44 Ko + `script-planning.js` 43 Ko + `script-rentabilite.js` 35 Ko + `script-tva.js` 30 Ko + `script-vehicules.js` 49 Ko + `script-charges.js` 32 Ko + `script-clients.js` 30 Ko + `script-salaries.js` 51 Ko + `script-alertes.js` 30 Ko + ... ~ **400 Ko** d'autres scripts métiers (déjà séparés mais TOUS chargés au boot).
- `script.js` **664 Ko**
- `script-mobile.js` (513 Ko, mais pas chargé sur admin.html : à vérifier — il est dans `m.html` / `salarie.html`).

**Total JS admin au boot** : **~1,3 Mo non gzippé / ~350 Ko gzippé**, dont `script.js` représente ~50 % du payload.

### Après refactor

| Catégorie | Taille brute | Taille gzippée |
|---|---|---|
| Boot critique (core-bootstrap + helpers + adapters Supabase + fusion-hubs-s22) | ~250 Ko | ~80 Ko |
| Boot après idle (sprints UI, charts, cron, misc) | ~160 Ko | ~50 Ko |
| Lazy on-demand (planning, livraisons-admin, fiches 360°, calendrier, ...) | ~430 Ko | ~130 Ko |

**Boot initial : ~250 Ko (gain ~80 % vs aujourd'hui).**

### Gain Time-To-Interactive estimé

- Réseau 4G médian (1.5 Mbps download, 70 ms RTT) :
  - Avant : ~1.3 Mo à parser → TTI ~3.5 s
  - Après : ~250 Ko critiques → TTI ~1.0 s, puis 160 Ko en background.
- 3G slow (400 Kbps) :
  - Avant : TTI ~10 s
  - Après : TTI ~3 s.

Gain TTI estimé : **-65 % à -75 %** selon la qualité réseau.

---

## Section 6 — Risques et plan de rollback

### 6.1 Régressions probables

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| `onclick="X()"` casse parce que le stub n'a pas remplacé `window.X` | Moyenne | Critique | Audit ligne par ligne du fichier extrait, vérifier que chaque fonction publique fait `window.X = X` à la fin. Test Playwright qui clique sur tous les boutons principaux. |
| Ordre d'init cassé (ex : `__s22InitSidebar` est appelé au DOMContentLoaded et S22 est encore en lazy) | Moyenne | Élevé | Maintenir S22 en boot. Noter explicitement que tout module avec un init synchrone DOMContentLoaded reste boot. |
| Race condition : un module lazy A appelle une fonction d'un module lazy B pas encore chargé | Faible | Moyen | Tous les inter-modules passent par `await lazyLoadModule('B')` avant l'appel. Documenter dans chaque module en tête. |
| Variables module-scope `let _editLivId = null;` perdues lors du split (deviennent inaccessibles aux autres modules) | Élevée | Moyen | Identifier toutes les variables `let`/`var` au top-level de `script.js` (~60 occurrences). Pour chaque variable lue ailleurs : exposer sur `window` OU déplacer dans un objet partagé `window.__mcaState = {}`. |
| Service Worker `sw.js` cache l'ancien `script.js` même après split (les utilisateurs ne voient pas le refactor) | Moyenne | Élevé | Bumper la version `?v=…` dans toutes les balises `<script>` en même temps. Vérifier la stratégie de cache du SW (déjà network-first sur HTML, donc OK pour admin.html, mais cache-first sur les .js → forcer purge). |
| Dépendance circulaire (S26 ↔ S24 par exemple) | Faible | Élevé | Cartographier les appels inter-sprint avant d'extraire (un `grep -rE "s24\\\|s26\\\|s25"` dans chaque module). |
| Onclick en double dans `<button onclick="exporterX()">` : si `exporterX` est dans un module lazy, le 1ᵉʳ clic est asynchrone et l'utilisateur peut re-cliquer → action lancée 2 fois | Élevée | Moyen | Le double-click guard existant (`__delivproDoubleClickGuardInstalled`, lignes 59–93) couvre déjà ça. Vérifier qu'il fonctionne pour les actions lazy. |

### 6.2 Plan de rollback

À chaque étape : `git tag step-N`. En cas de régression non triviale détectée en prod :

```bash
git revert --no-commit step-N..HEAD
git commit -m "Rollback bundle split étape N"
git push
# Cloudflare Pages redéploie en <2 min.
```

Plan B (rollback total) : revenir au tag `baseline-bundle`. Comme `script.js` n'est pas supprimé tant que l'étape 10 n'est pas validée, un rollback partiel est toujours possible jusqu'à l'étape 9.

### 6.3 Métriques de surveillance post-déploiement

- **Sentry / monitoring.js** : surveiller spike d'erreurs `is not a function` (signature classique d'un stub manquant).
- **Logs Cloudflare** : vérifier que tous les `script-*.js` retournent 200 (pas de 404 sur un nouveau fichier non publié).
- **Analytics RUM** : mesurer TTI réel sur les 7 jours suivants.

---

**FIN DU PLAN.**
