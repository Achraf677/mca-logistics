-- Migration 046 — audit_log_trigger() avec dedup cooldown 5 min.
--
-- Bugs #90 #92 #105 audit Chrome :
-- > 89 entries sur alertes_admin, 99 livraisons, ... la meme alerte
-- > "Entretien proche FG-788-FB" a genere 9 entrees audit en 1 heure car
-- > le trigger d'auto-statut UPDATE l'alerte a chaque chargement de page.
-- > Plus : double UPDATE consecutif a la meme milliseconde (BEFORE+AFTER).
--
-- Fix : avant d'inserer dans audit_log_entries, on verifie qu'il n'y a pas
-- deja une entry identique (table + row + operation + meme actor) dans les
-- 5 dernieres minutes avec un diff vide ou identique. Si oui, skip.
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
  recent_count int;
begin
  begin
    actor_uid := auth.uid();
  exception when others then
    actor_uid := null;
  end;

  if actor_uid is not null then
    select role into actor_r from public.profiles where id = actor_uid limit 1;
  end if;

  if tg_op = 'DELETE' then
    diff_data := jsonb_build_object('old', to_jsonb(old));
    row_id_val := coalesce(old.id::text, '');
  elsif tg_op = 'INSERT' then
    diff_data := jsonb_build_object('new', to_jsonb(new));
    row_id_val := coalesce(new.id::text, '');
  else
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
      and n.key not in ('updated_at', 'created_at');

    -- #90 #92 #105 dedup : si UPDATE sans changement metier (changed_keys={}),
    -- skip totalement (le trigger fire sur touch updated_at = bruit).
    if changed_keys = '{}'::jsonb then
      return new;
    end if;

    -- Cooldown 5 min : si meme table+row+actor+changes deja audite recemment,
    -- skip (anti-spam des UPDATE repetes type "alerte proche" recurrent).
    select count(*)
    into recent_count
    from public.audit_log_entries
    where table_name = tg_table_name
      and row_id = coalesce(new.id::text, '')
      and operation = 'UPDATE'
      and actor_id is not distinct from actor_uid
      and created_at > now() - interval '5 minutes'
      and diff -> 'changes' = changed_keys;
    if recent_count > 0 then
      return new;
    end if;

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
  'Audit log column-level + dedup cooldown 5 min (migration 046, fix #90 #92 #105).';
