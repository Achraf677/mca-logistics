-- ====================================================================
-- Migration 024 — Securisation app_state (admin uniquement)
-- ====================================================================
-- AVANT : tout authentifie (admin OU chauffeur) pouvait lire app_state.
-- Probleme : le payload contient encore en prod livraisons, paiements,
-- charges, salaries, clients, etc. Un chauffeur connecte pouvait
-- telecharger toute la finance/RH (faille critique).
--
-- APRES : seul un admin (is_admin()) peut lire/ecrire app_state, que
-- ce soit via la table directement ou via la RPC app_state_apply.
--
-- Cote code : supabase-storage-sync.js est patche pour skip
-- silencieusement si l'user n'est pas admin (les chauffeurs sur
-- salarie.html chargent ce script mais n'ont pas besoin du sync).
-- ====================================================================

-- 1. Re-creer les policies RLS avec is_admin()
drop policy if exists "app_state authenticated read" on public.app_state;
drop policy if exists "app_state authenticated insert" on public.app_state;
drop policy if exists "app_state authenticated update" on public.app_state;

create policy "app_state admin read"
on public.app_state for select
to authenticated
using (public.is_admin());

create policy "app_state admin insert"
on public.app_state for insert
to authenticated
with check (public.is_admin());

create policy "app_state admin update"
on public.app_state for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 2. Guard supplementaire dans la RPC app_state_apply (SECURITY DEFINER
--    bypasse les RLS, donc on doit explicitement bloquer les non-admins).
create or replace function public.app_state_apply(
  p_scope text,
  p_changes jsonb default '{}'::jsonb,
  p_removed_keys text[] default array[]::text[]
)
returns public.app_state
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_existing public.app_state%rowtype;
  v_payload jsonb := '{}'::jsonb;
  v_key text;
begin
  -- Bloquer les non-admins (la fonction est SECURITY DEFINER donc bypasse RLS)
  if not public.is_admin() then
    raise exception 'app_state_apply: admin required' using errcode = '42501';
  end if;

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
$function$;

-- 3. Versionner is_admin() pour eliminer le drift DB/repo
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$function$;
