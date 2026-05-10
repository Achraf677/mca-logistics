-- Migration 047 — Alias colonnes pour reduire le schema drift JS<->DB.
--
-- Bugs #83 #86 audit Chrome :
-- > Console : await supabase.from('livraisons').select('numero')
-- >   -> erreur "column livraisons.numero does not exist"
-- > Idem charges.libelle. Les colonnes reelles sont num_liv / description.
-- > La colonne JSON `extra` duplique tout, parfois en plusieurs casings
-- > (montantHT + montantHt + montant_ht).
--
-- Fix : creer des vues `livraisons_v` / `charges_v` qui exposent les alias
-- camelCase historiques + les noms snake_case canoniques. Les consommateurs
-- legacy peuvent migrer progressivement vers ces vues.
--
-- NOTE : on ne renomme PAS les colonnes existantes pour ne pas casser les
-- clients en prod. Les vues sont READ ONLY (writes restent sur les tables).
--
-- Idempotente : DROP VIEW IF EXISTS + CREATE.

drop view if exists public.livraisons_v;
create view public.livraisons_v as
select
  l.*,
  l.num_liv as numero,
  l.num_liv as num_liv_alias,
  l.client_nom as client,
  l.date_livraison as date,
  l.distance_km as distance,
  l.prix_ht as prix_ht_canon,
  l.prix_ttc as prix,
  l.tva_montant as tva_montant_canon,
  l.salarie_id as chauf_id,
  l.vehicule_id as veh_id
from public.livraisons l;

drop view if exists public.charges_v;
create view public.charges_v as
select
  c.*,
  c.description as libelle,
  c.prix_ht as montant_ht,
  c.prix_ttc as montant,
  c.fournisseur_id as fournisseur_id_canon
from public.charges c;

-- Pas de RLS sur les vues : elles heritent du RLS des tables sous-jacentes.
-- Documenter pour Achraf : utiliser `livraisons_v` / `charges_v` quand le
-- code legacy demande des noms camelCase. Les writes restent sur livraisons / charges.

comment on view public.livraisons_v is 'Vue alias schema drift (#83 #86) : expose num_liv as numero, client_nom as client, etc.';
comment on view public.charges_v is 'Vue alias schema drift (#83 #86) : expose description as libelle, etc.';
