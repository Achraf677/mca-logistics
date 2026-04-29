-- DelivPro - Phase 0 : fondations DB pour migration localStorage -> Supabase
-- Tout est idempotent. Aucune modification du code app n'est requise.
--
-- Ce fichier ajoute :
--   - Une table de backup pour app_state
--   - Un trigger generique set_updated_at applique a toutes les tables qui ont updated_at
--   - 4 nouvelles tables : fournisseurs, paiements, alertes_admin, salaries_documents
--   - Les colonnes manquantes pour les futures migrations (clients, livraisons, vehicules, charges, carburant, entretiens, messages)
--   - Les indexes sur FK et colonnes filtrees frequemment
--   - Les RLS policies pour les nouvelles tables

-- =====================================================
-- 1. Backup table (alimentee une fois avant la migration)
-- =====================================================
create table if not exists public._backup_app_state (
  backup_id uuid primary key default gen_random_uuid(),
  backed_up_at timestamptz not null default now(),
  label text,
  scope text not null,
  payload jsonb not null
);

alter table public._backup_app_state enable row level security;

drop policy if exists "_backup_app_state admin read" on public._backup_app_state;
create policy "_backup_app_state admin read"
on public._backup_app_state
for select
using (public.is_admin());

-- =====================================================
-- 2. Trigger generique updated_at
-- =====================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t_name text;
begin
  for t_name in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and c.table_name not like '\_%' escape '\'
  loop
    execute format('drop trigger if exists trg_%I_set_updated_at on public.%I', t_name, t_name);
    execute format(
      'create trigger trg_%I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t_name, t_name
    );
  end loop;
end $$;

-- =====================================================
-- 3. Nouvelle table : fournisseurs
-- =====================================================
create table if not exists public.fournisseurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  type text check (type in ('Pro', 'Particulier')),
  secteur text,
  siren text,
  tva_intracom text,
  pays text default 'FR',
  adresse text,
  telephone text,
  email text,
  iban text,
  bic text,
  paiement_mode text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fournisseurs enable row level security;
drop policy if exists "fournisseurs admin all" on public.fournisseurs;
create policy "fournisseurs admin all"
on public.fournisseurs for all
using (public.is_admin())
with check (public.is_admin());

