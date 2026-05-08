-- MCA Logistics - Indexes idempotency import FEC Pennylane
-- L'edge function pennylane-fec-import re-tourne potentiellement sur le meme
-- mois (re-run manuel, retry CI, etc.). Pour eviter les doublons on stocke
-- une cle unique Pennylane (EcritureNum + JournalCode + ExerciceFiscal) dans
-- la colonne `extra->>'pennylane_ecriture_key'` de chaque table impactee, et
-- on cree un index unique partiel dessus.
--
-- Tables touchees :
--  - charges      : ecritures comptes 6XX
--  - paiements    : ecritures comptes 5XX (banque) avec ref livraison
--  - fournisseurs : upsert via SIREN ou nom (cf cle dediee)
--  - clients      : upsert via SIREN ou nom (cf cle dediee)
--
-- Choix du nom de cle : `pennylane_ecriture_key` plutot que `pennylane_ecriture_num`
-- car deux journaux peuvent reutiliser le meme EcritureNum sur des exercices
-- differents. La cle complete = JournalCode|EcritureNum|FiscalYear, fabriquee
-- cote edge function.

-- =====================================================
-- 1. clients : ajout colonne extra (manquait)
-- =====================================================
alter table public.clients add column if not exists extra jsonb default '{}'::jsonb;

-- =====================================================
-- 2. Index unique partiels sur extra->>'pennylane_ecriture_key'
-- =====================================================
-- L'index est partiel (where ... is not null) pour ne pas impacter les lignes
-- creees a la main hors import FEC.

create unique index if not exists idx_charges_pennylane_ecriture_key
  on public.charges ((extra->>'pennylane_ecriture_key'))
  where (extra->>'pennylane_ecriture_key') is not null;

create unique index if not exists idx_paiements_pennylane_ecriture_key
  on public.paiements ((extra->>'pennylane_ecriture_key'))
  where (extra->>'pennylane_ecriture_key') is not null;

-- Pour fournisseurs / clients, la cle d'idempotency est l'identifiant tiers
-- Pennylane (id ou siren). On stocke `pennylane_supplier_id` / `pennylane_customer_id`
-- pour matcher d'un import a l'autre.
create unique index if not exists idx_fournisseurs_pennylane_supplier_id
  on public.fournisseurs ((extra->>'pennylane_supplier_id'))
  where (extra->>'pennylane_supplier_id') is not null;

create unique index if not exists idx_clients_pennylane_customer_id
  on public.clients ((extra->>'pennylane_customer_id'))
  where (extra->>'pennylane_customer_id') is not null;

-- =====================================================
-- 3. Index secondaire pour audit / dedoublonnage par ref piece
-- =====================================================
-- Permet de faire `WHERE extra->>'pennylane_piece_ref' = '...'` rapidement.
create index if not exists idx_charges_pennylane_piece_ref
  on public.charges ((extra->>'pennylane_piece_ref'))
  where (extra->>'pennylane_piece_ref') is not null;

create index if not exists idx_paiements_pennylane_piece_ref
  on public.paiements ((extra->>'pennylane_piece_ref'))
  where (extra->>'pennylane_piece_ref') is not null;

-- =====================================================
-- 4. RLS : toujours admin seulement (deja en place via 008/018/020/etc.)
--    Aucun changement ici, on s'appuie sur les policies existantes.
-- =====================================================
