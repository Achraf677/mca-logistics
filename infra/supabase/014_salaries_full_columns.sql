-- DelivPro - Phase 2.3 : completer colonnes salaries + realtime + trigger legacy

-- =====================================================
-- 1. Colonnes manquantes
-- =====================================================
alter table public.salaries add column if not exists nom_famille text;
alter table public.salaries add column if not exists email_personnel text;
alter table public.salaries add column if not exists mdp_hash text;
alter table public.salaries add column if not exists date_permis date;
alter table public.salaries add column if not exists date_assurance date;
alter table public.salaries add column if not exists categorie_permis text;
alter table public.salaries add column if not exists visite_medicale jsonb default '{}'::jsonb;

-- =====================================================
-- 2. Realtime
-- =====================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salaries'
  ) then
    execute 'alter publication supabase_realtime add table public.salaries';
  end if;
end $$;

-- =====================================================
-- 3. Trigger transition app_state -> public.salaries
-- =====================================================
create or replace function public.app_state_sync_salaries_to_native()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy jsonb;
  item jsonb;
  vm_obj jsonb;
begin
  if new.scope <> 'global' then return new; end if;
  legacy := coalesce((new.payload->>'salaries')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;

  for item in select * from jsonb_array_elements(legacy)
  loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
    if (item->>'numero') is null or (item->>'numero') = '' then continue; end if;

    vm_obj := coalesce(item->'visiteMedicale', '{}'::jsonb);

    insert into public.salaries (
      id, numero, nom, nom_famille, prenom, poste,
      permis, categorie_permis, date_permis, assurance, date_assurance,
      telephone, email, email_personnel, mdp_hash,
      visite_medicale, actif, created_at
    ) values (
      (item->>'id')::uuid,
      item->>'numero',
      coalesce(nullif(item->>'nom',''), 'Sans nom'),
      nullif(item->>'nomFamille',''),
      nullif(item->>'prenom',''),
      nullif(item->>'poste',''),
      nullif(item->>'permis',''),
      nullif(item->>'categoriePermis',''),
      nullif(item->>'datePermis','')::date,
      nullif(item->>'assurance',''),
      nullif(item->>'dateAssurance','')::date,
      nullif(item->>'tel',''),
      nullif(item->>'email',''),
      nullif(item->>'emailPersonnel',''),
      nullif(item->>'mdpHash',''),
      vm_obj,
      coalesce((item->>'actif')::boolean, true),
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      numero = excluded.numero,
      nom = excluded.nom,
      nom_famille = excluded.nom_famille,
      prenom = excluded.prenom,
      poste = excluded.poste,
      permis = excluded.permis,
      categorie_permis = excluded.categorie_permis,
      date_permis = excluded.date_permis,
      assurance = excluded.assurance,
      date_assurance = excluded.date_assurance,
      telephone = excluded.telephone,
      email = excluded.email,
      email_personnel = excluded.email_personnel,
      mdp_hash = excluded.mdp_hash,
      visite_medicale = excluded.visite_medicale,
      actif = excluded.actif;
  end loop;

  return new;
end $$;

drop trigger if exists trg_app_state_sync_salaries on public.app_state;
create trigger trg_app_state_sync_salaries
after insert or update on public.app_state
for each row execute function public.app_state_sync_salaries_to_native();
