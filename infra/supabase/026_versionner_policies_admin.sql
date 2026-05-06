-- ====================================================================
-- Migration 026 — Versionner les policies admin manquantes
-- ====================================================================
-- L'audit RLS a identifie que certaines tables avec RLS active n'avaient
-- PAS de policy admin "for all" explicite : un admin pouvait etre bloque
-- par les RLS sur ces tables, ou ne disposait que d'acces partiels via
-- les policies "self" des chauffeurs.
--
-- Tables concernees (admin all manquant) :
--   - inspections        : seules policies self read/insert existaient
--   - inspection_photos  : seule policy self read existait
--   - messages           : seule policy self read existait
--
-- Tables deja couvertes (skip) :
--   - charges, carburant, entretiens, incidents, livraisons, clients,
--     vehicules, fournisseurs, paiements, alertes_admin
--     => deja "<table> admin all" en for all using is_admin()
--   - salaries => policies admin per-cmd (read/insert/update/delete)
--   - audit_log_entries => admin SELECT only (intentionnel : journal
--     append-only ecrit via triggers SECURITY DEFINER)
--
-- Pattern : create policy "<table> admin all" on public.<table>
--           for all to authenticated
--           using (public.is_admin())
--           with check (public.is_admin());
--
-- Les policies existantes (self read/insert pour chauffeurs) sont
-- preservees telles quelles.
-- ====================================================================

-- inspections : ajouter admin all
drop policy if exists "inspections admin all" on public.inspections;
create policy "inspections admin all"
on public.inspections for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- inspection_photos : ajouter admin all
drop policy if exists "inspection_photos admin all" on public.inspection_photos;
create policy "inspection_photos admin all"
on public.inspection_photos for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- messages : ajouter admin all
drop policy if exists "messages admin all" on public.messages;
create policy "messages admin all"
on public.messages for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
