-- Migration 043 — Restreindre la lecture audit_log_entries au role admin uniquement.
--
-- Bug #71 audit Chrome 2026-05-10 :
-- > Lecture autorisee pour un user authentifie (admin ici). Tout futur compte
-- > chauffeur ayant un JWT pourrait lire le journal d'audit complet.
--
-- Fix : RLS policy SELECT qui exige profiles.role = 'admin'. Les chauffeurs
-- (role='salarie') n'ont plus aucun acces lecture meme via JWT valide.
-- Le service role passe toujours (bypass RLS par design Supabase).
--
-- Idempotente : DROP POLICY IF EXISTS + CREATE.

ALTER TABLE IF EXISTS audit_log_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_admin_read ON audit_log_entries;
DROP POLICY IF EXISTS audit_log_authenticated_read ON audit_log_entries;
DROP POLICY IF EXISTS audit_log_select ON audit_log_entries;

CREATE POLICY audit_log_admin_read ON audit_log_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Pas de policy INSERT/UPDATE/DELETE cote client : seuls les triggers
-- (SECURITY DEFINER) et le service role peuvent ecrire dans audit_log.
DROP POLICY IF EXISTS audit_log_no_client_write ON audit_log_entries;
CREATE POLICY audit_log_no_client_write ON audit_log_entries
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY audit_log_admin_read ON audit_log_entries IS
  'Lecture restreinte aux admins uniquement (migration 043, fix #71 audit). Service role bypass.';
