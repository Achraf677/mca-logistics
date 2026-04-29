-- DelivPro - Phase 2.1 : completer les colonnes de clients pour mapping JS<->DB sans perte
-- A executer apres 008_phase0_foundations.sql.

alter table public.clients add column if not exists prenom text;
alter table public.clients add column if not exists contact text;
alter table public.clients add column if not exists cp text;
alter table public.clients add column if not exists ville text;
alter table public.clients add column if not exists email_fact text;
alter table public.clients add column if not exists delai_paiement_jours integer default 30;
alter table public.clients add column if not exists notes text;

-- Le code legacy stocke type en lowercase ('pro'/'particulier'). On relache la contrainte
-- pour accepter les deux casses (sera normalise cote adapter en Phase 2.x).
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'clients_type_check') then
    alter table public.clients drop constraint clients_type_check;
  end if;
end $$;

alter table public.clients add constraint clients_type_check
  check (type is null or lower(type) in ('pro', 'particulier'));

-- Index sur (nom) lowercase pour les recherches case-insensitive frequentes du code (find by nom)
create index if not exists idx_clients_nom_lower on public.clients(lower(nom));
