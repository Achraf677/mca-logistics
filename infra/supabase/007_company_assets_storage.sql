-- DelivPro - Bucket public pour les assets entreprise (logo)
-- A executer apres 001_init.sql et 002_auth_login_bridge.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company assets public read" on storage.objects;
create policy "company assets public read"
on storage.objects
for select
using (bucket_id = 'company-assets');

drop policy if exists "company assets admin upload" on storage.objects;
create policy "company assets admin upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "company assets admin update" on storage.objects;
create policy "company assets admin update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-assets'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  bucket_id = 'company-assets'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "company assets admin delete" on storage.objects;
create policy "company assets admin delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-assets'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
