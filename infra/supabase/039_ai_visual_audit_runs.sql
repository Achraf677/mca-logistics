-- 039_ai_visual_audit_runs.sql
-- Historique des runs d'audit visuel automatise (Gemini 2.5 Flash, free tier).
-- Une ligne par execution du workflow `visual-audit-daily.yml`. Sert a :
--   1. Suivre le quota Gemini consomme (free 250 RPD).
--   2. Garder un historique des issues detectees (drift visuel cross-pages).
--   3. Lier le rapport a une issue GitHub publiee.
-- Le service_role (edge function) bypass RLS pour insert/update. Les admins
-- peuvent lire pour un futur dashboard "audit visuel".

CREATE TABLE public.ai_visual_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by text NOT NULL CHECK (triggered_by IN ('cron', 'manual', 'pr')),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  screenshots_count int NOT NULL,
  issues_count int NOT NULL,
  issues_by_severity jsonb,
  raw_report text,
  github_issue_url text,
  duration_ms int
);

ALTER TABLE public.ai_visual_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_visual_audit_runs"
  ON public.ai_visual_audit_runs
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX idx_visual_audit_runs_triggered_at
  ON public.ai_visual_audit_runs(triggered_at DESC);

COMMENT ON TABLE public.ai_visual_audit_runs IS
  'Historique des runs de l''agent visuel (Gemini 2.5 Flash). Cf. edge function ai-visual-audit + workflow visual-audit-daily.';
