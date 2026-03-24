-- DelivPro - Schema initial cible
-- Ce schema prepare la migration sans toucher au front actuel.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'salarie')),
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.postes (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.salaries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  numero text unique,
  nom text not null,
  prenom text,
  poste text,
  permis text,
  assurance text,
  telephone text,
  email text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicules (
  id uuid primary key default gen_random_uuid(),
  immat text not null unique,
  modele text,
  marque text,
  salarie_id uuid references public.salaries(id) on delete set null,
  tva_carburant_deductible numeric(5,2) default 100,
  date_ct date,
  date_vidange date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  adresse text,
  telephone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.livraisons (
  id uuid primary key default gen_random_uuid(),
  num_liv text unique,
  client_id uuid references public.clients(id) on delete set null,
  client_nom text,
  date_livraison date not null,
  distance_km numeric(10,2) default 0,
  prix_ht numeric(12,2) default 0,
  taux_tva numeric(5,2) default 20,
  prix_ttc numeric(12,2) default 0,
  salarie_id uuid references public.salaries(id) on delete set null,
  vehicule_id uuid references public.vehicules(id) on delete set null,
  statut text,
  statut_paiement text,
  zone text,
  depart text,
  arrivee text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.absences_periodes (
  id uuid primary key default gen_random_uuid(),
  salarie_id uuid not null references public.salaries(id) on delete cascade,
  type text not null check (type in ('travail', 'conge', 'maladie', 'absence')),
  date_debut date not null,
  date_fin date not null,
  heure_debut time,
  heure_fin time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plannings_hebdo (
  id uuid primary key default gen_random_uuid(),
  salarie_id uuid not null references public.salaries(id) on delete cascade,
  jour text not null,
  travaille boolean not null default false,
  type_jour text default 'repos',
  heure_debut time,
  heure_fin time,
  zone text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salarie_id, jour)
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  salarie_id uuid not null references public.salaries(id) on delete cascade,
  vehicule_id uuid references public.vehicules(id) on delete set null,
  date_inspection date not null default current_date,
  semaine_label text,
  commentaire text,
  statut text default 'soumise',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  salarie_id uuid not null references public.salaries(id) on delete cascade,
  vehicule_id uuid references public.vehicules(id) on delete set null,
  r2_key text not null,
  photo_url text,
  mime_type text,
  taille_octets bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  auteur_role text not null check (auteur_role in ('admin', 'salarie')),
  auteur_salarie_id uuid references public.salaries(id) on delete set null,
  destinataire_role text check (destinataire_role in ('admin', 'salarie')),
  destinataire_salarie_id uuid references public.salaries(id) on delete set null,
  texte text not null,
  lu boolean not null default false,
  deleted_by_admin boolean not null default false,
  deleted_by_salarie boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.carburant (
  id uuid primary key default gen_random_uuid(),
  vehicule_id uuid references public.vehicules(id) on delete set null,
  salarie_id uuid references public.salaries(id) on delete set null,
  date_plein date not null,
  litres numeric(10,2) default 0,
  prix_ttc numeric(12,2) default 0,
  prix_ht numeric(12,2) default 0,
  taux_tva numeric(5,2) default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entretiens (
  id uuid primary key default gen_random_uuid(),
  vehicule_id uuid references public.vehicules(id) on delete set null,
  date_entretien date not null,
  type text,
  description text,
  cout_ttc numeric(12,2) default 0,
  cout_ht numeric(12,2) default 0,
  taux_tva numeric(5,2) default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  categorie text not null,
  description text,
  date_charge date not null,
  montant_ttc numeric(12,2) default 0,
  montant_ht numeric(12,2) default 0,
  taux_tva numeric(5,2) default 20,
  vehicule_id uuid references public.vehicules(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  salarie_id uuid references public.salaries(id) on delete set null,
  livraison_id uuid references public.livraisons(id) on delete set null,
  gravite text,
  description text not null,
  date_incident date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.salaries enable row level security;
alter table public.vehicules enable row level security;
alter table public.clients enable row level security;
alter table public.livraisons enable row level security;
alter table public.absences_periodes enable row level security;
alter table public.plannings_hebdo enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.messages enable row level security;
alter table public.carburant enable row level security;
alter table public.entretiens enable row level security;
alter table public.charges enable row level security;
alter table public.incidents enable row level security;

create policy "profiles self read" on public.profiles
for select using (auth.uid() = id);

create policy "profiles self update" on public.profiles
for update using (auth.uid() = id);

create policy "salaries self read" on public.salaries
for select using (profile_id = auth.uid());

create policy "inspections self read" on public.inspections
for select using (
  salarie_id in (
    select s.id from public.salaries s where s.profile_id = auth.uid()
  )
);

create policy "inspections self insert" on public.inspections
for insert with check (
  salarie_id in (
    select s.id from public.salaries s where s.profile_id = auth.uid()
  )
);

create policy "inspection photos self read" on public.inspection_photos
for select using (
  salarie_id in (
    select s.id from public.salaries s where s.profile_id = auth.uid()
  )
);

create policy "messages self read" on public.messages
for select using (
  destinataire_salarie_id in (
    select s.id from public.salaries s where s.profile_id = auth.uid()
  )
  or auteur_salarie_id in (
    select s.id from public.salaries s where s.profile_id = auth.uid()
  )
);

-- Les policies admin seront plus simples a finaliser quand l'auth admin sera branchee.
