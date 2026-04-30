# MCA Logistics — Notes pour Claude

## Contexte business
- PGI transport/logistique, PWA vanilla JS, hostée Cloudflare Pages
- Backend Supabase (projet `lkbfvgnhwgbapdtitglu`)
- Branche dev : `claude/add-supabase-mcp-CuBe2`
- Compta tenue en parallèle sur **Pennylane** (factures, TVA, paiements, charges)

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
