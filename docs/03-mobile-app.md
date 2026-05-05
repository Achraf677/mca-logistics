# 03 — Application mobile

L'app mobile a deux faces : **`m.html`** pour les admins en mobilité, et
**`salarie.html`** pour les chauffeurs.

## Architecture mobile

### `m.html` — Shell admin mobile

Shell ultra-léger (~8 Ko) qui :
- Charge les adapters Supabase et `script-mobile.js`.
- Expose un objet `M` global (registre de pages, navigation, état).
- Affiche un header compact, une barre d'onglets en bas (5 entrées :
  Dashboard, Livraisons, Planning, Alertes, Plus), un drawer "Plus" qui
  liste tous les autres modules.

Pages enregistrées via `M.register('id', { title, render, after })` —
mécanisme similaire à un mini-router. Chaque page rend son HTML dans
`<main id="m-content">`.

### `salarie.html` — Page séparée chauffeur

Page **autonome** (52 Ko, son propre CSS inline et son propre JS via
`script-salarie.js` 117 Ko). Pas de partage de code avec `script-mobile.js`
(décision historique : flux salarié strictement isolé pour limiter la
surface).

Onglets (barre haute, scrollable horizontalement) :
1. **Accueil** — KPIs perso, raccourcis vers livraisons / inspection.
2. **Livraisons** — liste des livraisons assignées, statut, signature client.
3. **Planning** — mes jours travaillés, absences déclarées.
4. **Carburant** — saisie pleins, photo ticket, OCR auto.
5. **Inspection & Km** — relevé km début/fin, inspection véhicule hebdo.
6. **Messages** — chat avec l'admin (texte + photos + fichiers).
7. **Profil** — mot de passe, déconnexion, install PWA.

## Pages `m.html` (admin mobile)

22 routes enregistrées dans `script-mobile.js` (`M.register(...)`).

### Vue d'ensemble (parité PC, score audit 2026-05-04)

| # | Route | Titre | Score | Notes critiques |
|---|---|---|---|---|
| 1 | `dashboard` | Accueil | 84 % | KPIs perso, activité 7 j, "Qui travaille aujourd'hui" |
| 2 | `livraisons` | Livraisons | 84 % | Accordéon par mois, FAB +, bulk actions |
| 3 | `planning` | Planning | 69 % | **Pas de nav semaine** (gap parité PC) |
| 4 | `alertes` | Alertes | 84 % | Filtre statut + recherche |
| 5 | `encaissement` | Encaissement | 83 % | Liste statut, pas de filtre période |
| 6 | `charges` | Charges | 82 % | Accordéon mois, pas de nav période |
| 7 | `carburant` | Carburant | 81 % | Accordéon, pas de nav période |
| 8 | `rentabilite` | Rentabilité | 75 % | Barre stack uniquement (pas de doughnut Chart.js) |
| 9 | `clients` | Clients | 87 % | Liste + recherche, fiche détail |
| 10 | `fournisseurs` | Fournisseurs | 87 % | Idem clients |
| 11 | `vehicules` | Véhicules | 81 % | Carte grise upload, OCR |
| 12 | `entretiens` | Entretiens | 83 % | KPI mois courant figé |
| 13 | `inspections` | Inspections | 81 % | Photos visibles, pas de lightbox |
| 14 | `salaries` | Salariés | 84 % | Liste + détail, drawer 360° absent |
| 15 | `heures` | Heures & Km | 83 % | Dropdown 12 mois, reset auto v3.57 |
| 16 | `incidents` | Incidents | 79 % | Filtre statut |
| 17 | `tva` | TVA | 71 % | **Pas de saisie TVA mixte / manuelle** |
| 18 | `statistiques` | Statistiques | 83 % | SVG inline 12 mois |
| 19 | `calendrier` | Calendrier | 76 % | Vue jour/sem/mois/an mais moins riche que PC |
| 20 | `recherche` | Recherche globale | 92 % | Point fort de l'app |
| 21 | `audit` | Journal d'audit | 80 % | Outil debug |
| 22 | `parametres` | Paramètres | 69 % | **Très limité** vs PC (régime TVA, mdp, thème, logout) |

Source détaillée : [`archive/2026-05-04-site-readiness.md`](./archive/2026-05-04-site-readiness.md).

### Fonctionnalités présentes vs manquantes (parité)

