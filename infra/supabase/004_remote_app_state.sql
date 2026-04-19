-- DelivPro - Synchronisation distante du localStorage via Supabase
-- A executer apres 001_init.sql et 002_auth_login_bridge.sql

create table if not exists public.app_state (
  scope text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.app_state enable row level security;

drop policy if exists "app_state authenticated read" on public.app_state;
create policy "app_state authenticated read" on public.app_state
for select using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "app_state authenticated insert" on public.app_state;
create policy "app_state authenticated insert" on public.app_state
for insert with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
  )
);

drop policy if exists "app_state authenticated update" on public.app_state;
create policy "app_state authenticated update" on public.app_state
for update using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
  )
);

create or replace function public.app_state_apply(
  p_scope text,
  p_changes jsonb default '{}'::jsonb,
  p_removed_keys text[] default array[]::text[]
)
returns public.app_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.app_state%rowtype;
  v_payload jsonb := '{}'::jsonb;
  v_key text;
begin
  if p_scope is null or btrim(p_scope) = '' then
    raise exception 'p_scope is required';
  end if;

  select *
  into v_existing
  from public.app_state
  where scope = p_scope;

  if found then
    v_payload := coalesce(v_existing.payload, '{}'::jsonb);
  end if;

  v_payload := v_payload || coalesce(p_changes, '{}'::jsonb);

  if p_removed_keys is not null then
    foreach v_key in array p_removed_keys loop
      if v_key is not null and btrim(v_key) <> '' then
        v_payload := v_payload - v_key;
      end if;
    end loop;
  end if;

  insert into public.app_state (scope, payload, updated_at, updated_by)
  values (p_scope, v_payload, now(), auth.uid())
  on conflict (scope) do update
    set payload = excluded.payload,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  return (
    select a
    from public.app_state a
    where a.scope = p_scope
  );
end;
$$;

grant execute on function public.app_state_apply(text, jsonb, text[]) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
