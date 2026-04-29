-- DelivPro - Phase 2.2 : completer colonnes vehicules + activer realtime
-- A executer apres 008/009/010/011.

-- =====================================================
-- 1. Colonnes manquantes pour mapping JS<->DB lossless
-- =====================================================

-- Champs simples
alter table public.vehicules add column if not exists km_initial numeric(12,2) default 0;
alter table public.vehicules add column if not exists conso numeric(8,2) default 0;
alter table public.vehicules add column if not exists date_ct_dernier date;
alter table public.vehicules add column if not exists mode_acquisition text default 'achat';
alter table public.vehicules add column if not exists date_acquisition date;
alter table public.vehicules add column if not exists entretien_interval_km numeric(12,2) default 0;
alter table public.vehicules add column if not exists entretien_interval_mois numeric(6,2) default 0;
alter table public.vehicules add column if not exists genre text;
alter table public.vehicules add column if not exists carburant text;
alter table public.vehicules add column if not exists ptac integer default 0;
alter table public.vehicules add column if not exists ptra integer default 0;
alter table public.vehicules add column if not exists essieux integer default 0;
alter table public.vehicules add column if not exists crit_air text;
alter table public.vehicules add column if not exists date_1_immat date;
alter table public.vehicules add column if not exists vin text;
alter table public.vehicules add column if not exists carte_grise_ref text;

-- Snapshot du nom salarie affecte (pour preserver l'historique meme si reaffectation)
alter table public.vehicules add column if not exists salarie_nom_cache text;

-- Sous-objets JSON (finance/assurance) : 24+3 champs trop volatiles pour colonnes
alter table public.vehicules add column if not exists assurance jsonb default '{}'::jsonb;
alter table public.vehicules add column if not exists finance jsonb default '{}'::jsonb;

-- =====================================================
-- 2. Realtime
-- =====================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vehicules'
  ) then
    execute 'alter publication supabase_realtime add table public.vehicules';
  end if;
end $$;
