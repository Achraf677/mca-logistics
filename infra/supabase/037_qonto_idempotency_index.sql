-- 037_qonto_idempotency_index.sql
-- Index unique sur paiements.extra->>'qonto_transaction_id' et
-- charges.extra->>'qonto_transaction_id' pour rendre la synchro Qonto
-- quotidienne idempotente : un meme transaction_id ne peut etre rattache
-- qu'a une seule ligne, donc un re-run du worker ne cree pas de doublon.
--
-- Voir edge function `qonto-sync-daily` (mission "Synchro Qonto auto").

-- Paiements : un transaction_id Qonto = au plus un paiement.
CREATE UNIQUE INDEX IF NOT EXISTS paiements_qonto_transaction_id_uidx
  ON public.paiements ((extra->>'qonto_transaction_id'))
  WHERE extra->>'qonto_transaction_id' IS NOT NULL;

-- Charges : un transaction_id Qonto = au plus une charge marquee payee
-- par ce virement.
CREATE UNIQUE INDEX IF NOT EXISTS charges_qonto_transaction_id_uidx
  ON public.charges ((extra->>'qonto_transaction_id'))
  WHERE extra->>'qonto_transaction_id' IS NOT NULL;

COMMENT ON INDEX public.paiements_qonto_transaction_id_uidx IS
  'Idempotency: 1 transaction Qonto = 1 paiement max. Voir edge function qonto-sync-daily.';

COMMENT ON INDEX public.charges_qonto_transaction_id_uidx IS
  'Idempotency: 1 transaction Qonto = 1 charge max. Voir edge function qonto-sync-daily.';
