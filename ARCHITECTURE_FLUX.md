# 🗺️ Carte des flux & dépendances — MCA Logistics

> **À LIRE en début de chaque session** : avant d'ajouter ou modifier une fonctionnalité, vérifier ses liaisons transverses dans ce document.
> **À METTRE À JOUR** dès qu'une nouvelle entité ou un nouveau flux est ajouté.

---

## 📦 Entités métier (objets stockés en localStorage / Supabase)

| Entité | Clé localStorage | Description |
|---|---|---|
| **Livraisons** | `livraisons` | Cœur du métier : transport, prix, statuts, dates |
| **Clients** | `clients` | Carnet clients (Pro / Particulier) |
| **Fournisseurs** | `fournisseurs` | Carnet fournisseurs (Pro / Particulier) — miroir Clients |
| **Salariés** | `salaries` | Chauffeurs et autres |
| **Véhicules** | `vehicules` | Flotte avec affectation salarié + carte grise (PDF base64) |
| **Carburant** | `carburant` | Pleins effectués (km, montant, type, vehId) |
| **Entretiens** | `entretiens` | Maintenance véhicules |
| **Inspections** | `inspections` | Contrôles véhicules |
| **Charges** | `charges` | Dépenses générales (carburant, entretien, autres) — peut référer un fournisseur via `fournisseurId` |
| **Paiements** | `paiements` | Encaissements (futur module Encaissement) |
| **Incidents** | `incidents` | Réclamations / problèmes |
| **Alertes** | `alertes_admin` | Notifications système |
| **Planning** | divers (`planning_*`) | Horaires & absences |
| **Km salarié** | `km_sal_<id>` | Compteurs km par salarié |
| **Heures** | `heures_*` | Pointage horaires |

---

## 👁️ Vues transverses (lisent plusieurs entités)

| Vue | Lit | Affiche |
|---|---|---|
| **Dashboard** | livraisons, charges, paiements, vehicules, salaries, alertes | Hero Santé, KPIs CA/Livs/Dépenses/Bénéfice, graphique 7j, livraisons récentes, solde TVA |
| **Calendrier** | livraisons, paiements, factures (legacy), jours fériés | Événements (livraisons, échéances, relances, paiements, fériés) avec filtres |
| **Alertes** | alertes_admin + dérivées (RH, Parc) | Centre unifié des notifications |
| **Rentabilité** | livraisons, charges, vehicules, salaries | Calculateur financier par tournée/véhicule/chauffeur |
| **Statistiques** | livraisons, charges | Graphiques évolution CA/dépenses |
| **TVA** | livraisons, charges, carburant, entretiens | Récap collectée/déductible/à reverser |

---

## 🔄 FLUX CRITIQUES (à maintenir lors de chaque modif)

### Quand on **CRÉE une livraison**, ça doit impacter :
- ✅ Compteur km du véhicule (additif via `calculerKilometrageVehiculeActuel`, PAS remplacement)
- ✅ Événement Calendrier (filter `livraisons`)
- ✅ Dashboard : KPI Livraisons mois, CA mois, Bénéfice
- ✅ TVA collectée (si TVA > 0)
- ✅ Total CA du client (colonne Clients)
- ✅ Carnet client (auto-création si client inexistant — `BUG-006 fix` dans `ajouterLivraison`)
- ⚠️ Alerte si prix manquant ou conflit planning
- 🔮 **Futur** : entrée dans `produits` si statut payé (sync auto Pennylane-style)

### Quand on **SÉLECTIONNE un client** dans la modal Nouvelle livraison :
- ✅ `selectionnerClientLivraisonParId(clientId)` pré-remplit :
  - `liv-client` (nom)
  - `liv-client-siren` (toujours, écrase la valeur précédente)
  - `liv-zone` + `liv-depart` (adresse + CP + ville)
  - `liv-arrivee` (vide)
- ✅ Mémorise `window.__livSelectedClientId`, `__livSelectedClientTva`, `__livSelectedClientPays`
- ✅ À la sauvegarde : priorité au clientId stocké, snapshots TVA/pays sauvegardés dans la livraison

### Quand on **MODIFIE un client** (édition fiche) :
- ✅ Si nom change → propagation auto sur livraisons liées via `clientId`
- ✅ Si SIREN change → propagation auto sur livraisons liées
- ✅ Toast informe du nb de livraisons synchronisées
- 🔄 La fiche client reste vivante, ses livraisons restent retrouvables

