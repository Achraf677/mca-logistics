-- 035_ai_brief_runs.sql
-- Trace les briefs automatiques generes par l'edge function `ai-brief`.
-- 1 ligne = 1 run (cron quotidien, login admin, ou trigger manuel).
-- Permet d'auditer la conso Gemini, deduper les runs (rate-limit cote frontend
-- via localStorage.ai_brief_last_run), et reconstituer ce qui a ete pousse
-- dans le panneau-agent les jours precedents.

CREATE TABLE IF NOT EXISTS public.ai_brief_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  trigger text NOT NULL CHECK (trigger IN ('cron', 'on_login', 'manual')),
  decisions_count int NOT NULL DEFAULT 0,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_ms int,
  error text
);

ALTER TABLE public.ai_brief_runs ENABLE ROW LEVEL SECURITY;

-- Lecture admin uniquement (analytics / debug). Pas d'INSERT direct depuis le
-- client : seul le service_role utilise par l'edge function ai-brief peut
-- inserer (RLS bypass automatique pour service_role).
DROP POLICY IF EXISTS ai_brief_runs_select_admin ON public.ai_brief_runs;
CREATE POLICY ai_brief_runs_select_admin ON public.ai_brief_runs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_brief_runs_ran_at ON public.ai_brief_runs(ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_brief_runs_trigger ON public.ai_brief_runs(trigger);

COMMENT ON TABLE public.ai_brief_runs IS
  'Historique des briefs automatiques (panneau-agent). Ecrit par edge fn ai-brief uniquement (service_role).';
