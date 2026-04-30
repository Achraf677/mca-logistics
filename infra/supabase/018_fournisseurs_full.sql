-- DelivPro - Phase 4.1 : completer fournisseurs + realtime + trigger transition
-- Bug fix : la creation auto de fournisseur depuis modal charge violait la
-- FK charges_fournisseur_id_fkey car fournisseurs etait encore sync via
-- app_state (legacy lent), donc le fournisseur n'arrivait pas en DB avant
-- la charge qui le reference.

-- =====================================================
-- 1. Colonnes manquantes pour mapping JS<->DB lossless
-- =====================================================
alter table public.fournisseurs add column if not exists contact text;
alter table public.fournisseurs add column if not exists prenom text;
alter table public.fournisseurs add column if not exists email_fact text;
alter table public.fournisseurs add column if not exists cp text;
alter table public.fournisseurs add column if not exists ville text;
alter table public.fournisseurs add column if not exists delai_paiement_jours integer default 30;
alter table public.fournisseurs add column if not exists extra jsonb default '{}'::jsonb;

-- =====================================================
-- 2. Realtime ON
-- =====================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fournisseurs'
  ) then
    execute 'alter publication supabase_realtime add table public.fournisseurs';
  end if;
end $$;

-- =====================================================
-- 3. Trigger transition app_state.payload -> public.fournisseurs
-- =====================================================
create or replace function public.app_state_sync_fournisseurs_to_native()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy jsonb;
  item jsonb;
begin
  if new.scope <> 'global' then return new; end if;
  legacy := coalesce((new.payload->>'fournisseurs')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;

  for item in select * from jsonb_array_elements(legacy)
  loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;

    insert into public.fournisseurs (
      id, nom, type, secteur, contact, prenom, telephone, email, email_fact,
      adresse, cp, ville, siren, tva_intracom, paiement_mode, iban, bic,
      delai_paiement_jours, notes, extra, created_at
    ) values (
      (item->>'id')::uuid,
      coalesce(nullif(item->>'nom',''), 'Sans nom'),
      coalesce(nullif(item->>'type',''), 'Pro'),
      nullif(item->>'secteur',''),
      nullif(item->>'contact',''),
      nullif(item->>'prenom',''),
      nullif(item->>'tel',''),
      nullif(item->>'email',''),
      nullif(item->>'emailFact',''),
      nullif(item->>'adresse',''),
      nullif(item->>'cp',''),
      nullif(item->>'ville',''),
      nullif(item->>'siren',''),
      nullif(item->>'tvaIntra',''),
      coalesce(nullif(item->>'modePaiement',''), 'virement'),
      nullif(item->>'iban',''),
      nullif(item->>'bic',''),
      coalesce(nullif(item->>'delaiPaiementJours','')::int, 30),
      nullif(item->>'notes',''),
      coalesce(item, '{}'::jsonb),
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      nom = excluded.nom, type = excluded.type, secteur = excluded.secteur,
      contact = excluded.contact, prenom = excluded.prenom,
      telephone = excluded.telephone, email = excluded.email, email_fact = excluded.email_fact,
      adresse = excluded.adresse, cp = excluded.cp, ville = excluded.ville,
      siren = excluded.siren, tva_intracom = excluded.tva_intracom,
      paiement_mode = excluded.paiement_mode, iban = excluded.iban, bic = excluded.bic,
      delai_paiement_jours = excluded.delai_paiement_jours,
      notes = excluded.notes, extra = excluded.extra;
  end loop;

  return new;
end $$;

drop trigger if exists trg_app_state_sync_fournisseurs on public.app_state;
create trigger trg_app_state_sync_fournisseurs
after insert or update on public.app_state
for each row execute function public.app_state_sync_fournisseurs_to_native();
