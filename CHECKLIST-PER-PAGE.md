# Checklist Definition of Done — par page

> À cocher à chaque page refondue. Une page ne peut pas être marquée
> "FAITE" si une seule case est ❌.

---

## Page : Dashboard

### Visuel
- [x] Topbar matche mockup (logo + search + bell + theme + user)
- [x] Section-head "Vue d'ensemble" + sub-meta
- [x] Hero row : santé + points d'attention
- [x] KPI grid : 4 cards uniformes
- [x] Dash-charts : area 14j + status card
- [x] Grid-2 bottom : dernières livraisons + alertes
- [x] Empty states (—) si aucune donnée

### Fonctionnel
- [x] 8/8 facteurs branchés sur vraies données
- [x] Sparkline = synthétique (acceptable)
- [x] Click pills "Points d'attention" → naviguer alertes/encaissements
- [x] Click "Tout voir" → page alertes

### Data
- [x] hasAnyData() → score "—" si vide
- [x] Trésorerie correctement calculée (paiements - charges - carburant)

### Status : ✅ DONE (commit `7dfa409`)

---

## Page : Livraisons

### Visuel
- [x] Title-row "Livraisons" + meta count
- [x] Section-head "Toutes les livraisons" + sub + actions
- [x] Dropdowns Générer/Exporter (4 items each)
- [x] Bouton "Modifier (N)" apparait au check
- [x] Chips toolbar 5 chips + date range chip + Filtres button
- [x] 9 cols visibles dans table
- [ ] **BUG-001** : section titles modal Nouvelle PAS tronqués
- [ ] **BUG-003** : icône calendrier PAS débordement

### Fonctionnel
- [x] Click row → drawer 360 ouvre
- [x] Click "Modifier (N)" → modal edit ouvre
- [x] Filter chips fonctionnent (Toutes / Livrées / En cours / Retard / Brouillons)
- [x] View toggle : Tableau / Kanban / Calendrier
- [ ] **BUG-005** : Générer facture dropdown déclenche PDF
- [x] Filtres toggle expand bar
- [x] Search input filtre
- [x] Pagination footer visible

### Data
- [x] Trajet départ + arrivée séparés visibles
- [ ] **BUG-004** : modal Modifier complète (Statut/Heure/Notes)
- [ ] **BUG-002** : validation Client au bon moment (pas à l'ouverture)
- [x] Drawer Documents tab lit localStorage

### Modal Nouvelle livraison
- [ ] **BUG-001** : titres sections complets
- [ ] **BUG-002** : pas de message erreur à l'ouverture
- [ ] **BUG-003** : pas d'icône débordante
- [x] Tous les champs visibles (incl. Départ/Arrivée)
- [ ] **BUG-005** : Générer facture/BL accessible

### Modal Modifier livraison
- [ ] **BUG-004** : tous les champs présents (parité avec Nouvelle)
- [x] Boutons Bon de livraison / Facture / Enregistrer

### Drawer 360 livraison
- [x] Slide from right
- [x] 4 tabs : Détail / Documents / Paiement / Historique
- [x] Documents tab : liste docs générés
- [x] Footer : Imprimer / Dupliquer / Modifier
- [x] Click overlay → ferme
- [x] Escape → ferme
- [x] Click "Modifier" → modal edit

### Status : 🟡 WIP (5 bugs ouverts, voir BUGS-OPEN.md)

---

## Page : Clients
_(à compléter quand attaquée)_

## Page : Fournisseurs
_(à compléter)_

## Page : Véhicules
_(à compléter)_

## Page : Carburant
_(à compléter)_

## Page : Entretiens
_(à compléter)_

## Page : Inspections
_(à compléter)_

## Page : Charges
_(à compléter)_

## Page : Encaissement
_(à compléter)_

## Page : TVA
_(à compléter)_

## Page : Rentabilité
_(à compléter)_

## Page : Statistiques
_(à compléter)_

## Page : Calendrier
_(à compléter)_

## Page : Alertes
_(à compléter)_

## Page : Équipe
_(à compléter)_

## Page : Heures
_(à compléter)_

## Page : Incidents
_(à compléter)_

## Page : Paramètres
_(à compléter)_

## Page : Brouillons IA
_(à compléter)_

## Page : Planning
_(à compléter)_

## Mobile m.html
_(à compléter)_

## Mobile salarie.html
_(à compléter)_