### Quand on **SUPPRIME un client** :
- ✅ Avertissement explicite avec nb de livraisons liées
- ✅ Livraisons gardées (snapshots `client`, `clientSiren`, `clientTvaIntracom` préservés)
- ⚠️ `livraison.clientId` devient orphelin (aucun client à pointer)
- ✅ Total CA continue de matcher par nom (snapshot)

### Quand on **CHANGE le statut d'une livraison à "Livrée"** :
- ✅ Date de livraison enregistrée
- ✅ Dashboard refresh (livraisons livrées)
- ❌ **PAS de couplage automatique avec statutPaiement** (découplé volontairement — fix récent)

### Quand on **CHANGE le statut paiement à "Payée"** :
- ✅ Date paiement enregistrée
- ✅ Disparition de la ligne dans Relances
- ✅ Update Dashboard impayés
- ❌ **PAS de couplage automatique avec statut livraison**
- 🔮 **Futur (Encaissement)** : créer entrée Paiement → événement Calendrier (filtre `paiements`) + update Encaissé Dashboard

### Quand on **UPLOAD une carte grise véhicule** :
- ✅ En mode édition : direct sur `vehicules[idx].carteGriseFichier` (base64) + type + nom
- ✅ En mode création : stockage temp dans `window.__vehCGTemp`, attaché à la sauvegarde via `ajouterVehicule`
- ✅ `resetModalVehiculeToCreateMode` reset le state UI + temp si modal fermée sans save
- ✅ Bouton "Visualiser carte grise" dans le menu Actions devient ACTIF (vs grisé)
- ✅ `visualiserCarteGrise(vehId)` ouvre une popup avec embed PDF ou img selon type
- ⚠️ Limite 5 Mo (localStorage)

### Quand on **CRÉE un plein carburant** :
- ✅ Doit apparaître dans Charges (sync bidirectionnelle — bug connu sens inverse)
- ✅ Update Dashboard Dépenses mois
- ✅ TVA déductible carburant (selon taux : 80%/100% selon véhicule)
- ✅ Conso réelle du véhicule (si km saisi)
- ⚠️ **Sync à fixer** : suppression d'une charge type carburant doit supprimer le plein

### Quand on **CRÉE une charge** (autre que carburant) :
- ✅ Update Dashboard Dépenses
- ✅ TVA déductible (selon taux + tauxDeductibilite)
- ✅ Solde TVA → bascule éventuelle en crédit
- ⚠️ **Si type carburant** : doit créer un plein dans `carburant` aussi (bug connu sens direct)

### Quand on **CRÉE un entretien** :
- ✅ Apparaît dans Charges (avec entretienId)
- ✅ Update km véhicule (si km saisi > km existant)
- ✅ Pilotage entretien : prochain km calculé
- ✅ TVA déductible entretien

### Quand on **AFFECTE un salarié à un véhicule** :
- ✅ Update mutuelle salId/vehId
- ✅ Auto-affectation véhicule dans modal Nouvelle Livraison (selon chauffeur)
- ✅ Heures & Km : entrées km salarié liées au véhicule

### Quand on **CRÉE / MODIFIE / SUPPRIME un fournisseur** :
- ✅ Création : entrée dans `fournisseurs` avec type Pro/Particulier, secteur, paiement, IBAN
- ✅ Édition : modification fiche (la liaison aux charges via `fournisseurId` reste intacte)
- ✅ Suppression : avertissement avec nb de charges liées (snapshots préservés via `charge.fournisseur` nom)
- 🔮 **Futur** : champ Fournisseur dans modal Nouvelle Charge (à attaquer avec onglet Charges)

### 🔮 Quand on **CRÉE un encaissement (futur module)** :
- ✅ Mise à jour statut paiement livraison(s) liée(s)
- ✅ Événement Calendrier (filtre `paiements`)
- ✅ Update Dashboard Encaissé
- ✅ Solde TVA (TVA collectée acquittée)
- ✅ Disparition alerte impayé
- ✅ Update CA encaissé du client (rapport Clients)
- ✅ Pré-comptabilité Pennylane export

---

## 🎨 Patterns UI partagés (cohérence cross-onglets)

