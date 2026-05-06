# MCA Logistics — Notes pour Claude

## Contexte business
- PGI transport/logistique, PWA vanilla JS, hostée Cloudflare Pages
- Backend Supabase (projet `lkbfvgnhwgbapdtitglu`)
- Branche dev courante : `claude/sprint-95pct` (PR #21)
- Compta tenue en parallèle sur **Pennylane** (factures, TVA, paiements, charges)

## Règles de dev imposées par Achraf

- **Parité PC ↔ mobile systématique** : toute fonctionnalité ajoutée/modifiée
  côté mobile doit aussi être livrée côté PC, et inversement. Pas de delta
  entre les 2 sauf justification explicite. Rappel utilisateur : "Systématiquement
  tout ce que tu changes sur mobile change le sur pc aussi" (2026-05-06).
- **Pas de migration framework JS** : garder vanilla JS, structurer en fichiers
  thématiques < 1500 lignes (cf. `docs/01-overview.md`).
- **Tests unitaires obligatoires** sur les calculs critiques (TVA, rentabilité,
  heures, dates timezone).
- **Postmortem obligatoire** pour tout incident impactant la connexion ou les
  données utilisateur (cf. exemple `docs/archive/2026-05-06-postmortem-...`).

## Idées en attente

### Import Pennylane (mis de côté — pas d'abonnement premium)
- Plan : import manuel CSV/FEC depuis Pennylane → parser dans MCA →
  remplit auto charges / paiements / fournisseurs / clients, et fait le
  rapprochement avec les livraisons MCA via n° facture.
- Bloqué : export FEC nécessite Pennylane Premium (pas encore souscrit).
- À reprendre quand l'abonnement sera upgradé. Demander à Achraf un
  échantillon CSV réel avant de coder le parser.

## Direction produit
- Pas de doublon avec Pennylane (TVA, devis, factures clients, charges
  récurrentes pures = Pennylane).
- MCA = couche **opérationnelle transport** : ce que Pennylane ne sait
  pas faire (rattacher coûts à un véhicule/tournée/chauffeur, planning,
  inspections, carburant, conformité réglementaire, rentabilité fine).
