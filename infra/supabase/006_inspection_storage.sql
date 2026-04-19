-- DelivPro - Bucket et policies Supabase Storage pour les photos d'inspection
-- A executer apres 001_init.sql et 002_auth_login_bridge.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspections-photos',
  'inspections-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "inspection photos public read" on storage.objects;
create policy "inspection photos public read"
on storage.objects
for select
using (bucket_id = 'inspections-photos');

drop policy if exists "inspection photos salarie upload" on storage.objects;
create policy "inspection photos salarie upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'inspections-photos'
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
    or (storage.foldername(name))[1] in (
      select s.id::text
      from public.salaries s
      where s.profile_id = auth.uid()
        and coalesce(s.actif, true) = true
    )
  )
);

drop policy if exists "inspection photos salarie delete" on storage.objects;
create policy "inspection photos salarie delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'inspections-photos'
  and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
    or (storage.foldername(name))[1] in (
      select s.id::text
      from public.salaries s
      where s.profile_id = auth.uid()
        and coalesce(s.actif, true) = true
    )
  )
);
