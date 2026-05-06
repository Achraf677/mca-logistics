-- ====================================================================
-- Migration 031 — Policy chauffeur read sur vehicules-cartes-grises
-- ====================================================================
-- Le bucket avait deja 'admin all' mais aucune policy chauffeur, alors
-- que vehicules-docs (similaire) en a une. Pour coherence et utilite
-- pratique (un chauffeur doit pouvoir consulter la carte grise de son
-- vehicule en cas de controle routier), on ajoute une policy SELECT
-- scoped au vehicule affecte au chauffeur.
--
-- Pattern : path Storage = '<vehiculeId>/...', join vehicules.salarie_id
-- -> salaries.profile_id -> auth.uid() (meme pattern que vehicules-docs
-- post-fix migration 023).
-- ====================================================================

drop policy if exists "vehicules cartes grises chauffeur read" on storage.objects;
create policy "vehicules cartes grises chauffeur read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'vehicules-cartes-grises'
  and exists (
    select 1 from public.vehicules v
    join public.salaries s on s.id = v.salarie_id
    where v.id::text = split_part(name, '/', 1)
      and s.profile_id = auth.uid()
  )
);
