-- Migration 045 — Etendre la couverture audit_log_trigger() aux 5 tables
-- restantes identifiees par l'audit Chrome 2026-05-10 (#88).
--
-- La migration 038 a attache 18 tables. L'audit a constate qu'au moins 5
-- tables critiques n'ont jamais ete tracees :
--   - inspections
--   - parametres_entreprise (compta : siret, branding, TVA)
--   - charges_recurrentes (depuis 041)
--   - edit_locks (depuis 042)
--   - audit_log_runs (visual + cron exec)
--
-- Idempotente : drop trigger if exists + create.

do $$
declare
  t_name text;
  has_trigger_fn boolean;
begin
  select exists (select 1 from pg_proc where proname = 'audit_log_trigger') into has_trigger_fn;
  if not has_trigger_fn then
    raise notice 'audit_log_trigger() absent : migration 045 ignoree';
    return;
  end if;
  for t_name in
    select unnest(array[
      'inspections',
      'parametres_entreprise',
      'charges_recurrentes',
      'audit_log_runs'
    ])
  loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t_name) then
      execute format('drop trigger if exists trg_%I_audit_log on public.%I', t_name, t_name);
      execute format(
        'create trigger trg_%I_audit_log after insert or update or delete on public.%I for each row execute function public.audit_log_trigger()',
        t_name, t_name
      );
    end if;
  end loop;
end $$;

-- edit_locks volontairement EXCLU : flap a haute frequence (refresh +1min)
-- generera 50+ entrees audit par seance utilisateur. Le contenu n'a pas
-- de valeur metier (tracking technique des verrous d'edition).

comment on function public.audit_log_trigger() is
  'Audit log column-level pour UPDATE (migration 044). Couverture etendue a 22+ tables (migration 045).';
