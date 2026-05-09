-- 038_audit_log_extend_coverage.sql
--
-- Hotfix R6 (2026-05-09) — extension de la couverture audit_log_trigger.
--
-- La migration 017 attache audit_log_trigger() a 7 tables seulement :
--   livraisons, clients, vehicules, salaries, charges, fournisseurs, paiements.
--
-- 11 tables sensibles supplementaires restent muettes : on les ajoute pour
-- repondre aux exigences "qui a modifie quoi quand" sur tous les flux metier
-- + IA + alertes + documents salaries.
--
-- Tables ajoutees :
--   - carburant            : pleins / consommation
--   - entretiens           : maintenance vehicules
--   - incidents            : sinistres / pannes
--   - plannings_hebdo      : planning chauffeurs
--   - inspections          : controles vehicule
--   - alertes_admin        : alertes operationnelles
--   - salaries_documents   : pieces RH (sensibles)
--   - app_state            : etat global / config
--   - ai_pending_actions   : actions IA en attente (V2 ecriture)
--   - ai_memory            : memoire long terme IA
--   - absences_periodes    : absences chauffeurs
--
-- L'idempotence est assuree par le pattern `drop trigger if exists ...`
-- (deja utilise par 017). Aucune table n'est creee : si une table n'existe
-- pas dans cette base, on log un NOTICE et on continue (defensif).

do $$
declare
  t_name text;
begin
  for t_name in
    select unnest(array[
      'carburant',
      'entretiens',
      'incidents',
      'plannings_hebdo',
      'inspections',
      'alertes_admin',
      'salaries_documents',
      'app_state',
      'ai_pending_actions',
      'ai_memory',
      'absences_periodes'
    ])
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = t_name
    ) then
      execute format('drop trigger if exists trg_%I_audit_log on public.%I', t_name, t_name);
      execute format(
        'create trigger trg_%I_audit_log after insert or update or delete on public.%I for each row execute function public.audit_log_trigger()',
        t_name, t_name
      );
    else
      raise notice 'audit_log: table % introuvable, skip', t_name;
    end if;
  end loop;
end $$;
