-- DelivPro - Charges : statut de paiement + date paiement
-- Permet de suivre les charges payees / non payees, avec alerte en retard
-- selon le delai de paiement du fournisseur.

alter table public.charges add column if not exists statut_paiement text default 'a_payer';
alter table public.charges add column if not exists date_paiement date;
alter table public.charges add column if not exists mode_paiement text;

-- Contrainte sur les valeurs autorisees
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'charges_statut_paiement_check') then
    alter table public.charges add constraint charges_statut_paiement_check
      check (statut_paiement in ('a_payer', 'paye', 'en_retard', 'partiel'));
  end if;
end $$;

-- Index pour filtres / alertes (charges impayees en retard)
create index if not exists idx_charges_statut_paiement on public.charges(statut_paiement)
  where statut_paiement <> 'paye';
create index if not exists idx_charges_date_paiement on public.charges(date_paiement desc)
  where date_paiement is not null;
