-- DelivPro - Phase 2.x : trigger transition app_state -> tables natives
--
-- Pendant la transition Phase 2.x, certains devices peuvent encore avoir une
-- version cachee du code qui sync les entites via app_state.payload.<entity>.
-- Ce trigger absorbe ces ecritures en propageant l'upsert vers la table native,
-- meme si le client n'a pas encore la nouvelle version de l'app.
--
-- Ne gere que UPSERT (pas DELETE) : un client supprime depuis une vieille version
-- ne sera pas supprime de la table native. Acceptable pendant la transition.
--
-- A retirer une fois que tous les devices sont a jour (Phase 4 cleanup).

create or replace function public.app_state_sync_clients_to_native()
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
  legacy := coalesce((new.payload->>'clients')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;

  for item in select * from jsonb_array_elements(legacy)
  loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;

    insert into public.clients (
      id, nom, prenom, contact, telephone, email, adresse, cp, ville, type,
      siren, tva_intracom, email_fact, delai_paiement_jours, notes, created_at
    ) values (
      (item->>'id')::uuid,
      coalesce(nullif(item->>'nom',''), 'Sans nom'),
      nullif(item->>'prenom',''),
      nullif(item->>'contact',''),
      nullif(item->>'tel',''),
      nullif(item->>'email',''),
      nullif(item->>'adresse',''),
      nullif(item->>'cp',''),
      nullif(item->>'ville',''),
      nullif(item->>'type',''),
      nullif(item->>'siren',''),
      nullif(item->>'tvaIntra',''),
      nullif(item->>'emailFact',''),
      coalesce(nullif(item->>'delaiPaiementJours','')::int, 30),
      nullif(item->>'notes',''),
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      nom = excluded.nom,
      prenom = excluded.prenom,
      contact = excluded.contact,
      telephone = excluded.telephone,
      email = excluded.email,
      adresse = excluded.adresse,
      cp = excluded.cp,
      ville = excluded.ville,
      type = excluded.type,
      siren = excluded.siren,
      tva_intracom = excluded.tva_intracom,
      email_fact = excluded.email_fact,
      delai_paiement_jours = excluded.delai_paiement_jours,
      notes = excluded.notes;
  end loop;

  return new;
end $$;

drop trigger if exists trg_app_state_sync_clients on public.app_state;
create trigger trg_app_state_sync_clients
after insert or update on public.app_state
for each row execute function public.app_state_sync_clients_to_native();

-- =====================================================
-- Idem pour vehicules
-- =====================================================
create or replace function public.app_state_sync_vehicules_to_native()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy jsonb;
  item jsonb;
  finance_obj jsonb;
  assurance_obj jsonb;
begin
  if new.scope <> 'global' then return new; end if;
  legacy := coalesce((new.payload->>'vehicules')::jsonb, '[]'::jsonb);
  if jsonb_typeof(legacy) <> 'array' then return new; end if;

  for item in select * from jsonb_array_elements(legacy)
  loop
    if (item->>'id') is null then continue; end if;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
    if (item->>'immat') is null or (item->>'immat') = '' then continue; end if;

    -- Reconstitue les sous-objets finance et assurance
    assurance_obj := coalesce(item->'assurance', '{}'::jsonb);
    finance_obj := jsonb_build_object(
      'prixAchatHT', item->'prixAchatHT',
      'tauxTVAAchat', item->'tauxTVAAchat',
      'prixAchatTTC', item->'prixAchatTTC',
      'dureeAmortissement', item->'dureeAmortissement',
      'modeAmortissement', item->>'modeAmortissement',
      'dateMiseAuRebut', item->>'dateMiseAuRebut',
      'valeurMiseAuRebut', item->'valeurMiseAuRebut',
      'kmRachat', item->'kmRachat',
      'anneeVehicule', item->'anneeVehicule',
      'prixCatalogueHT', item->'prixCatalogueHT',
      'loyerMensuelHT', item->'loyerMensuelHT',
      'apportInitialHT', item->'apportInitialHT',
      'dureeContratMois', item->'dureeContratMois',
      'kmInclusContrat', item->'kmInclusContrat',
      'dateFinContrat', item->>'dateFinContrat',
      'depotGarantieHT', item->'depotGarantieHT',
      'coutKmExcedentaire', item->'coutKmExcedentaire',
      'creditApportHT', item->'creditApportHT',
      'creditMensualiteHT', item->'creditMensualiteHT',
      'creditDureeMois', item->'creditDureeMois',
      'creditTaeg', item->'creditTaeg',
      'creditCoutTotalHT', item->'creditCoutTotalHT',
      'loaOptionAchatHT', item->'loaOptionAchatHT'
    );

    insert into public.vehicules (
      id, immat, modele, kilometrage, km_initial, conso,
      date_ct, date_ct_dernier, tva_carburant_deductible,
      mode_acquisition, date_acquisition,
      entretien_interval_km, entretien_interval_mois,
      genre, carburant, ptac, ptra, essieux, crit_air,
      date_1_immat, vin, carte_grise_ref,
      date_assurance,
      salarie_id, salarie_nom_cache,
      assurance, finance, created_at
    ) values (
      (item->>'id')::uuid,
      item->>'immat',
      nullif(item->>'modele',''),
      coalesce(nullif(item->>'km','')::numeric, 0),
      coalesce(nullif(item->>'kmInitial','')::numeric, 0),
      coalesce(nullif(item->>'conso','')::numeric, 0),
      nullif(item->>'dateCT','')::date,
      nullif(item->>'dateCTDernier','')::date,
      coalesce(nullif(item->>'tvaCarbDeductible','')::numeric, 100),
      coalesce(nullif(item->>'modeAcquisition',''), 'achat'),
      nullif(item->>'dateAcquisition','')::date,
      coalesce(nullif(item->>'entretienIntervalKm','')::numeric, 0),
      coalesce(nullif(item->>'entretienIntervalMois','')::numeric, 0),
      nullif(item->>'genre',''),
      nullif(item->>'carburant',''),
      coalesce(nullif(item->>'ptac','')::int, 0),
      coalesce(nullif(item->>'ptra','')::int, 0),
      coalesce(nullif(item->>'essieux','')::int, 0),
      nullif(item->>'critAir',''),
      nullif(item->>'date1Immat','')::date,
      nullif(item->>'vin',''),
      nullif(item->>'carteGrise',''),
      nullif(assurance_obj->>'dateExpiration','')::date,
      case when (item->>'salId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (item->>'salId')::uuid else null end,
      nullif(item->>'salNom',''),
      assurance_obj,
      finance_obj,
      coalesce(nullif(item->>'creeLe','')::timestamptz, now())
    )
    on conflict (id) do update set
      immat = excluded.immat,
      modele = excluded.modele,
      kilometrage = excluded.kilometrage,
      km_initial = excluded.km_initial,
      conso = excluded.conso,
      date_ct = excluded.date_ct,
      date_ct_dernier = excluded.date_ct_dernier,
      tva_carburant_deductible = excluded.tva_carburant_deductible,
      mode_acquisition = excluded.mode_acquisition,
      date_acquisition = excluded.date_acquisition,
      entretien_interval_km = excluded.entretien_interval_km,
      entretien_interval_mois = excluded.entretien_interval_mois,
      genre = excluded.genre,
      carburant = excluded.carburant,
      ptac = excluded.ptac,
      ptra = excluded.ptra,
      essieux = excluded.essieux,
      crit_air = excluded.crit_air,
      date_1_immat = excluded.date_1_immat,
      vin = excluded.vin,
      carte_grise_ref = excluded.carte_grise_ref,
      date_assurance = excluded.date_assurance,
      salarie_id = excluded.salarie_id,
      salarie_nom_cache = excluded.salarie_nom_cache,
      assurance = excluded.assurance,
      finance = excluded.finance;
  end loop;

  return new;
end $$;

drop trigger if exists trg_app_state_sync_vehicules on public.app_state;
create trigger trg_app_state_sync_vehicules
after insert or update on public.app_state
for each row execute function public.app_state_sync_vehicules_to_native();
