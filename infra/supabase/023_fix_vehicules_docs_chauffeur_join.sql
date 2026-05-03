-- ====================================================================
-- Migration 023 — Fix policy 'vehicules-docs chauffeur read'
-- ====================================================================
-- 022 utilisait `v.salarie_id = auth.uid()` mais vehicules.salarie_id
-- reference salaries.id (pas auth.users.id). La policy renvoyait toujours
-- faux -> chauffeurs ne pouvaient jamais lire leurs docs vehicule.
--
-- Fix : passer par salaries.profile_id qui pointe sur auth.users.id.
-- Pattern aligne avec 'salaries-docs' (009_phase0_storage_buckets.sql).
-- ====================================================================

drop policy if exists "vehicules docs chauffeur read" on storage.objects;
create policy "vehicules docs chauffeur read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'vehicules-docs'
  and exists (
    select 1 from public.vehicules v
    join public.salaries s on s.id = v.salarie_id
    where v.id::text = split_part(name, '/', 1)
      and s.profile_id = auth.uid()
  )
);
