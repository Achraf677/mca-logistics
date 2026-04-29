-- DelivPro - Phase 4 : finaliser sync entites restantes vers tables natives
-- (livraisons, charges, carburant, entretiens, paiements, incidents)
--
-- Objectifs :
-- 1. Colonne `extra` jsonb sur chaque table : filet pour les champs custom JS
--    qui n'ont pas de colonne DB dediee (round-trip lossless).
-- 2. Realtime ON sur les 6 tables -> sync instantanee entre admins.
-- 3. Triggers transition app_state.payload -> tables natives (pour absorber
--    les writes des devices avec versions cachees, comme on l'a fait pour
--    clients/vehicules/salaries).

-- =====================================================
-- 1. Colonne extra (filet round-trip)
-- =====================================================
alter table public.livraisons add column if not exists extra jsonb default '{}'::jsonb;
alter table public.charges    add column if not exists extra jsonb default '{}'::jsonb;
alter table public.carburant  add column if not exists extra jsonb default '{}'::jsonb;
alter table public.entretiens add column if not exists extra jsonb default '{}'::jsonb;
alter table public.paiements  add column if not exists extra jsonb default '{}'::jsonb;
alter table public.incidents  add column if not exists extra jsonb default '{}'::jsonb;

-- =====================================================
-- 2. Statut paiement / autres champs metier qui pourraient manquer
-- =====================================================
-- incidents : pas de statut/chauffeur dans la table, on les met dans extra
alter table public.incidents add column if not exists statut text default 'ouvert';

-- paiements : champ frais / commentaires custom
alter table public.paiements add column if not exists frais numeric(12,2) default 0;

-- =====================================================
-- 3. Realtime ON
-- =====================================================
do $$
declare t_name text;
begin
  for t_name in
    select unnest(array['livraisons','charges','carburant','entretiens','paiements','incidents'])
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t_name);
    end if;
  end loop;
end $$;

-- =====================================================
-- 4. Triggers transition app_state.payload -> tables natives
-- =====================================================
-- Generique : pour chaque entite, parcourt payload->'<entity>' et UPSERT
-- les rows avec id UUID-like. On ne gere que UPSERT (pas DELETE).