-- =====================================================
-- 4. Nouvelle table : paiements
-- =====================================================
create table if not exists public.paiements (
  id uuid primary key default gen_random_uuid(),
  livraison_id uuid references public.livraisons(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  date_paiement date not null,
  montant numeric(12,2) not null default 0,
  mode text,
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.paiements enable row level security;
drop policy if exists "paiements admin all" on public.paiements;
create policy "paiements admin all"
on public.paiements for all
using (public.is_admin())
with check (public.is_admin());

-- =====================================================
-- 5. Nouvelle table : alertes_admin
-- =====================================================
create table if not exists public.alertes_admin (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  niveau text default 'info' check (niveau in ('info', 'warning', 'error', 'critical')),
  titre text not null,
  message text,
  contexte jsonb default '{}'::jsonb,
  lue boolean not null default false,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alertes_admin enable row level security;
drop policy if exists "alertes_admin admin all" on public.alertes_admin;
create policy "alertes_admin admin all"
on public.alertes_admin for all
using (public.is_admin())
with check (public.is_admin());

-- =====================================================
-- 6. Nouvelle table : salaries_documents
-- =====================================================
create table if not exists public.salaries_documents (
  id uuid primary key default gen_random_uuid(),
  salarie_id uuid not null references public.salaries(id) on delete cascade,
  type text not null check (type in ('cni', 'iban', 'permis', 'visite_medicale', 'contrat', 'autre')),
  storage_path text not null,
  mime_type text,
  taille_octets bigint,
  nom_fichier text,
  date_expiration date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.salaries_documents enable row level security;
drop policy if exists "salaries_documents admin all" on public.salaries_documents;
create policy "salaries_documents admin all"
on public.salaries_documents for all
using (public.is_admin())
with check (public.is_admin());
drop policy if exists "salaries_documents self read" on public.salaries_documents;
create policy "salaries_documents self read"
on public.salaries_documents for select
using (
  salarie_id in (
    select s.id from public.salaries s where s.profile_id = auth.uid()
  )
);

-- =====================================================
-- 7. Colonnes manquantes : clients
-- =====================================================
alter table public.clients add column if not exists type text;
alter table public.clients add column if not exists siren text;
alter table public.clients add column if not exists tva_intracom text;
alter table public.clients add column if not exists pays text default 'FR';
alter table public.clients add column if not exists secteur text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clients_type_check') then
    alter table public.clients add constraint clients_type_check check (type is null or type in ('Pro', 'Particulier'));
  end if;
end $$;

-- =====================================================
-- 8. Colonnes manquantes : livraisons (snapshots client + paiement)
-- =====================================================
alter table public.livraisons add column if not exists client_siren text;
alter table public.livraisons add column if not exists client_tva_intracom text;
alter table public.livraisons add column if not exists client_pays text;
alter table public.livraisons add column if not exists date_paiement date;
alter table public.livraisons add column if not exists tva_montant numeric(12,2) default 0;
alter table public.livraisons add column if not exists kilometrage_compteur numeric(12,2);

-- =====================================================
-- 9. Colonnes manquantes : vehicules (Storage carte grise + suivi)
-- =====================================================
alter table public.vehicules add column if not exists carte_grise_path text;
alter table public.vehicules add column if not exists carte_grise_mime text;
alter table public.vehicules add column if not exists carte_grise_nom text;
alter table public.vehicules add column if not exists kilometrage numeric(12,2) default 0;
alter table public.vehicules add column if not exists date_assurance date;
alter table public.vehicules add column if not exists date_carte_grise date;

-- =====================================================
-- 10. Colonnes manquantes : charges (fournisseur + tva deductibilite + liens)
-- =====================================================
alter table public.charges add column if not exists fournisseur_id uuid references public.fournisseurs(id) on delete set null;
alter table public.charges add column if not exists fournisseur_nom text;
alter table public.charges add column if not exists taux_deductibilite numeric(5,2) default 100;
alter table public.charges add column if not exists carburant_id uuid references public.carburant(id) on delete set null;
alter table public.charges add column if not exists entretien_id uuid references public.entretiens(id) on delete set null;

-- =====================================================
-- 11. Colonnes manquantes : carburant (Storage recu + km + type)
-- =====================================================
alter table public.carburant add column if not exists photo_recu_path text;
alter table public.carburant add column if not exists photo_recu_mime text;
alter table public.carburant add column if not exists kilometrage numeric(12,2) default 0;
alter table public.carburant add column if not exists type_carburant text;

-- =====================================================
-- 12. Colonnes manquantes : entretiens (km + prochaines echeances)
-- =====================================================
alter table public.entretiens add column if not exists kilometrage numeric(12,2) default 0;
alter table public.entretiens add column if not exists prochain_km numeric(12,2);
alter table public.entretiens add column if not exists prochaine_date date;

-- =====================================================
-- 13. Colonnes manquantes : messages (Storage photo)
-- =====================================================
alter table public.messages add column if not exists photo_path text;
alter table public.messages add column if not exists photo_mime text;
alter table public.messages add column if not exists delivered_at timestamptz;

-- =====================================================
-- 14. Indexes pour FK et queries frequentes
-- =====================================================

-- livraisons
create index if not exists idx_livraisons_client_id on public.livraisons(client_id);
create index if not exists idx_livraisons_salarie_id on public.livraisons(salarie_id);
create index if not exists idx_livraisons_vehicule_id on public.livraisons(vehicule_id);
create index if not exists idx_livraisons_date on public.livraisons(date_livraison desc);
create index if not exists idx_livraisons_statut on public.livraisons(statut);
create index if not exists idx_livraisons_statut_paiement on public.livraisons(statut_paiement);

-- charges
create index if not exists idx_charges_date on public.charges(date_charge desc);
create index if not exists idx_charges_categorie on public.charges(categorie);
create index if not exists idx_charges_vehicule_id on public.charges(vehicule_id);
create index if not exists idx_charges_fournisseur_id on public.charges(fournisseur_id);

-- carburant
create index if not exists idx_carburant_date on public.carburant(date_plein desc);
create index if not exists idx_carburant_vehicule_id on public.carburant(vehicule_id);
create index if not exists idx_carburant_salarie_id on public.carburant(salarie_id);

-- entretiens
create index if not exists idx_entretiens_date on public.entretiens(date_entretien desc);
create index if not exists idx_entretiens_vehicule_id on public.entretiens(vehicule_id);

-- inspections
create index if not exists idx_inspections_salarie_id on public.inspections(salarie_id);
create index if not exists idx_inspections_vehicule_id on public.inspections(vehicule_id);
create index if not exists idx_inspections_date on public.inspections(date_inspection desc);

-- inspection_photos
create index if not exists idx_inspection_photos_inspection_id on public.inspection_photos(inspection_id);
create index if not exists idx_inspection_photos_salarie_id on public.inspection_photos(salarie_id);

-- incidents
create index if not exists idx_incidents_salarie_id on public.incidents(salarie_id);
create index if not exists idx_incidents_livraison_id on public.incidents(livraison_id);
create index if not exists idx_incidents_date on public.incidents(date_incident desc);

-- messages
create index if not exists idx_messages_dest on public.messages(destinataire_salarie_id, lu);
create index if not exists idx_messages_auteur on public.messages(auteur_salarie_id);
create index if not exists idx_messages_created on public.messages(created_at desc);

-- plannings_hebdo
create index if not exists idx_plannings_salarie on public.plannings_hebdo(salarie_id);

-- absences_periodes
create index if not exists idx_absences_salarie_dates on public.absences_periodes(salarie_id, date_debut, date_fin);

-- vehicules
create index if not exists idx_vehicules_salarie_id on public.vehicules(salarie_id);

-- salaries
create index if not exists idx_salaries_actif on public.salaries(actif) where actif = true;
create index if not exists idx_salaries_profile_id on public.salaries(profile_id);

-- clients
create index if not exists idx_clients_nom on public.clients(nom);
create index if not exists idx_clients_siren on public.clients(siren);

-- nouvelles tables
create index if not exists idx_paiements_livraison on public.paiements(livraison_id);
create index if not exists idx_paiements_client on public.paiements(client_id);
create index if not exists idx_paiements_date on public.paiements(date_paiement desc);

create index if not exists idx_fournisseurs_nom on public.fournisseurs(nom);
create index if not exists idx_fournisseurs_siren on public.fournisseurs(siren);

create index if not exists idx_alertes_resolved on public.alertes_admin(resolved, created_at desc);
create index if not exists idx_alertes_type on public.alertes_admin(type);

create index if not exists idx_sal_docs_salarie on public.salaries_documents(salarie_id, type);
