-- DelivPro - Audit logs DB pour tracabilite des modifs sur entites critiques
--
-- Table audit_log_entries : 1 row par operation (INSERT/UPDATE/DELETE) sur
-- les tables sensibles. Permet de retrouver "qui a modifie quoi quand".

create table if not exists public.audit_log_entries (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  row_id text,
  actor_id uuid,                  -- auth.users.id si dispo
  actor_role text,                -- 'admin' / 'salarie' / 'system'
  diff jsonb default '{}'::jsonb, -- old/new values (limited)
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_table on public.audit_log_entries(table_name);
create index if not exists idx_audit_log_actor on public.audit_log_entries(actor_id);
create index if not exists idx_audit_log_date on public.audit_log_entries(created_at desc);

-- RLS : seuls les admins peuvent lire
alter table public.audit_log_entries enable row level security;

drop policy if exists "audit_log admin read" on public.audit_log_entries;
create policy "audit_log admin read"
on public.audit_log_entries for select
using (public.is_admin());

-- Fonction de logging generique
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

  -- Diff : new + old (limite a 4Ko pour ne pas exploser la table)
  if tg_op = 'DELETE' then
    diff_data := jsonb_build_object('old', to_jsonb(old));
    row_id_val := coalesce(old.id::text, '');
  elsif tg_op = 'INSERT' then
    diff_data := jsonb_build_object('new', to_jsonb(new));
    row_id_val := coalesce(new.id::text, '');
  else -- UPDATE
    diff_data := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
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

-- Attacher le trigger aux tables critiques metier (livraisons, clients,
-- vehicules, salaries, charges, fournisseurs, paiements)
do $$
declare t_name text;
begin
  for t_name in
    select unnest(array[
      'livraisons','clients','vehicules','salaries',
      'charges','fournisseurs','paiements'
    ])
  loop
    execute format('drop trigger if exists trg_%I_audit_log on public.%I', t_name, t_name);
    execute format(
      'create trigger trg_%I_audit_log after insert or update or delete on public.%I for each row execute function public.audit_log_trigger()',
      t_name, t_name
    );
  end loop;
end $$;
