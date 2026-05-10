-- Migration 044 — audit_log_trigger() optimisée column-level pour UPDATE.
--
-- Bug #91 audit Chrome 2026-05-10 :
-- > Audit log diff stocke ROW ENTIERE, pas seulement colonnes changees.
-- > select diff from audit_log_entries where operation='UPDATE'
-- >   -> diff = {"new":{...all columns...}, "old":{...all columns...}}
-- > Impact : storage x2 par UPDATE, fuite contenu complet via #71 RLS,
-- >          signal-to-noise mauvais (rien ne sort).
--
-- Fix : pour UPDATE, ne garder que les colonnes effectivement modifiees,
-- format { col_name: { old: ..., new: ... } }.
-- INSERT et DELETE restent inchanges (full row, sinon rien a garder).
--
-- Idempotente : CREATE OR REPLACE FUNCTION.

create or replace function public.audit_log_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid uuid;
  actor_r text;
  diff_data jsonb;
  row_id_val text;
  changed_keys jsonb;
begin
  -- Identifier l'acteur via auth.uid() si dispo
  begin
    actor_uid := auth.uid();
  exception when others then
    actor_uid := null;
  end;

  if actor_uid is not null then
    select role into actor_r from public.profiles where id = actor_uid limit 1;
  end if;

  -- Diff column-level pour UPDATE, full row pour INSERT/DELETE
  if tg_op = 'DELETE' then
    diff_data := jsonb_build_object('old', to_jsonb(old));
    row_id_val := coalesce(old.id::text, '');
  elsif tg_op = 'INSERT' then
    diff_data := jsonb_build_object('new', to_jsonb(new));
    row_id_val := coalesce(new.id::text, '');
  else -- UPDATE : agregation des colonnes effectivement modifiees
    select coalesce(
      jsonb_object_agg(
        n.key,
        jsonb_build_object('old', o.value, 'new', n.value)
      ),
      '{}'::jsonb
    )
    into changed_keys
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value
      and n.key not in ('updated_at', 'created_at'); -- Ignore les timestamps techniques
    -- Si aucune colonne metier n'a change (ex: trigger touch updated_at seul),
    -- on ne garde que la trace de l'operation sans diff payload.
    diff_data := jsonb_build_object('changes', changed_keys);
    row_id_val := coalesce(new.id::text, old.id::text, '');
  end if;

  insert into public.audit_log_entries (table_name, operation, row_id, actor_id, actor_role, diff)
  values (tg_table_name, tg_op, row_id_val, actor_uid, coalesce(actor_r, 'unknown'), diff_data);

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end $$;

comment on function public.audit_log_trigger() is
  'Log audit column-level pour UPDATE (migration 044, fix #91 audit). INSERT/DELETE = full row.';
