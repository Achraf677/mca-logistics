-- DelivPro - Policies admin pour gerer la table salaries depuis le front admin
-- A executer apres 001_init.sql et 002_auth_login_bridge.sql

drop policy if exists "salaries admin read" on public.salaries;
create policy "salaries admin read" on public.salaries
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "salaries admin insert" on public.salaries;
create policy "salaries admin insert" on public.salaries
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "salaries admin update" on public.salaries;
create policy "salaries admin update" on public.salaries
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "salaries admin delete" on public.salaries;
create policy "salaries admin delete" on public.salaries
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
