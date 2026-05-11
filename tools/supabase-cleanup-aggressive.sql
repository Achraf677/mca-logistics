-- ============================================================================
-- MCA Logistics — Cleanup AGRESSIF (clear tout ce que le seed a mis)
-- ============================================================================
-- À lancer DANS L'ORDRE dans https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/sql
--
-- ATTENTION :
-- - Si tu as des VRAIES données métier (livraisons réelles, paiements réels),
--   ELLES SERONT SUPPRIMÉES AUSSI. Ce script est total (pas de filtre par nom).
-- - Lance la PARTIE 1 (counts) pour confirmer ce qui sera supprimé.
-- - Pas de filtre alertes_admin (elles sont système, pas du seed).
-- ============================================================================

-- ========== PARTIE 1 — DRY RUN ==========
SELECT 'livraisons' AS t, COUNT(*) AS to_delete FROM livraisons
UNION ALL SELECT 'paiements',   COUNT(*) FROM paiements
UNION ALL SELECT 'entretiens',  COUNT(*) FROM entretiens
UNION ALL SELECT 'fournisseurs', COUNT(*) FROM fournisseurs
UNION ALL SELECT 'incidents',   COUNT(*) FROM incidents;

-- ========== PARTIE 2 — DELETE TOTAL ==========
-- Décommente le bloc /* ... */ ci-dessous APRÈS validation des counts ci-dessus.

/*
BEGIN;

-- 1. Paiements (FK livraisons) → enfants d'abord
DELETE FROM paiements;

-- 2. Incidents (FK clients, livraisons) → enfants d'abord
DELETE FROM incidents;

-- 3. Entretiens (FK vehicules)
DELETE FROM entretiens;

-- 4. Livraisons
DELETE FROM livraisons;

-- 5. Fournisseurs
DELETE FROM fournisseurs;

COMMIT;
-- En cas de problème : ROLLBACK;
*/

-- ========== PARTIE 3 — Vérification post-delete ==========
-- Re-lance la PARTIE 1 après le COMMIT pour vérifier que tout est à 0.
