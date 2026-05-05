# 01 — Vue d'ensemble

## Le produit

MCA Logistics est un **PGI (progiciel de gestion intégré) interne** pour
l'entreprise de transport / livraison du même nom. Application web
PWA, vanilla JavaScript, hébergée sur Cloudflare Pages, backend Supabase.

L'app couvre la **couche opérationnelle transport** : ce qu'un logiciel
de comptabilité ne sait pas faire — rattacher des coûts à un véhicule,
une tournée ou un chauffeur ; planifier ; tracer la conformité
réglementaire.

## Utilisateurs

- **Admins** (Achraf, Mohammed) — voient et modifient l'intégralité du
  site, en partage instantané. Toute modification d'un admin est visible
  par l'autre via la sync Supabase Realtime.
- **Salariés** (chauffeurs) — interface dédiée `salarie.html` ou `m.html`
  selon le device. Voient leurs propres données : planning, livraisons
  affectées, heures, véhicule, peuvent saisir leurs pleins de carburant,
  photos de tickets et envoyer des messages à l'admin.

## Positionnement vs Pennylane / Qonto

La compta de MCA est tenue **en parallèle sur Pennylane** (factures
clients, TVA, paiements, charges récurrentes). La banque est sur
**Qonto**. MCA Logistics ne refait pas leur travail.

| Domaine | Outil | Statut |
|---|---|---|
| Factures clients officielles, TVA CA3, devis | Pennylane | Doublé volontairement |
| Banque, virements sortants | Qonto | Source officielle |
| **Planning, tournées, heures, km** | **MCA** | Couverture exclusive |
| **Inspections véhicules, conformité ADR / CE 561** | **MCA** | Couverture exclusive |
| **Carburant, anomalies conso, TVA carburant déductible** | **MCA** | Couverture exclusive |
| **Rattachement coûts → véhicule / chauffeur / tournée** | **MCA** | Couverture exclusive |
| **Rentabilité fine (par mission, par véhicule)** | **MCA** | Couverture exclusive |

> **Règle directrice** : ne pas dupliquer ce que Pennylane fait déjà
> (devis client, factures officielles avec mentions légales, journal
> comptable). Ajouter ce que Pennylane ne fait pas (l'opérationnel
> transport).

## Périmètre fonctionnel

### Inclus

- CRUD complet : clients, fournisseurs, véhicules, salariés,
  livraisons, charges, carburant, entretiens, inspections, incidents.
- Planning hebdomadaire (admin) + suivi heures & km par chauffeur.
- TVA récap (régime encaissements transport routier — CGI 298-4).
- Calculateur de rentabilité (par véhicule / par mission).
- Centre d'alertes (permis, CT, assurance, doc expirés).
- Recherche globale (Ctrl+K PC + onglet dédié mobile).
- Drawers 360° par entité (sidebar PC SPRINT 20-25).
- Exports CSV / PDF (factures, registre RGPD, lettre de voiture).
- Storage privé pour cartes grises, docs salariés, photos inspections.

### Hors périmètre

- Émission de factures officielles avec mentions légales → **Pennylane**.
- Saisie comptable, plan de comptes, rapprochement bancaire complet → **Pennylane / Qonto**.
- Géolocalisation temps réel des véhicules → non implémenté.
- Signature électronique légale (eIDAS) des LDV → non implémenté (squelette UI dans SPRINT 26).

## En attente / mis de côté

- **Import Pennylane CSV / FEC** : nécessite un abonnement Pennylane Premium. Plan : parser CSV → auto-fill charges, paiements, fournisseurs, clients, et rapprochement avec les livraisons par n° de facture. À reprendre quand l'abonnement sera upgradé. Demander à Achraf un échantillon CSV réel avant d'implémenter.
- **Intégrations Qonto / Pennylane API** : étude détaillée disponible dans [`archive/2026-05-04-qonto-pennylane-sous-traitance.md`](./archive/2026-05-04-qonto-pennylane-sous-traitance.md). Trois quick-wins identifiés (webhook Qonto, webhook Pennylane, bouton "émettre facture").
- **Sous-traitance B2PWeb / Teleroute** : pas d'accès API self-service côté B2PWeb (contact commercial requis). Teleroute propose une API REST documentée.

## Stack en deux lignes

- **Frontend** : Vanilla JS, HTML, CSS — aucun framework. Service Worker pour PWA.
- **Backend** : Supabase (Postgres + Auth + Storage + Realtime), edge functions Deno pour les opérations privilégiées (provisionnement / suppression d'un salarié).

Détails dans [`02-architecture.md`](./02-architecture.md).
