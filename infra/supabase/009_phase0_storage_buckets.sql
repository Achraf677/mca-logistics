-- DelivPro - Phase 0 : buckets Supabase Storage pour fichiers metier
-- A executer apres 008_phase0_foundations.sql.
--
-- Ces buckets sont PRIVES (public = false). L'app utilisera des signed URLs
-- pour la lecture cote admin/salarie.
--
-- Layout des fichiers (convention) :
--   vehicules-cartes-grises/<vehicule_id>/<filename>
--   salaries-docs/<salarie_id>/<type>/<filename>
--   carburant-recus/<carburant_id>/<filename>
--   messages-photos/<message_id>/<filename>
--   incidents-photos/<incident_id>/<filename>

-- =====================================================
-- 1. Bucket : vehicules-cartes-grises (image + pdf, 5 MB)
-- =====================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicules-cartes-grises',
  'vehicules-cartes-grises',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehicules cartes admin all" on storage.objects;
create policy "vehicules cartes admin all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'vehicules-cartes-grises'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  bucket_id = 'vehicules-cartes-grises'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- =====================================================
-- 2. Bucket : salaries-docs (image + pdf, 5 MB)
-- =====================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'salaries-docs',
  'salaries-docs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "salaries docs admin all" on storage.objects;
create policy "salaries docs admin all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'salaries-docs'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  bucket_id = 'salaries-docs'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "salaries docs self read" on storage.objects;
create policy "salaries docs self read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'salaries-docs'
  and (storage.foldername(name))[1] in (
    select s.id::text from public.salaries s where s.profile_id = auth.uid()
  )
);

-- =====================================================
-- 3. Bucket : carburant-recus (image, 2 MB)
-- =====================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carburant-recus',
  'carburant-recus',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "carburant recus admin all" on storage.objects;
create policy "carburant recus admin all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'carburant-recus'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  bucket_id = 'carburant-recus'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "carburant recus salarie own" on storage.objects;
create policy "carburant recus salarie own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'carburant-recus'
  and (storage.foldername(name))[1] in (
    select c.id::text from public.carburant c
    join public.salaries s on s.id = c.salarie_id
    where s.profile_id = auth.uid()
  )
);

drop policy if exists "carburant recus salarie upload" on storage.objects;
create policy "carburant recus salarie upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'carburant-recus'
  and exists (
    select 1 from public.salaries s
    where s.profile_id = auth.uid() and coalesce(s.actif, true) = true
  )
);

-- =====================================================
-- 4. Bucket : messages-photos (image, 2 MB)
-- =====================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'messages-photos',
  'messages-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "messages photos admin all" on storage.objects;
create policy "messages photos admin all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'messages-photos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  bucket_id = 'messages-photos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "messages photos participant read" on storage.objects;
create policy "messages photos participant read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'messages-photos'
  and (storage.foldername(name))[1] in (
    select m.id::text from public.messages m
    join public.salaries s on s.id = m.auteur_salarie_id or s.id = m.destinataire_salarie_id
    where s.profile_id = auth.uid()
  )
);

drop policy if exists "messages photos salarie upload" on storage.objects;
create policy "messages photos salarie upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'messages-photos'
  and exists (
    select 1 from public.salaries s
    where s.profile_id = auth.uid() and coalesce(s.actif, true) = true
  )
);

-- =====================================================
-- 5. Bucket : incidents-photos (image, 2 MB)
-- =====================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incidents-photos',
  'incidents-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "incidents photos admin all" on storage.objects;
create policy "incidents photos admin all"
on storage.objects for all
to authenticated
using (
  bucket_id = 'incidents-photos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  bucket_id = 'incidents-photos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "incidents photos salarie own read" on storage.objects;
create policy "incidents photos salarie own read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'incidents-photos'
  and (storage.foldername(name))[1] in (
    select i.id::text from public.incidents i
    join public.salaries s on s.id = i.salarie_id
    where s.profile_id = auth.uid()
  )
);

drop policy if exists "incidents photos salarie upload" on storage.objects;
create policy "incidents photos salarie upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'incidents-photos'
  and exists (
    select 1 from public.salaries s
    where s.profile_id = auth.uid() and coalesce(s.actif, true) = true
  )
);
