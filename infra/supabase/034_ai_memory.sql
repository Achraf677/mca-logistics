-- 034_ai_memory.sql
-- Memoire long-terme du chatbot IA Gemini.
-- Faits validés (par l'admin ou proposes par l'IA et valides) qui sont injectes
-- dans le system prompt a chaque conversation pour donner du contexte business
-- persistant a l'IA.

CREATE TABLE IF NOT EXISTS public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_text text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN (
    'general', 'client', 'fournisseur', 'salarie', 'vehicule',
    'finance', 'compta', 'preference_user', 'pattern'
  )),
  importance smallint NOT NULL DEFAULT 3 CHECK (importance >= 1 AND importance <= 5),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'proposed_by_ai')),
  created_by uuid REFERENCES public.profiles(id),
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_memory_select_admin ON public.ai_memory
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY ai_memory_insert_admin ON public.ai_memory
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY ai_memory_update_admin ON public.ai_memory
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY ai_memory_delete_admin ON public.ai_memory
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_memory_category ON public.ai_memory(category);
CREATE INDEX IF NOT EXISTS idx_ai_memory_importance ON public.ai_memory(importance DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memory_created_at ON public.ai_memory(created_at DESC);

COMMENT ON TABLE public.ai_memory IS
  'Memoire long-terme du chatbot IA. Faits injectes dans le system prompt de la fonction ai-chat. Voir docs/secrets-management.md et migration 033 pour le contexte.';
