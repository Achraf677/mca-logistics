-- ====================================================================
-- Migration 027 — Securisation du bucket inspections-photos (private)
-- ====================================================================
-- Le bucket inspections-photos etait public depuis 006_inspection_storage.sql :
-- toute personne sur internet pouvait acceder aux photos en devinant l'URL.
--
-- Cette migration :
--   1. Bascule le bucket en `public: false` (Supabase n'expose plus
--      l'endpoint /storage/v1/object/public/...).
--   2. Drop la policy publique "inspection photos public read"
--      (anciennement ouverte au role public).
--   3. Recree des policies miroir incidents-photos (cf. 009) :
--        - admin : all (read/write/delete) si profile.role = 'admin'
--        - salarie : SELECT scope sur son propre dossier (folder = salarie.id)
--   4. Conserve les policies existantes pour insert/delete salarie
--      (deja correctes dans 006_inspection_storage.sql).
--
-- Cote applicatif : depuis cette migration, le code doit utiliser
-- createSignedUrl(path, 300) au lieu de getPublicUrl(path).
-- Les photos historiques restent accessibles : le code fait un fallback
-- en extrayant le path depuis les anciennes URLs publiques stockees
-- dans le localStorage chauffeur.
-- ====================================================================

-- 1. Bucket en prive
update storage.buckets
   set public = false
 where id = 'inspections-photos';

-- 2. Drop la policy publique (lecture anonyme)
drop policy if exists "inspection photos public read" on storage.objects;

-- 3a. Admin all (miroir "incidents photos admin all")
drop policy if exists "inspection photos admin all" on storage.objects;
create policy "inspection photos admin all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'inspections-photos'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  bucket_id = 'inspections-photos'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- 3b. Salarie : SELECT uniquement sur son propre dossier
--     Les fichiers sont stockes sous "<salarie.id>/<date>/<timestamp>_<idx>_full.jpg"
--     (cf. uploaderPhotosInspection dans script-salarie.js).
drop policy if exists "inspection photos salarie own read" on storage.objects;
create policy "inspection photos salarie own read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'inspections-photos'
  and (storage.foldername(name))[1] in (
    select s.id::text
    from public.salaries s
    where s.profile_id = auth.uid()
      and coalesce(s.actif, true) = true
  )
);

-- Note : les policies "inspection photos salarie upload" et
-- "inspection photos salarie delete" creees dans 006_inspection_storage.sql
-- restent valides (admin OR scope dossier) et n'ont pas besoin d'etre recreees.
