-- 035_ai_pending_actions.sql
-- Brouillons IA : actions proposees par le chatbot que l'admin met en attente
-- pour revue ulterieure (au lieu de confirmer ou annuler immediatement).
-- Phase 4 du V2 ECRITURE (PR #34).

CREATE TABLE IF NOT EXISTS public.ai_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  reasoning text,
  source_message_id uuid,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  executed_at timestamptz,
  executed_result jsonb
);

ALTER TABLE public.ai_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_pending_actions_select_admin ON public.ai_pending_actions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY ai_pending_actions_insert_admin ON public.ai_pending_actions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY ai_pending_actions_update_admin ON public.ai_pending_actions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY ai_pending_actions_delete_admin ON public.ai_pending_actions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_status_created
  ON public.ai_pending_actions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_created_by
  ON public.ai_pending_actions(created_by);

COMMENT ON TABLE public.ai_pending_actions IS
  'Brouillons IA : actions create/update/delete proposees par le chatbot, en attente de revue admin. Cf migration 035 + edge fn ai-chat-write-execute (action add_to_drafts / execute_draft / reject_draft).';
