-- 033_ai_quota_daily.sql
-- Tracker du quota Gemini par jour (partage entre admins).
-- Utilise par edge function `ai-chat` pour basculer Pro -> Flash apres 50 req Pro.

CREATE TABLE IF NOT EXISTS public.ai_quota_daily (
  date date PRIMARY KEY,
  requests_pro integer NOT NULL DEFAULT 0,
  requests_flash integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_quota_daily ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire (pour eventuel dashboard de conso).
-- Le service_role (edge function) bypass RLS, donc pas besoin de policy INSERT/UPDATE.
CREATE POLICY ai_quota_daily_select_admin
  ON public.ai_quota_daily
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.ai_quota_daily IS
  'Compteur quotidien des requetes Gemini (Pro / Flash) - partage entre admins. Voir edge function ai-chat.';
