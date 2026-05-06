-- ====================================================================
-- Migration 022 — Bucket Storage 'vehicules-docs' (mobile v3.55+)
-- ====================================================================
-- Permet l'upload de documents véhicule depuis mobile :
-- carte_grise / assurance / ct / photos / autre.
--
-- Pattern miroir de 'salaries-docs' (009_phase0_storage_buckets.sql:44).
-- ====================================================================

-- 1. Bucket privé image+pdf, 5 MB max
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicules-docs',
  'vehicules-docs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2. RLS : admin all + lecture par chauffeur affecté à ce véhicule
drop policy if exists "vehicules docs admin all" on storage.objects;
create policy "vehicules docs admin all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'vehicules-docs'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  bucket_id = 'vehicules-docs'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "vehicules docs chauffeur read" on storage.objects;
create policy "vehicules docs chauffeur read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'vehicules-docs'
  and exists (
    select 1 from public.vehicules v
    where v.id::text = split_part(name, '/', 1)
      and v.salarie_id = auth.uid()
  )
);