create or replace function public.app_state_sync_livraisons_to_native()
returns trigger language plpgsql security definer set search_path = public as $$
declare legacy jsonb; item jsonb;
begin
  if new.scope <> 'global' then return new; end if;
  legacy := coalesce((new.payload->>'livraisons')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;
  for item in select * from jsonb_array_elements(legacy) loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
    if (item->>'date') is null and (item->>'dateLivraison') is null then continue; end if;
    insert into public.livraisons (
      id, num_liv, client_nom, date_livraison, distance_km, prix_ht, taux_tva, prix_ttc,
      statut, statut_paiement, zone, depart, arrivee, notes,
      client_siren, client_tva_intracom, client_pays, date_paiement, tva_montant,
      kilometrage_compteur,
      client_id, salarie_id, vehicule_id,
      extra, created_at
    ) values (
      (item->>'id')::uuid,
      nullif(item->>'numLiv',''),
      nullif(item->>'client',''),
      coalesce(nullif(item->>'date','')::date, nullif(item->>'dateLivraison','')::date, current_date),
      coalesce(nullif(item->>'distance','')::numeric, 0),
      coalesce(nullif(item->>'prixHT','')::numeric, 0),
      coalesce(nullif(item->>'tauxTVA','')::numeric, 20),
      coalesce(nullif(item->>'prix','')::numeric, 0),
      nullif(item->>'statut',''),
      nullif(item->>'statutPaiement',''),
      nullif(item->>'zone',''),
      nullif(item->>'depart',''),
      nullif(item->>'arrivee',''),
      nullif(item->>'notes',''),
      nullif(item->>'clientSiren',''),
      nullif(item->>'clientTvaIntracom',''),
      nullif(item->>'clientPays',''),
      nullif(item->>'datePaiement','')::date,
      coalesce(nullif(item->>'tvaMontant','')::numeric, 0),
      nullif(item->>'kmCompteur','')::numeric,
      case when (item->>'clientId') ~* '^[0-9a-f]{8}-' then (item->>'clientId')::uuid else null end,
      case when (item->>'chaufId') ~* '^[0-9a-f]{8}-' then (item->>'chaufId')::uuid else null end,
      case when (item->>'vehId') ~* '^[0-9a-f]{8}-' then (item->>'vehId')::uuid else null end,
      coalesce(item, '{}'::jsonb),
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      num_liv = excluded.num_liv, client_nom = excluded.client_nom,
      date_livraison = excluded.date_livraison, distance_km = excluded.distance_km,
      prix_ht = excluded.prix_ht, taux_tva = excluded.taux_tva, prix_ttc = excluded.prix_ttc,
      statut = excluded.statut, statut_paiement = excluded.statut_paiement,
      zone = excluded.zone, depart = excluded.depart, arrivee = excluded.arrivee, notes = excluded.notes,
      client_siren = excluded.client_siren, client_tva_intracom = excluded.client_tva_intracom,
      client_pays = excluded.client_pays, date_paiement = excluded.date_paiement,
      tva_montant = excluded.tva_montant, kilometrage_compteur = excluded.kilometrage_compteur,
      client_id = excluded.client_id, salarie_id = excluded.salarie_id, vehicule_id = excluded.vehicule_id,
      extra = excluded.extra;
  end loop;
  return new;
end $$;

drop trigger if exists trg_app_state_sync_livraisons on public.app_state;
create trigger trg_app_state_sync_livraisons
after insert or update on public.app_state
for each row execute function public.app_state_sync_livraisons_to_native();

-- Pour charges/carburant/entretiens/paiements/incidents : trigger generique simplifie
-- qui upsert les fields communs + extra. On ne mappe pas tous les champs custom,
-- l'adapter cote JS s'occupera de la richesse.

create or replace function public.app_state_sync_charges_to_native()
returns trigger language plpgsql security definer set search_path = public as $$
declare legacy jsonb; item jsonb;
begin
  if new.scope <> 'global' then return new; end if;
  legacy := coalesce((new.payload->>'charges')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;
  for item in select * from jsonb_array_elements(legacy) loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
    insert into public.charges (
      id, categorie, description, date_charge, montant_ttc, montant_ht, taux_tva,
      taux_deductibilite, fournisseur_nom, vehicule_id, fournisseur_id,
      extra, created_at
    ) values (
      (item->>'id')::uuid,
      coalesce(nullif(item->>'categorie',''), nullif(item->>'type',''), 'autre'),
      nullif(item->>'description',''),
      coalesce(nullif(item->>'date','')::date, current_date),
      coalesce(nullif(item->>'montant','')::numeric, nullif(item->>'montantTTC','')::numeric, 0),
      coalesce(nullif(item->>'montantHT','')::numeric, 0),
      coalesce(nullif(item->>'tauxTVA','')::numeric, 20),
      coalesce(nullif(item->>'tauxDeductibilite','')::numeric, 100),
      nullif(item->>'fournisseur',''),
      case when (item->>'vehId') ~* '^[0-9a-f]{8}-' then (item->>'vehId')::uuid else null end,
      case when (item->>'fournisseurId') ~* '^[0-9a-f]{8}-' then (item->>'fournisseurId')::uuid else null end,
      coalesce(item, '{}'::jsonb),
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      categorie = excluded.categorie, description = excluded.description,
      date_charge = excluded.date_charge, montant_ttc = excluded.montant_ttc,
      montant_ht = excluded.montant_ht, taux_tva = excluded.taux_tva,
      taux_deductibilite = excluded.taux_deductibilite,
      fournisseur_nom = excluded.fournisseur_nom, vehicule_id = excluded.vehicule_id,
      fournisseur_id = excluded.fournisseur_id, extra = excluded.extra;
  end loop;
  return new;
end $$;
drop trigger if exists trg_app_state_sync_charges on public.app_state;
create trigger trg_app_state_sync_charges after insert or update on public.app_state
for each row execute function public.app_state_sync_charges_to_native();

create or replace function public.app_state_sync_carburant_to_native()
returns trigger language plpgsql security definer set search_path = public as $$
declare legacy jsonb; item jsonb;
begin
  if new.scope <> 'global' then return new; end if;
  legacy := coalesce((new.payload->>'carburant')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;
  for item in select * from jsonb_array_elements(legacy) loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
    insert into public.carburant (
      id, date_plein, litres, prix_ttc, prix_ht, taux_tva,
      kilometrage, type_carburant, photo_recu_path,
      vehicule_id, salarie_id, extra, created_at
    ) values (
      (item->>'id')::uuid,
      coalesce(nullif(item->>'date','')::date, current_date),
      coalesce(nullif(item->>'litres','')::numeric, 0),
      coalesce(nullif(item->>'total','')::numeric, nullif(item->>'prixTTC','')::numeric, 0),
      coalesce(nullif(item->>'prixHT','')::numeric, 0),
      coalesce(nullif(item->>'tauxTVA','')::numeric, 20),
      nullif(item->>'km','')::numeric,
      nullif(item->>'typeCarburant',''),
      nullif(item->>'photoRecuPath',''),
      case when (item->>'vehId') ~* '^[0-9a-f]{8}-' then (item->>'vehId')::uuid else null end,
      case when (item->>'salId') ~* '^[0-9a-f]{8}-' then (item->>'salId')::uuid else null end,
      coalesce(item, '{}'::jsonb),
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      date_plein = excluded.date_plein, litres = excluded.litres,
      prix_ttc = excluded.prix_ttc, prix_ht = excluded.prix_ht, taux_tva = excluded.taux_tva,
      kilometrage = excluded.kilometrage, type_carburant = excluded.type_carburant,
      photo_recu_path = excluded.photo_recu_path,
      vehicule_id = excluded.vehicule_id, salarie_id = excluded.salarie_id,
      extra = excluded.extra;
  end loop;
  return new;
end $$;
drop trigger if exists trg_app_state_sync_carburant on public.app_state;
create trigger trg_app_state_sync_carburant after insert or update on public.app_state
for each row execute function public.app_state_sync_carburant_to_native();

create or replace function public.app_state_sync_entretiens_to_native()
returns trigger language plpgsql security definer set search_path = public as $$
declare legacy jsonb; item jsonb;
begin
  if new.scope <> 'global' then return new; end if;
  legacy := coalesce((new.payload->>'entretiens')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;
  for item in select * from jsonb_array_elements(legacy) loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
    insert into public.entretiens (
      id, date_entretien, type, description, cout_ttc, cout_ht, taux_tva,
      kilometrage, prochain_km, prochaine_date, vehicule_id, extra, created_at
    ) values (
      (item->>'id')::uuid,
      coalesce(nullif(item->>'date','')::date, current_date),
      nullif(item->>'type',''),
      nullif(item->>'description',''),
      coalesce(nullif(item->>'cout','')::numeric, nullif(item->>'coutTTC','')::numeric, 0),
      coalesce(nullif(item->>'coutHT','')::numeric, 0),
      coalesce(nullif(item->>'tauxTVA','')::numeric, 20),
      nullif(item->>'km','')::numeric,
      nullif(item->>'prochainKm','')::numeric,
      nullif(item->>'prochaineDate','')::date,
      case when (item->>'vehId') ~* '^[0-9a-f]{8}-' then (item->>'vehId')::uuid else null end,
      coalesce(item, '{}'::jsonb),
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      date_entretien = excluded.date_entretien, type = excluded.type,
      description = excluded.description, cout_ttc = excluded.cout_ttc, cout_ht = excluded.cout_ht,
      taux_tva = excluded.taux_tva, kilometrage = excluded.kilometrage,
      prochain_km = excluded.prochain_km, prochaine_date = excluded.prochaine_date,
      vehicule_id = excluded.vehicule_id, extra = excluded.extra;
  end loop;
  return new;
end $$;
drop trigger if exists trg_app_state_sync_entretiens on public.app_state;
create trigger trg_app_state_sync_entretiens after insert or update on public.app_state
for each row execute function public.app_state_sync_entretiens_to_native();

create or replace function public.app_state_sync_paiements_to_native()
returns trigger language plpgsql security definer set search_path = public as $$
declare legacy jsonb; item jsonb;
begin
  if new.scope <> 'global' then return new; end if;
  legacy := coalesce((new.payload->>'paiements')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;
  for item in select * from jsonb_array_elements(legacy) loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
    insert into public.paiements (
      id, date_paiement, montant, mode, reference, frais, notes,
      livraison_id, client_id, extra, created_at
    ) values (
      (item->>'id')::uuid,
      coalesce(nullif(item->>'date','')::date, current_date),
      coalesce(nullif(item->>'montant','')::numeric, 0),
      nullif(item->>'mode',''),
      nullif(item->>'reference',''),
      coalesce(nullif(item->>'frais','')::numeric, 0),
      nullif(item->>'notes',''),
      case when (item->>'livId') ~* '^[0-9a-f]{8}-' then (item->>'livId')::uuid else null end,
      case when (item->>'clientId') ~* '^[0-9a-f]{8}-' then (item->>'clientId')::uuid else null end,
      coalesce(item, '{}'::jsonb),
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      date_paiement = excluded.date_paiement, montant = excluded.montant,
      mode = excluded.mode, reference = excluded.reference, frais = excluded.frais,
      notes = excluded.notes, livraison_id = excluded.livraison_id,
      client_id = excluded.client_id, extra = excluded.extra;
  end loop;
  return new;
end $$;
drop trigger if exists trg_app_state_sync_paiements on public.app_state;
create trigger trg_app_state_sync_paiements after insert or update on public.app_state
for each row execute function public.app_state_sync_paiements_to_native();

create or replace function public.app_state_sync_incidents_to_native()
returns trigger language plpgsql security definer set search_path = public as $$
declare legacy jsonb; item jsonb;
begin
  if new.scope <> 'global' then return new; end if;
  legacy := coalesce((new.payload->>'incidents')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;
  for item in select * from jsonb_array_elements(legacy) loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
    insert into public.incidents (
      id, gravite, description, date_incident, statut,
      salarie_id, livraison_id, extra, created_at
    ) values (
      (item->>'id')::uuid,
      coalesce(nullif(item->>'gravite',''), 'moyen'),
      coalesce(nullif(item->>'description',''), 'Sans description'),
      coalesce(nullif(item->>'date','')::date, nullif(item->>'dateIncident','')::date, current_date),
      coalesce(nullif(item->>'statut',''), 'ouvert'),
      case when (item->>'salId') ~* '^[0-9a-f]{8}-' then (item->>'salId')::uuid
           when (item->>'chaufId') ~* '^[0-9a-f]{8}-' then (item->>'chaufId')::uuid else null end,
      case when (item->>'livId') ~* '^[0-9a-f]{8}-' then (item->>'livId')::uuid else null end,
      coalesce(item, '{}'::jsonb),
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      gravite = excluded.gravite, description = excluded.description,
      date_incident = excluded.date_incident, statut = excluded.statut,
      salarie_id = excluded.salarie_id, livraison_id = excluded.livraison_id,
      extra = excluded.extra;
  end loop;
  return new;
end $$;
drop trigger if exists trg_app_state_sync_incidents on public.app_state;
create trigger trg_app_state_sync_incidents after insert or update on public.app_state
for each row execute function public.app_state_sync_incidents_to_native();
