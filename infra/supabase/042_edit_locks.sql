-- 042_edit_locks.sql
-- ----------------------------------------------------------------------------
-- Verrous d'edition collaboratifs : bloquer l'ouverture simultanee du meme
-- formulaire d'edition par 2 admins en meme temps. Affiche le nom de la
-- personne en cours d'edition + propose un "Forcer le deverrouillage" admin.
--
-- Modele :
--   - PRIMARY KEY (table_name, row_id) : un seul lock actif par couple
--   - expires_at : auto-expiration apres 5 min (refresh toutes les 60s
--     pendant l'edition par l'UI)
--   - user_name : libelle affiche dans la modale de conflit (snapshot
--     a la prise du verrou, pas de jointure auth.users a chaque lecture)
--
-- Acquisition idempotente : INSERT ... ON CONFLICT (table_name, row_id) DO UPDATE
-- avec une clause WHERE qui ne re-prend le lock que si :
--   - le lock courant est expire (expires_at < NOW()), OU
--   - c'est le meme user_id (re-acquisition silencieuse, ex: refresh page)
-- Sinon l'UPDATE n'affecte aucune ligne et le client detecte le conflit
-- en relisant la ligne (RETURNING).
--
-- Migration idempotente : CREATE TABLE IF NOT EXISTS + CREATE POLICY guards.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.edit_locks (
  table_name  TEXT NOT NULL,
  row_id      TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name   TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  PRIMARY KEY (table_name, row_id)
);

ALTER TABLE public.edit_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'edit_locks' AND policyname = 'edit_locks_admin_all'
  ) THEN
    CREATE POLICY edit_locks_admin_all ON public.edit_locks
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- Index sur expires_at pour le balayage du cron de cleanup quotidien
-- (supprime les locks expires depuis > 1h en backup du auto-expire applicatif).
CREATE INDEX IF NOT EXISTS idx_edit_locks_expires
  ON public.edit_locks(expires_at);

-- Index sur user_id pour libererTousLocksUtilisateur a la deconnexion
CREATE INDEX IF NOT EXISTS idx_edit_locks_user
  ON public.edit_locks(user_id);