**Présentes mobile uniquement** : accordéons par mois (livraisons /
charges / carburant / encaissement), FAB + saisie rapide, pull-to-refresh.

**Manquantes vs PC** :
- Drawer 360° client/fournisseur/véhicule/salarié (PC SPRINT 20-25-28).
- Charts Chart.js (Rentabilité doughnut, Stats CA/chauffeur).
- Saisie TVA mixte / taux libre.
- Édition entreprise, gestion postes, sauvegarde JSON (Paramètres).
- Comparatif annuel multi-année dans Statistiques.
- Vue Kanban et Calendrier riches livraisons (PC SPRINT 16).
- Command Palette Ctrl+K (mais Recherche globale dédiée existe).

**Phrases "voir version PC" exposées à l'utilisateur** (à traiter) :
- Stats : "Pour les graphiques d'évolution annuelle, exports et comparatifs avancés, ouvre la version PC."
- Paramètres : "Modification de l'entreprise, gestion des utilisateurs, sauvegarde et options avancées sont sur la version PC."

### Helpers mobiles partagés (`script-mobile.js`)

- `M.go(page, params)` — navigation.
- `M.state.*` — état global (mois sélectionné par module, etc.).
- `M.moisKey()` — clé `YYYY-MM` du mois courant.
- `M.computePeriodeRange / renderPeriodeBar / wirePeriodeBar` —
  factory de barre de période (mois / semaine / jour). **Implémentée
  mais non utilisée en prod** (cf. plan d'harmonisation périodes).
- `M.sauvegarder(cle, data)` — wrapper localStorage qui déclenche le
  push Supabase.
- `M.toast(message)` — notification éphémère bas d'écran.
- `M.sheet(title, body, onSubmit)` — bottom sheet pour saisie rapide.
- `M.ocr.*` — OCR carte grise / facture / RIB / ticket carbu.

## Pages `salarie.html` (chauffeur)

### Onglet Accueil

- Salutation + prénom + véhicule affecté.
- KPI : livraisons aujourd'hui, km début / fin journée, dernier plein.
- Boutons d'action : "Voir mes livraisons", "Inspection véhicule", "Saisir un plein", "Messages admin".

### Onglet Livraisons

- Liste des livraisons assignées au chauffeur (filtre `salarie_id =
  auth.uid()` côté Supabase RLS).
- Détail : client, adresses départ/arrivée, contact, contraintes
  (heure, ADR, particularités).
- **Signature client** : zone signature tactile, photo BL signé.
- Statuts : en attente → en cours → livrée → litige.

### Onglet Planning

- Mes jours travaillés / repos / absences.
- Détail jour cliqué (heures, véhicule, type).
- Lecture seule : seul l'admin peut modifier le planning.

### Onglet Carburant

- Saisie d'un plein : montant, litres, km, photo ticket.
- **OCR** : photo ticket → propose auto le montant + litres + station.
- Liste des derniers pleins (édition possible si pas validé admin).
- Calcul auto consommation L/100 vs moyenne véhicule.

### Onglet Inspection & Km

- **Relevé km** : km début + km fin de journée (un seul écran).
- **Inspection véhicule** (hebdo, semaine ISO) : checklist 8 points (pneus, freins, lumières, niveaux, état carrosserie, équipements sécurité, propreté cabine, papiers à bord) + photos par point + commentaire.
- Génère un PDF d'inspection signé numériquement.

### Onglet Messages

- Chat admin ↔ chauffeur 1:1.
- Pièces jointes : photo (caméra), galerie, fichier.
- Notifications (badge non lus + push si PWA installée).
- Templates pré-écrits côté admin uniquement.

### Onglet Profil

- Mes infos perso (lecture seule sauf mdp).
- Changer mot de passe.
- Installer la PWA.
- Se déconnecter.

## Conventions mobile

- **Toutes les fonctions au scope global** (`window.X = ...`) pour que
  les `onclick="X()"` HTML continuent de fonctionner.
- **Service Worker partagé** avec PC.
- **Style** : `style-mobile.css` (palette v3.64 "Asphalt & Speed Red"
  héritée de l'admin, accent rouge `#e63946`, fond asphalte `#1a1d22`).
- **Pas de framework** : zéro dépendance npm côté front.
- **Police** : `system-ui` natif (pas de webfont chargé sur mobile pour
  préserver la perf et le coût data en 4G).
