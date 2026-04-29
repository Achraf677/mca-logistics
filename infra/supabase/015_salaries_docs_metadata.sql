-- DelivPro - Phase 3.1 : metadata docs salaries (paths Storage) en colonne JSONB
-- Permet aux admins de partager les references aux fichiers du bucket salaries-docs.
-- Les fichiers eux-memes sont dans Storage, jamais dans la DB.

alter table public.salaries add column if not exists docs jsonb default '{}'::jsonb;

-- Realtime sur salaries_documents pour propager les changements au file-watching
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salaries_documents'
  ) then
    execute 'alter publication supabase_realtime add table public.salaries_documents';
  end if;
end $$;
