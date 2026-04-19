-- DelivPro - Passerelle de connexion Supabase
-- A executer apres 001_init.sql

create table if not exists public.admin_identities (
  id uuid primary key default gen_random_uuid(),
  identifiant text not null unique,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_identities enable row level security;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, email, display_name, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'salarie'),
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

insert into public.profiles (id, role, email, display_name, created_at, updated_at)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'role', 'salarie'),
  u.email,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(coalesce(u.email, ''), '@', 1)),
  now(),
  now()
from auth.users u
on conflict (id) do nothing;

create or replace function public.find_login_email(login_kind text, login_identifier text)
returns table (
  email text,
  role text,
  salarie_id uuid,
  display_name text
)
language sql
security definer
set search_path = public
as $$
  select
    ai.email,
    'admin'::text as role,
    null::uuid as salarie_id,
    coalesce(ai.display_name, ai.identifiant) as display_name
  from public.admin_identities ai
  where lower(login_kind) = 'admin'
    and lower(ai.identifiant) = lower(login_identifier)

  union all

  select
    s.email,
    'salarie'::text as role,
    s.id as salarie_id,
    trim(coalesce(s.prenom, '') || ' ' || coalesce(s.nom, '')) as display_name
  from public.salaries s
  where lower(login_kind) = 'salarie'
    and upper(s.numero) = upper(login_identifier)
    and coalesce(s.actif, true) = true
    and s.email is not null
    and s.email <> '';
$$;

grant execute on function public.find_login_email(text, text) to anon, authenticated;
