-- ====================================================================
-- Migration 030 — Purge legacy app_state.payload pour entites migrees
-- ====================================================================
-- Suite a l'audit migration : les cles metier (clients, vehicules, salaries,
-- livraisons, charges, carburant, entretiens, paiements, incidents,
-- fournisseurs, chauffeurs) sont desormais sur tables natives via les
-- adapters Supabase. Le payload app_state ne devrait plus contenir ces cles.
--
-- Avant la mise en place du filtre `isEligibleKey` dans
-- supabase-storage-sync.js, ces cles etaient encore poussees dans le sac
-- fourre-tout app_state.payload. La presente migration nettoie les residus.
--
-- Verification effectuee en amont :
--   - charges (4 ids dans payload) : tous presents dans public.charges (6 lignes)
--   - fournisseurs (4 ids dans payload) : tous presents dans public.fournisseurs
--   - carburant (1 id dans payload) : ABSENT de public.carburant -> insere
--     ci-dessous avant purge pour ne pas perdre la donnee
-- ====================================================================

-- 1. Recuperer la ligne carburant orpheline du payload (si elle n'a pas
--    deja ete migree par un boot d'app entre-temps)
insert into public.carburant (
  id, vehicule_id, salarie_id, date_plein, litres,
  prix_ttc, prix_ht, taux_tva, kilometrage, type_carburant,
  photo_recu_path, created_at, updated_at
)
values (
  'a7fa6f69-91c2-410d-973c-b6881b495516'::uuid,
  null, null,
  '2026-03-26'::date,
  350, 665, 554.17, 20,
  0, '', '',
  '2026-03-26T23:37:19.517311+00:00'::timestamptz,
  now()
)
on conflict (id) do nothing;

-- 2. Purger les cles metier dupliquees du payload app_state
update public.app_state
set payload = payload
    - 'clients' - 'vehicules' - 'salaries' - 'livraisons'
    - 'charges' - 'carburant' - 'entretiens' - 'paiements'
    - 'incidents' - 'fournisseurs' - 'chauffeurs',
    updated_at = now()
where scope = 'global';
