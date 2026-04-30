-- DelivPro - Phase 5 : nettoyage app_state.payload + drop triggers transition
--
-- Bug en prod : "canceling statement due to statement timeout" sur l'adapter
-- fournisseurs. Cause racine : app_state.payload contient encore des cles
-- legacy lourdes (vehicules avec base64 carte grise = 3 MB), et les 11
-- triggers trg_app_state_sync_* parcourent ce JSON a chaque update de
-- app_state. Avec 74 MB de bloat MVCC sur app_state, chaque UPDATE genere
-- 11 triggers x ~3 MB de parse JSON + INSERT ON CONFLICT -> timeout.
--
-- Maintenant que toutes les entites metier sont sur tables natives via
-- leurs adapters dedies (12 entites au total), les triggers transition
-- ne servent plus. On les drop pour que app_state ne soit plus un
-- carrefour de logique.

-- =====================================================
-- 1. Purge des cles legacy lourdes de app_state.payload
-- =====================================================
-- Garde uniquement les cles UI/config qui ont du sens en multi-device.
-- Le reste (vehicules, livraisons, etc.) est sur tables natives,
-- l'audit_log local est par-device, etc.

update public.app_state
set payload = payload
  - 'vehicules'        -- migre vers public.vehicules (~3 MB economises)
  - 'livraisons'       -- migre vers public.livraisons
  - 'clients'          -- migre vers public.clients
  - 'salaries'         -- migre vers public.salaries
  - 'fournisseurs'     -- migre vers public.fournisseurs
  - 'charges'          -- migre vers public.charges
  - 'carburant'        -- migre vers public.carburant
  - 'entretiens'       -- migre vers public.entretiens
  - 'paiements'        -- migre vers public.paiements
  - 'incidents'        -- migre vers public.incidents
  - 'alertes_admin'    -- ne sert pas en multi-device
  - 'audit_log'        -- log par-device, pas utile multi-device
  - 'history_log'      -- idem
  - 'admin_edit_locks' -- recalcule au boot
  - 'modifs_liv_22ebd2df-2168-4adf-9e87-36a0f54ab8d3'
  - 'modifs_liv_2349fd94-1915-4cd9-8c99-b89a9e91727d'
  - 'modifs_liv_2a3915fc-9727-4594-a6f7-125c67237694'
  - 'modifs_liv_4273080c-83fe-49e3-b00e-97c004d1f911'
  - 'modifs_liv_5a75e6c3-78f5-4a28-91fa-e058bf32d472'
  - 'modifs_liv_60fef17c-3c6f-4eb9-a8b1-2538e5f694a5'
  - 'modifs_liv_e58d2f0e-59fb-4bfb-bf12-d2f51fa29d49'
where scope = 'global';

-- =====================================================
-- 2. Drop des triggers transition app_state -> tables natives
-- =====================================================
-- Toutes les entites sont desormais sur tables natives. Ces triggers
-- ralentissaient chaque update de app_state pour rien.

drop trigger if exists trg_app_state_sync_clients on public.app_state;
drop trigger if exists trg_app_state_sync_vehicules on public.app_state;
drop trigger if exists trg_app_state_sync_salaries on public.app_state;
drop trigger if exists trg_app_state_sync_livraisons on public.app_state;
drop trigger if exists trg_app_state_sync_charges on public.app_state;
drop trigger if exists trg_app_state_sync_carburant on public.app_state;
drop trigger if exists trg_app_state_sync_entretiens on public.app_state;
drop trigger if exists trg_app_state_sync_paiements on public.app_state;
drop trigger if exists trg_app_state_sync_incidents on public.app_state;
drop trigger if exists trg_app_state_sync_fournisseurs on public.app_state;

-- Drop les fonctions associees (plus referencees)
drop function if exists public.app_state_sync_clients_to_native();
drop function if exists public.app_state_sync_vehicules_to_native();
drop function if exists public.app_state_sync_salaries_to_native();
drop function if exists public.app_state_sync_livraisons_to_native();
drop function if exists public.app_state_sync_charges_to_native();
drop function if exists public.app_state_sync_carburant_to_native();
drop function if exists public.app_state_sync_entretiens_to_native();
drop function if exists public.app_state_sync_paiements_to_native();
drop function if exists public.app_state_sync_incidents_to_native();
drop function if exists public.app_state_sync_fournisseurs_to_native();

-- =====================================================
-- 3. VACUUM (recupere l'espace MVCC sur app_state)
-- =====================================================
-- Note : VACUUM ne peut pas etre dans une transaction. Lance manuellement
-- via le SQL editor de Supabase apres avoir applique cette migration :
--   VACUUM (ANALYZE) public.app_state;
-- (Ou en autovacuum, qui passera dans les minutes/heures qui suivent.)
