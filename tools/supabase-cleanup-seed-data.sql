-- ============================================================================
-- MCA Logistics — Cleanup des données seed contaminant Supabase
-- ============================================================================
--
-- Contexte : script-dev-seed.js (v1 et v2) a injecté des fake data en
-- localStorage qui se sont synchronisées sur Supabase via les *-adapter.js
-- (qui convertissent dev-XXX en UUID avant insert).
--
-- Ce script supprime UNIQUEMENT les données reconnaissables par leur
-- contenu signature (noms, immatriculations, numLiv pattern). Les données
-- réelles ne sont PAS touchées.
--
-- USAGE :
--   1. Ouvre https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/sql
--   2. Crée une nouvelle query
--   3. Lance d'abord la PARTIE 1 (SELECT, dry-run) pour confirmer les comptes
--   4. Si OK, lance la PARTIE 2 (DELETE) — ATTENTION IRRÉVERSIBLE
--
-- ============================================================================

-- ====== PARTIE 1 — DRY RUN (SELECT only, no delete) ======
-- Lance ça d'abord pour voir ce qui matche AVANT de supprimer.

SELECT 'clients seed' AS source, COUNT(*) AS count
FROM clients
WHERE nom IN (
  'Amazon France','Carrefour Hyper','Decathlon Logistics','Boulanger',
  'Leroy Merlin','Auchan Nord','Castorama','Intermarché Lille',
  'Société TBM','Brico Dépôt','IKEA Lomme','Saint-Maclou','BUT',
  'Conforama','Maisons du Monde','Bricomarché','Action Discount',
  'Lidl Nord','Aldi Marché','Picard Surgelés','Grand Frais',
  'Société TPL Logistique','Mr. Bricolage','Particulier Dupont',
  'Particulier Lefèvre'
)

UNION ALL SELECT 'fournisseurs seed', COUNT(*)
FROM fournisseurs
WHERE nom IN (
  'TotalEnergies Carburant','BP Carburant Pro','AXA Assurance Flotte',
  'SCI Bureau Ostwald','Crédit Mutuel','Pennylane SAS','Garage Renault Pro',
  'CarGlass','Orange Pro','OVH Cloud','Norauto Pro','Office Dépôt',
  'GROUPAMA Mutuelle','INPI Service','Total Lubrifiants'
)

UNION ALL SELECT 'vehicules seed', COUNT(*)
FROM vehicules
WHERE immat IN (
  'FG-788-FB','KH-234-LM','AB-456-CD','XY-789-ZW','EF-123-GH','JK-567-MN',
  'OP-901-QR','ST-234-UV','WX-678-YZ','CD-345-EF','GH-789-IJ','KL-012-MN'
)

UNION ALL SELECT 'salaries seed', COUNT(*)
FROM salaries
WHERE nom IN (
  'Karim Benali','Mohamed Tahar','Jean Lefèvre','Antoine Martin',
  'Sofiane El Khattabi','Lucas Bernard','Aurélie Renard'
)

UNION ALL SELECT 'livraisons seed (numliv L-YYYY-XXXX)', COUNT(*)
FROM livraisons
WHERE numliv ~ '^L-\d{4}-\d{4}$'

UNION ALL SELECT 'carburant orphelins (sans vehiculeid)', COUNT(*)
FROM carburant
WHERE vehiculeid IS NULL OR vehiculeid::text NOT IN (
  SELECT id::text FROM vehicules
)

UNION ALL SELECT 'charges seed (fournisseur seed)', COUNT(*)
FROM charges
WHERE fournisseur IN (
  'TotalEnergies Carburant','AXA Assurance Flotte','SCI Bureau Ostwald',
  'Crédit Mutuel','Pennylane SAS','Garage Renault Pro','CarGlass',
  'Orange Pro','OVH Cloud','Norauto Pro','Office Dépôt','GROUPAMA Mutuelle',
  'INPI Service','BP Carburant Pro','Total Lubrifiants'
);

