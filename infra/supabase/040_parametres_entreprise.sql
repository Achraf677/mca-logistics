-- 040_parametres_entreprise.sql
--
-- Setup wizard onboarding (claude/setup-wizard-onboarding) — table de
-- persistence centrale pour les parametres entreprise, postes et categories
-- de charges initialises au 1er login admin.
--
-- Conception :
--   - Une seule ligne (id = 1, "singleton") pour les parametres globaux.
--   - Tables `postes` et `charges_categories` gardees normalisees pour
--     evolutivite (ajout/desactivation independants, logs audit).
--   - RLS admin-only via la fonction `is_admin()` (definie en migration 008).
--   - Idempotente (CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS, ...).
--
-- Fallback localStorage : tant que la sync Supabase n'est pas active, le
-- wizard ecrit en localStorage (cles params_entreprise / postes /
-- charges_categories) et les adapters existants poussent quand l'admin se
-- reconnecte avec une session Supabase. Cette migration prepare la cible
-- finale et l'audit log.

-- ============================================================
-- parametres_entreprise (singleton row, id = 1)
-- ============================================================
create table if not exists public.parametres_entreprise (
  id            smallint primary key default 1,
  nom           text,
  siret         text,
  adresse       text,
  code_postal   text,
  ville         text,
  tel           text,
  email         text,
  logo_url      text,
  -- TVA
  regime_tva       text check (regime_tva in ('reel_normal','reel_simplifie','franchise_base')),
  periodicite_tva  text check (periodicite_tva in ('mensuelle','trimestrielle')),
  taux_tva_livraison numeric(5,2) default 20.00,
  taux_tva_charge    numeric(5,2) default 20.00,
  -- meta
  setup_done    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- contraintes singleton
  constraint parametres_entreprise_singleton check (id = 1)
);

-- updated_at trigger (reuse de la fonction `set_updated_at` definie en 008)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    execute 'drop trigger if exists trg_parametres_entreprise_updated on public.parametres_entreprise';
    execute 'create trigger trg_parametres_entreprise_updated before update on public.parametres_entreprise for each row execute function public.set_updated_at()';
  end if;
end$$;

-- audit log trigger (017 / 038 pattern)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_log_trigger') then
    execute 'drop trigger if exists trg_parametres_entreprise_audit_log on public.parametres_entreprise';
    execute 'create trigger trg_parametres_entreprise_audit_log after insert or update or delete on public.parametres_entreprise for each row execute function public.audit_log_trigger()';
  end if;
end$$;

alter table public.parametres_entreprise enable row level security;

drop policy if exists parametres_entreprise_select on public.parametres_entreprise;
drop policy if exists parametres_entreprise_write on public.parametres_entreprise;

-- Lecture : tout admin authentifie. Les chauffeurs n'ont pas besoin du SIRET
-- ni du regime TVA — l'app salarie n'a aucune ecran qui le consulte.
create policy parametres_entreprise_select on public.parametres_entreprise
  for select using (public.is_admin());

create policy parametres_entreprise_write on public.parametres_entreprise
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- postes (catalogue libelles RH)
-- ============================================================
create table if not exists public.postes (
  id          uuid primary key default gen_random_uuid(),
  libelle     text not null unique,
  actif       boolean not null default true,
  ordre       smallint not null default 0,
  created_at  timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_log_trigger') then
    execute 'drop trigger if exists trg_postes_audit_log on public.postes';
    execute 'create trigger trg_postes_audit_log after insert or update or delete on public.postes for each row execute function public.audit_log_trigger()';
  end if;
end$$;

alter table public.postes enable row level security;

drop policy if exists postes_select on public.postes;
drop policy if exists postes_write on public.postes;

create policy postes_select on public.postes for select using (public.is_admin());
create policy postes_write  on public.postes for all    using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- charges_categories (catalogue des categories de charges)
-- ============================================================
create table if not exists public.charges_categories (
  id          uuid primary key default gen_random_uuid(),
  libelle     text not null unique,
  actif       boolean not null default true,
  ordre       smallint not null default 0,
  created_at  timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_log_trigger') then
    execute 'drop trigger if exists trg_charges_categories_audit_log on public.charges_categories';
    execute 'create trigger trg_charges_categories_audit_log after insert or update or delete on public.charges_categories for each row execute function public.audit_log_trigger()';
  end if;
end$$;

alter table public.charges_categories enable row level security;

drop policy if exists charges_categories_select on public.charges_categories;
drop policy if exists charges_categories_write on public.charges_categories;

create policy charges_categories_select on public.charges_categories for select using (public.is_admin());
create policy charges_categories_write  on public.charges_categories for all    using (public.is_admin()) with check (public.is_admin());

-- Pas de seed en SQL : le wizard front livre les libelles par defaut
-- pour rester editables a la 1ere connexion (sinon Achraf devrait
-- desactiver/supprimer les seeds dont il ne veut pas).
