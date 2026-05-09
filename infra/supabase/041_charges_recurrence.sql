-- 041_charges_recurrence.sql
-- ----------------------------------------------------------------------------
-- Recurrence des charges : marquer une charge comme recurrente
-- (mensuelle / trimestrielle / annuelle) et auto-generer les prochaines
-- occurrences via cron quotidien (edge function `charges-recurrence-daily`).
--
-- Patterns supportes (recurrence_pattern) :
--   - 'mensuelle'     : +1 mois par occurrence
--   - 'trimestrielle' : +3 mois par occurrence
--   - 'annuelle'      : +12 mois par occurrence
--   - NULL            : pas de recurrence (defaut)
--
-- recurrence_template_id : si NON NULL, cette ligne EST une occurrence
-- generee depuis un template parent (ex: loyer entrepot avril 2026
-- genere depuis loyer entrepot template). Permet de :
--   - retrouver l'historique des occurrences d'un template
--   - eviter qu'une occurrence devienne elle-meme un template
--     (recurrence_actif = false par defaut sur les instances generees)
--
-- Idempotence : un index unique sur (recurrence_template_id, periode)
-- garantit qu'une meme periode ne peut etre generee 2x. La cle de periode
-- est stockee dans extra->>'recurrence_period_key' au moment de l'INSERT
-- par l'edge fn (formats : 'YYYY-MM' / 'YYYY-Qn' / 'YYYY').
--
-- Migration idempotente : ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- ----------------------------------------------------------------------------

-- Pattern de recurrence : 'mensuelle' | 'trimestrielle' | 'annuelle' | NULL
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT NULL;

-- Switch on/off (permet de desactiver temporairement sans perdre la config)
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS recurrence_actif BOOLEAN NOT NULL DEFAULT false;

-- Jour du mois pour la generation (1-31). Si > nb jours du mois cible,
-- l'edge fn cale au dernier jour du mois (ex: 31 -> 28/29 fevrier).
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS recurrence_jour_du_mois INT NULL
    CHECK (recurrence_jour_du_mois IS NULL OR (recurrence_jour_du_mois BETWEEN 1 AND 31));

-- Date de fin optionnelle (au-dela, plus de generation, meme si actif=true)
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS recurrence_date_fin DATE NULL;

-- Lien vers le template (si NULL : la charge EST un template ou n'a pas de
-- recurrence ; si NON NULL : la charge est une instance generee).
-- ON DELETE SET NULL : si on supprime un template, ses instances generees
-- restent en base (historique compta) mais perdent le lien.
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS recurrence_template_id UUID NULL
    REFERENCES public.charges(id) ON DELETE SET NULL;

-- Contrainte de coherence : si pattern set, jour_du_mois DOIT etre set
-- (sinon l'edge fn ne saurait pas quel jour generer).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'charges_recurrence_pattern_chk'
  ) THEN
    ALTER TABLE public.charges
      ADD CONSTRAINT charges_recurrence_pattern_chk
      CHECK (
        recurrence_pattern IS NULL
        OR (recurrence_pattern IN ('mensuelle', 'trimestrielle', 'annuelle')
            AND recurrence_jour_du_mois IS NOT NULL)
      );
  END IF;
END $$;

-- Index pour cron quotidien : recupere uniquement les templates actifs avec pattern.
-- Partial index = scan tres rapide (peu de templates actifs en pratique).
CREATE INDEX IF NOT EXISTS idx_charges_recurrence_active
  ON public.charges (recurrence_actif, recurrence_pattern)
  WHERE recurrence_actif = true AND recurrence_pattern IS NOT NULL;

-- Index pour retrouver les instances generees d'un template (drill-down UI).
CREATE INDEX IF NOT EXISTS idx_charges_recurrence_template_id
  ON public.charges (recurrence_template_id)
  WHERE recurrence_template_id IS NOT NULL;

-- Idempotency : 1 template + 1 periode = au plus 1 instance.
-- La cle de periode est stockee dans extra->>'recurrence_period_key' au moment
-- de l'INSERT par l'edge fn (formats : 'YYYY-MM' / 'YYYY-Qn' / 'YYYY').
CREATE UNIQUE INDEX IF NOT EXISTS charges_recurrence_period_uidx
  ON public.charges (recurrence_template_id, ((extra->>'recurrence_period_key')))
  WHERE recurrence_template_id IS NOT NULL
    AND extra->>'recurrence_period_key' IS NOT NULL;

COMMENT ON COLUMN public.charges.recurrence_pattern IS
  'Pattern de recurrence : mensuelle | trimestrielle | annuelle | NULL.';
COMMENT ON COLUMN public.charges.recurrence_actif IS
  'Switch on/off : si false, l''edge fn skip ce template meme si pattern set.';
COMMENT ON COLUMN public.charges.recurrence_jour_du_mois IS
  'Jour du mois pour la generation (1-31). 31 -> dernier jour du mois cible.';
COMMENT ON COLUMN public.charges.recurrence_date_fin IS
  'Date de fin (incluse). Au-dela, plus de generation meme si actif=true.';
COMMENT ON COLUMN public.charges.recurrence_template_id IS
  'Si NON NULL : cette ligne est une instance generee depuis un template parent.';
COMMENT ON INDEX public.charges_recurrence_period_uidx IS
  'Idempotency: 1 template + 1 periode = au plus 1 instance generee. Voir edge fn charges-recurrence-daily.';
