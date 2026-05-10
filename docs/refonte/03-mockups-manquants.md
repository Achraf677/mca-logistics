# 03 — Mockups manquants à créer

**Statut :** ces mockups n'existent pas encore dans `preview/`. Les commander avant de migrer la page prod qui les utilise, sinon Claude Code va devoir improviser et tu casses la cohérence.

## Modales

| Mockup à créer | Page prod concernée | Champs / contenu | Ref ID prod |
|----------------|---------------------|------------------|-------------|
| `_modal-nouvelle-livraison.html` | livraisons | 24 champs (client, chauffeur, véhicule, date, heure, adresse départ/arrivée, montant HT, TVA, kms, etc) | `#modal-livraison`, `#liv-chauffeur`, `#liv-vehicule`, `#liv-calc-summary` |
| `_modal-edit-livraison.html` | livraisons | mêmes champs préremplis | `ouvrirEditLivraison()` |
| `_modal-charge.html` | charges | nature, montant HT, TVA, fournisseur, date, récurrence | onclick handlers charges |
| `_modal-recurrence-charge.html` | charges | toggle récurrent, fréquence (mensuel/trim/annuel), date fin, jour mois | `data-recurrent` |
| `_modal-edit-client.html` | clients | SIRET, raison sociale, contact, IBAN, conditions paiement | `ouvrirEditClient()`, `#edit-client-id` |
| `_modal-edit-vehicule.html` | véhicules | immat, genre, marque, modèle, capacité réservoir, cartes grises | `ouvrirFicheVehiculeDepuisTableau()` |
| `_modal-saisie-rapide-planning.html` | planning | salarié, date, type jour, heures début/fin | `planningOuvrirSaisieRapide()` |
| `_modal-note-interne.html` | équipe | textarea + visibilité | `ouvrirNoteInterne()`, `#note-interne-*` |
| `_modal-credentials-chauffeur.html` | équipe | génération mdp, copy-to-clipboard, instructions | `genererMotDePasseFort()` |
| `_modal-brouillon-ia.html` | alertes / IA | détail action proposée, accepter/rejeter/modifier | sprint AI brouillons |
| `_modal-signature-bl.html` | livraisons | canvas signature + nom + qualité | `ouvrirSignatureBL()`, `#s26-sig-*` |
| `_modal-import-fec.html` | charges | dropzone fichier + preview lignes | pennylane-fec |
| `_modal-confirmation.html` | global | titre + message + cancel/confirm (variantes destructive) | usage générique |

## Drawers (slide-right, 40-50% width desktop, fullscreen mobile)

| Mockup | Contenu | ID prod |
|--------|---------|---------|
| `_drawer-360-client.html` | onglets : Infos / Livraisons / Factures / Timeline | `#side-drawer`, `data-s28-client` |
| `_drawer-360-fournisseur.html` | onglets : Infos / Charges / Carburant / Documents | `data-s28-fourn` |
| `_drawer-360-vehicule.html` | onglets : Infos / Carburant / Entretiens / Inspections / TCO | `#tco-detail` |
| `_drawer-360-salarie.html` | onglets : Infos / Heures / Absences / Documents / Notes | `planningOuvrirFicheSalarie()` |
| `_drawer-detail-jour-planning.html` | jour cliqué dans grille planning, liste salariés | `ouvrirDetailJour()` |
| `_drawer-rule-alerte.html` | éditeur de règle d'alerte | `#s25-drawer`, `#s25-rule-*` |
| `_drawer-timeline-globale.html` | événements horodatés, filtres acteur/période | `ouvrirTimelineGlobale()`, `#s26-tl-*` |

## Setup wizard (4 étapes)

| Mockup | Contenu |
|--------|---------|
| `_wizard-shell.html` | header progression 1/4, navigation prev/next, container step |
| `_wizard-step-1-entreprise.html` | raison sociale, SIRET, adresse, logo upload |
| `_wizard-step-2-equipe.html` | ajout salariés (form répété) |
| `_wizard-step-3-flotte.html` | ajout véhicules (form répété) |
| `_wizard-step-4-clients.html` | import CSV ou ajout manuel |

## États empty (1 par contexte)

| Mockup | Contexte | Illustration / icône suggérée |
|--------|----------|------|
| `_empty-livraisons.html` | tableau livraisons vide | camion + plus |
| `_empty-clients.html` | aucun client | building + plus |
| `_empty-fournisseurs.html` | aucun fournisseur | shop + plus |
| `_empty-vehicules.html` | aucun véhicule | truck + plus |
| `_empty-equipe.html` | aucun salarié | users + plus |
| `_empty-charges.html` | aucune charge ce mois | euro + plus |
| `_empty-carburant.html` | aucune saisie carburant | fuel + plus |
| `_empty-entretiens.html` | aucun entretien | wrench + plus |
| `_empty-alertes.html` | tout va bien | check vert |
| `_empty-recherche.html` | recherche sans résultat | loupe + ? |
| `_empty-filtres.html` | filtres trop restrictifs | filter + reset CTA |

## États loading

| Mockup | Contexte |
|--------|----------|
| `_skeleton-table.html` | rows shimmer pour tableaux |
| `_skeleton-kpi.html` | KPI cards shimmer |
| `_skeleton-chart.html` | chart placeholder |
| `_skeleton-drawer-360.html` | drawer ouvert pendant fetch |
| `_loading-fullpage.html` | premier load app |
| `_loading-inline.html` | spinner bouton, taille S/M/L |

## États erreur

| Mockup | Contexte |
|--------|----------|
| `_error-network.html` | modal "réseau coupé" + retry |
| `_error-page-500.html` | page entière échec serveur |
| `_error-permission.html` | accès refusé |
| `_error-conflict.html` | conflit edition concurrente (cf `tests/edit-locks.test.js`) |

## Toasts (4 variantes)

| Mockup | Variante |
|--------|----------|
| `_toast-success.html` | vert, check icon, auto-dismiss 4s |
| `_toast-warning.html` | orange, alert icon, auto-dismiss 6s |
| `_toast-error.html` | rouge, x icon, persistant + bouton dismiss |
| `_toast-info.html` | bleu, info icon, auto-dismiss 4s |
| `_toast-stack.html` | exemple de pile (3 toasts visibles) |

## Demande à l'utilisateur

Avant de me commander tous d'un coup, valide la liste avec @achraf : il y a peut-être des mockups que tu peux marquer "non prioritaires" pour Phase 4 (ex `_modal-import-fec.html` si pas dans le scope migration).
