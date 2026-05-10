# 02 — IDs / data-* / onclick à PRÉSERVER

**Source :** extraction automatique de `script.js` (14 038 lignes). Tout ce qui suit est lu activement par le JS prod. Les renommer ou supprimer **casse** la fonctionnalité associée.

## A. IDs lus par `getElementById` / `querySelector('#…')` — 199 entrées

### Dashboard / KPIs

```
kpi-alertes              kpi-benefice           kpi-ca-mois
kpi-depenses-detail      kpi-incidents          kpi-objectif-liv-pct
kpi-objectif-pct         kpi-ponctualite        kpi-sante-detail
kpi-sante-globale        kpi-sante-label        kpi-seuil-label
kpi-solde                kpi-travaillent        kpi-tva-detail
kpi-tva-label
sante-ring-fg           sante-ring-score
dashboard-ct-banner
```

### Tableaux principaux (`tb-*`)

```
tb-charges               tb-chauffeurs          tb-clients
tb-factures              tb-fournisseurs        tb-heures
tb-livraisons            tb-livraisons-recentes tb-planning-semaine
tb-releve-km             tb-salaries            tb-vehicules
thead-planning-semaine
```

### Charts (`<canvas>`)

```
chartActivite     chartCA            chartCAParChauffeur
chartChauffeurs   chartPrevision     chartRentabilite
chartVehicules
```

### Filtres

```
filtre-carb-vehicule    filtre-chauffeur       filtre-date-debut
filtre-date-fin         filtre-entr-vehicule   filtre-heures-salarie
filtre-paiement         filtre-planning-salarie filtre-recherche-liv
filtre-statut
```

### Modales / Drawers

```
modal-livraison         modal-planning
side-drawer             side-drawer-body       side-drawer-overlay
side-drawer-title
s20-drawer              s20-drawer-content     s20-drawer-overlay
s20-drawer-title
s25-drawer              s25-drawer-overlay
```

### Planning

```
plan-jours-grid         plan-salarie           plan-salarie-search
plan-total-heures
planning-edit-work-btn  planning-kpi-absences  planning-kpi-planifies
planning-kpi-salaries   planning-semaine-dates planning-semaine-label
planning-submit-btn
```

### Alertes (Sprint 19 / 25)

```
s19-centre              s19-centre-body        s19-filter-gravite
s19-filter-source       s19-filter-statut      s19-kpis
s19-search
s25-rule-field          s25-rule-grav          s25-rule-nom
s25-rule-op             s25-rule-trigger       s25-rule-value
s25-rules-list          s25-rules-section
```

### Stats / Rentabilité

```
stats-ca-periode        stats-km-total         stats-livraisons-periode
stats-mois-dates        stats-mois-label       stats-panier-moyen
rent-ca                 rent-carb              rent-charges
rent-cout-km            rent-entretien         rent-marge
rent-mois-dates         rent-mois-label        rent-profit
prev-benefice           prev-ca                prev-depenses
prev-livraisons-calc    prev-marge             prev-tendance
```

### Pages (containers)

```
page-alertes            page-calendrier        page-parametres
page-planning           mainContent
```

### Sidebar / Nav

```
sidebar                 sidebarOverlay         sidebar-mobile-overlay
toggleSidebar           menuMobile
badge-alertes           badge-incidents-nav
```

### Bulk actions

```
bulk-action-bar         bulk-count-num         bulk-select-all
```

### Carburant / Charges

```
charges-mois-label      vue-charges-select
cal-mois-label          cal16-grid             cal16-label
cal16-sub               cal16-vue
calendrier-grid
```

### Absences / Postes

```
absence-debut           absence-edit-id        absence-fin
absence-heure-debut     absence-heure-debut-wrap
absence-heure-fin       absence-heure-fin-wrap
absence-sal             absence-sal-datalist   absence-sal-search
absence-type
liste-absences-periodes liste-postes           liste-travaillent
nouveau-poste
```

### Édition / Notes

```
edit-client-id          edit-liv-chauffeur     edit-sal-vehicule
note-interne-sal-id     note-interne-sal-nom   note-interne-texte
inc-livraison
liv-calc-summary        liv-chauffeur          liv-vehicule
nsal-vehicule
```

### Trésorerie

```
param-treso-echeance-tva param-treso-helper    param-treso-solde-depart
```

### Sprint-specific (Alertes IA / Templates / Signature)

```
s11-* (progression)     s15-modal-info         s15-palette
s15-palette-input       s15-palette-results    s22-bandeau
s24-params-section
s26-params-card         s26-params-section     s26-sig-canvas
s26-sig-nom             s26-sig-qualite        s26-tl-acteur
s26-tl-au               s26-tl-du              s26-tl-list
s26-tl-search           s26-tl-summary
```

### Misc

```
btn-densite             btn-density-compact    btn-density-normal
btn-install-pwa         btn-scroll-top
barre-recherche-univ    recherche-resultats
ponctualite-container   panel-modeles          modeles-msg-list
templates-sms-list      msg-admin-input
card-alertes-traitees   alertes-categories
currentDate
toast                   ptr-indicator
tco-detail              tco-veh-nom
kanban-board
vue-planning-select     vue-stats-select
```