-- ====================================================================
-- ====== PARTIE 2 — DELETE (irréversible, BACKUP D'ABORD) ============
-- ====================================================================
-- DÉCOMMENTE les lignes ci-dessous APRÈS avoir validé les counts ci-dessus.
-- Ordre des deletes : enfants → parents (FK dependencies).
-- ATTENTION : pas de transaction explicite ici, fais un export CSV avant si
-- tu veux pouvoir rollback.

/*
BEGIN;

-- 1. carburant (lié à vehicules)
DELETE FROM carburant
WHERE vehiculeid IN (
  SELECT id FROM vehicules WHERE immat IN (
    'FG-788-FB','KH-234-LM','AB-456-CD','XY-789-ZW','EF-123-GH','JK-567-MN',
    'OP-901-QR','ST-234-UV','WX-678-YZ','CD-345-EF','GH-789-IJ','KL-012-MN'
  )
);

-- 2. entretiens (lié à vehicules)
DELETE FROM entretiens
WHERE vehiculeid IN (
  SELECT id FROM vehicules WHERE immat IN (
    'FG-788-FB','KH-234-LM','AB-456-CD','XY-789-ZW','EF-123-GH','JK-567-MN',
    'OP-901-QR','ST-234-UV','WX-678-YZ','CD-345-EF','GH-789-IJ','KL-012-MN'
  )
);

-- 3. inspections (lié à vehicules)
DELETE FROM inspections
WHERE vehiculeid IN (
  SELECT id FROM vehicules WHERE immat IN (
    'FG-788-FB','KH-234-LM','AB-456-CD','XY-789-ZW','EF-123-GH','JK-567-MN',
    'OP-901-QR','ST-234-UV','WX-678-YZ','CD-345-EF','GH-789-IJ','KL-012-MN'
  )
);

-- 4. incidents (lié à clients + salaries)
DELETE FROM incidents
WHERE clientid IN (
  SELECT id FROM clients WHERE nom IN (
    'Amazon France','Carrefour Hyper','Decathlon Logistics','Boulanger',
    'Leroy Merlin','Auchan Nord','Castorama','Intermarché Lille',
    'Société TBM','Brico Dépôt','IKEA Lomme','Saint-Maclou','BUT',
    'Conforama','Maisons du Monde','Bricomarché','Action Discount',
    'Lidl Nord','Aldi Marché','Picard Surgelés','Grand Frais',
    'Société TPL Logistique','Mr. Bricolage','Particulier Dupont',
    'Particulier Lefèvre'
  )
);

-- 5. paiements (lié à livraisons)
DELETE FROM paiements
WHERE livraisonid IN (
  SELECT id FROM livraisons WHERE numliv ~ '^L-\d{4}-\d{4}$'
);

-- 6. livraisons (par numliv pattern seed)
DELETE FROM livraisons WHERE numliv ~ '^L-\d{4}-\d{4}$';

-- 7. charges (par fournisseur seed name)
DELETE FROM charges
WHERE fournisseur IN (
  'TotalEnergies Carburant','AXA Assurance Flotte','SCI Bureau Ostwald',
  'Crédit Mutuel','Pennylane SAS','Garage Renault Pro','CarGlass',
  'Orange Pro','OVH Cloud','Norauto Pro','Office Dépôt','GROUPAMA Mutuelle',
  'INPI Service','BP Carburant Pro','Total Lubrifiants'
);

-- 8. plannings_hebdo (lié à salaries seed)
DELETE FROM plannings_hebdo
WHERE salarieid IN (
  SELECT id FROM salaries WHERE nom IN (
    'Karim Benali','Mohamed Tahar','Jean Lefèvre','Antoine Martin',
    'Sofiane El Khattabi','Lucas Bernard','Aurélie Renard'
  )
);

-- 9. heures_pointage (lié à salaries seed)
DELETE FROM heures_pointage
WHERE salarieid IN (
  SELECT id FROM salaries WHERE nom IN (
    'Karim Benali','Mohamed Tahar','Jean Lefèvre','Antoine Martin',
    'Sofiane El Khattabi','Lucas Bernard','Aurélie Renard'
  )
);

-- 10. vehicules seed (après nettoyage des FK)
DELETE FROM vehicules WHERE immat IN (
  'FG-788-FB','KH-234-LM','AB-456-CD','XY-789-ZW','EF-123-GH','JK-567-MN',
  'OP-901-QR','ST-234-UV','WX-678-YZ','CD-345-EF','GH-789-IJ','KL-012-MN'
);

-- 11. salaries seed
DELETE FROM salaries WHERE nom IN (
  'Karim Benali','Mohamed Tahar','Jean Lefèvre','Antoine Martin',
  'Sofiane El Khattabi','Lucas Bernard','Aurélie Renard'
);

-- 12. clients seed
DELETE FROM clients WHERE nom IN (
  'Amazon France','Carrefour Hyper','Decathlon Logistics','Boulanger',
  'Leroy Merlin','Auchan Nord','Castorama','Intermarché Lille',
  'Société TBM','Brico Dépôt','IKEA Lomme','Saint-Maclou','BUT',
  'Conforama','Maisons du Monde','Bricomarché','Action Discount',
  'Lidl Nord','Aldi Marché','Picard Surgelés','Grand Frais',
  'Société TPL Logistique','Mr. Bricolage','Particulier Dupont',
  'Particulier Lefèvre'
);

-- 13. fournisseurs seed
DELETE FROM fournisseurs WHERE nom IN (
  'TotalEnergies Carburant','BP Carburant Pro','AXA Assurance Flotte',
  'SCI Bureau Ostwald','Crédit Mutuel','Pennylane SAS','Garage Renault Pro',
  'CarGlass','Orange Pro','OVH Cloud','Norauto Pro','Office Dépôt',
  'GROUPAMA Mutuelle','INPI Service','Total Lubrifiants'
);

-- Valide la transaction si tout va bien :
COMMIT;
-- Sinon : ROLLBACK;
*/
