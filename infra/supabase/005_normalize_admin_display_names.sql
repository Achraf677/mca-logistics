-- DelivPro - Normalisation des noms d'affichage administrateur
-- A executer apres 001_init.sql et 002_auth_login_bridge.sql

update public.admin_identities
set display_name = case
  when lower(identifiant) = 'achraf.chikri' then 'Achraf Chikri'
  when lower(identifiant) = 'mohammed.chikri' then 'Mohammed Chikri'
  else display_name
end,
updated_at = now()
where lower(identifiant) in ('achraf.chikri', 'mohammed.chikri');

update public.profiles
set display_name = case
  when lower(email) = 'admin.achraf@mca-logistics.fr' then 'Achraf Chikri'
  when lower(email) = 'admin.mohammed@mca-logistics.fr' then 'Mohammed Chikri'
  else display_name
end,
updated_at = now()
where lower(email) in ('admin.achraf@mca-logistics.fr', 'admin.mohammed@mca-logistics.fr');