| Pattern | Onglets concernés | Implémenté |
|---|---|---|
| **Bouton CSV style `btn-secondary`** | Livraisons, Charges, Entretien, Heures&Km, TVA | ✅ |
| **Bouton "Historique clients" / CSV style** | Clients, Livraisons (renommée "Historique des livraisons") | ✅ |
| **Bouton "Rapport" `btn-rapport`** | Calendrier, Livraisons, Planning, Charges, TVA, Clients | ✅ |
| **Menu Actions dropdown** (au lieu de boutons scattered) | Livraisons, Clients ✅ — à porter sur Charges, Parc Auto |
| **"Aujourd'hui" (au lieu de "Réinitialiser")** sur nav période | Livraisons, Calendrier, TVA, Carburant, Stats, Charges, Entretiens, Heures, Planning, Inspections ✅ TOUS |
| **PDF en-tête `construireEnteteExport`** | Livraisons (réf), Calendrier, Rentabilité, Heures, Planning, Clients ✅ |
| **Pagination 10/25/50/100** (`window.PAGINATION`) | Livraisons ✅ — à porter sur Clients, Charges, autres |
| **Auto-complétion client** (modal Livraison) | Modal Nouvelle Livraison ✅ |
| **Recherche véhicule barre** | Charges (à faire), Alertes/Incidents (à faire) |
| **Filtre Carburant Parc Auto** | Parc Auto ✅ (matching `.includes()` pour libellés composés) |
| **Recherche stylée tableau** | Parc Auto ✅, Clients ✅, Fournisseurs ✅, Livraisons (existant) |

---

## ⚙️ Architecture — Sprints actifs (script.js)

> Les "Sprints" sont des modules empilés. **Avant de modifier, identifier dans quel Sprint vit le code**.

| Sprint | Rôle | Lignes (approx.) |
|---|---|---|
| **Core** | Storage, navigation, fonctions métier de base | 1 → ~16000 |
| **S15** | Productivité (palette Ctrl+K, copie auto, modal info) — facturation morte nettoyée | ~17500-17900 |
| **S16** | Calendrier opérationnel (cal16.*) | ~18000-18700 |
| **S18** | Tri DOM-based (skip si table a `data-sort-key` qui = S8) | ~19000-19200 |
| **S19** | Centre alertes unifié | ~19200-19700 |
| **S20** | Drawer fiche RH 360° | ~19700-20200 |
| **S21** | Drawer fiche Parc 360° (réutilise S20) | ~20200-20600 |
| **S22** | **HUBS sidebar** (Équipe / Parc auto / Comptabilité) — config dans `HUBS.<alias>.pages` | ~20600-20800 |
| **S24** | Auto-clôture, rappels, raccourcis clavier | ~20800-21100 |
| **S25** | Drawer Client/Fournisseur | ~21100-21600 |
| **S26** | Timeline globale (encore référencée dans 2 onglets non Dashboard) | ~21600-22300 |
| **S28** | Bug fixes critiques + drawer extension | ~22300-22500 |
| **S29** | Refonte Paramètres pro | ~22500+ |

---

## 🛡️ Garde-fous actifs (validations au boot)

1. **`validateHubsConfig`** : warning console si page déclarée dans `HUBS.X.pages` mais `<section id="page-X">` absente
2. **Validation routes** (IIFE en bas de naviguerVers) : warning si section DOM existe mais aucune route ne mène à elle
3. **`window.__s22Debug`** : `{HUBS, hubFromPage, ALL_SUB_PAGES}` exposé pour inspection console
4. **`window.__routesDebug`** : `{sectionsDOM, hubPages, navItems}` exposé pour audit

---

## ✅ Checklist : ajouter une NOUVELLE PAGE

1. **Section HTML** : `<section class="page" id="page-X">` dans `admin.html`
2. **Switch `naviguerVers`** : `case 'X': afficherX(); break;` dans `script.js` ~ligne 2500
3. **Titre** : ajouter `X: '🧾 Label'` dans l'objet `titres` (`script.js` ~ligne 2490)
4. **Sidebar** :
   - Si la page appartient à un hub existant → ajouter dans `HUBS.<alias>.pages` + `.labels` (`script.js` ~ligne 20780)
   - Sinon → ajouter `<a class="nav-item" data-page="X">` dans `admin.html`
5. **Mettre à jour ce document** (section Vues, Flux, Patterns)

## ✅ Checklist : ajouter une NOUVELLE FONCTIONNALITÉ avec impact transverse

1. **Identifier l'entité créée/modifiée** (livraison, paiement, etc.)
2. **Consulter "FLUX CRITIQUES"** ci-dessus pour voir tous les impacts
3. **Mettre à jour les vues transverses** (Dashboard, Calendrier, etc.) si nécessaire
4. **Vérifier les patterns UI partagés** (boutons, menus, pagination)
5. **Tester avec les garde-fous** : aucun warning console
6. **Mettre à jour ce document** si nouveau flux découvert