## B. data-* attributes lus par JS

| data-attr | Lu par | Usage |
|-----------|--------|-------|
| `data-page` | nav router | identifie la page courante : `dashboard`, `livraisons`, `charges`, `carburant`, `entretiens`, `vehicules`, `equipe`, `planning`, `alertes`, `rentabilite`, `parametres`, `calendrier` |
| `data-section` | sub-router | `data-section="hub"`, etc |
| `data-tab` | tabs internes | conserver sur `<button>` ou `<a>` onglet |
| `data-panel` | drawer panels | |
| `data-livraison-id` / `data-livraisonId` | row livraison | UUID livraison |
| `data-evId` | calendrier évènement | |
| `data-salId` | row salarié | |
| `data-idx` | items numérotés | |
| `data-date` | cellules planning / calendrier | format `YYYY-MM-DD` |
| `data-cal-filter` / `data-calFilter` | filtres calendrier | |
| `data-cmd-action` / `data-cmd-entity` / `data-cmd-handler` | command palette | |
| `data-pagination-go` / `data-pagination-key` / `data-pagination-perpage` | pagination tableaux | |
| `data-sort-key` | tri colonnes | sur `<th>` |
| `data-drag-type` / `data-dragId` | kanban drag | |
| `data-recurrent` | charges récurrentes | `"1"` / absent |
| `data-section` (s29) | sprint 29 | |
| `data-s24-key` / `data-s24Key` / `data-s24Label` | params s24 | |
| `data-s25-*` | rules engine alertes | |
| `data-s26-*` | sprint 26 (signature, timeline) | |
| `data-s28-client` / `data-s28-fourn` | drawer clients/fournisseurs | |
| `data-s29-section` / `data-s29-target` | sprint 29 | |
| `data-s11-progress` / `data-sprint11` | onboarding sprint 11 | |
| `data-s22-hidden` | sprint 22 toggle | |
| `data-toast-id` | toast dismissible | |
| `data-bound` / `data-cmdBound` / `data-instantBound` / `data-sortBound` / `data-s11Bound` | flags anti-double-bind, **important** : si tu réécris le HTML, ne pas réinjecter ces attrs (ils seront ré-ajoutés au runtime) |
| `data-copy` | bouton copier | |
| `data-label` | accessibilité fallback | |
| `data-moreDate` | calendrier "voir plus" | |
| `data-dismissing` | toast en cours de dismiss | runtime, ne pas mettre dans HTML |

## C. Fonctions appelées via `onclick="…"` (HTML statique + généré)

**Doivent rester globales (window.X) après refonte.**

```
copierTemplateSMS         editerPeriodeAbsence
filtrerCalJour            genererRegistreRGPD
openModal                 closeModal
ouvrirEditClient          ouvrirEditKmAdmin
ouvrirEditLivraison       ouvrirFicheVehiculeDepuisTableau
ouvrirRecapPlanningPeriode
planningOuvrirFicheSalarie
planningOuvrirSaisieRapide
supprimerAbsencePeriode   supprimerKmAdmin
supprimerPoste            utiliserModele
```

Plus toutes ces fonctions globales utilisées soit dans `onclick` soit comme entrées de menu (33 totales) :

```
afficherCalendrier        afficherKanban         afficherModelesMessages
afficherPonctualite       afficherPostes         afficherReleveKm
afficherTCO               afficherTemplatesSMS   afficherToast
afficherDocumentDansFenetre
fermerDrawer              fermerMenuMobile
genererAlertesParc        genererAlertesRH       genererFicheTournee
genererGrilleJours        genererLettreDeVoiture genererMotDePasseFort
ouvrirDetailJour          ouvrirMenuMobile       ouvrirModal
ouvrirNoteInterne         ouvrirSignatureBL      ouvrirTCO
ouvrirTimelineGlobale     supprimerPoste
toggleMenuCarbAdmin       togglePanelModeles     toggleTypeJour
toggleVueCompacte         validerSIRET           chargerConfigurationTresorerieParametres
```

## D. Règles d'or pour la refonte

1. **Ne jamais renommer un ID** de la liste A. Si une refonte change la sémantique (ex KPI déplacé), garder l'ID ancien sur le nouvel élément.
2. **Ne jamais retirer un `data-*`** de la liste B. S'il devient inutile visuellement, le laisser quand même (le JS le lit).
3. **Ne jamais convertir un `onclick="foo()"` en `addEventListener`** sans audit complet. Le JS prod réinjecte parfois du HTML qui contient ces handlers.
4. **Conserver l'ordre DOM des `tb-*`** : certains scripts accèdent aux rows par index.
5. Si tu réécris une modale (`modal-livraison`, `modal-planning`, `side-drawer`, `s20-drawer`, `s25-drawer`), **garder l'arborescence** : overlay sibling + container avec `id`, body avec `id` séparé, title avec `id` séparé.
