-- DelivPro - Phase 2.1 fix : activer realtime sur public.clients
-- Sans cette migration, les changements clients ne sont pas pousses live
-- aux autres onglets/devices ; il fallait rafraichir manuellement.

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'clients'
  ) then
    execute 'alter publication supabase_realtime add table public.clients';
  end if;
end $$;
