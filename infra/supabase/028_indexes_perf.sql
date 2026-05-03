-- Migration 028 — Indexes de performance
-- Objectif : couvrir les FK orphelines (Postgres ne crée pas d'index auto sur FK)
-- et les patterns composites (vehicule_id, date) / (salarie_id, date) / (client_id, date)
-- très fréquents dans script-livraisons, script-charges, script-carburant, script-entretiens,
-- script-rentabilite, script-encaissement, script-heures, script-stats, script-exports.
-- Tous CREATE INDEX IF NOT EXISTS pour idempotence.

-- ===== FK sans index =====
-- charges.carburant_id : utilisé pour rapprocher une charge à un plein
CREATE INDEX IF NOT EXISTS idx_charges_carburant_id
  ON public.charges (carburant_id) WHERE carburant_id IS NOT NULL;

-- charges.entretien_id : rapprochement charge <-> entretien
CREATE INDEX IF NOT EXISTS idx_charges_entretien_id
  ON public.charges (entretien_id) WHERE entretien_id IS NOT NULL;

-- charges.salarie_id n'existe pas dans le schéma actuel (charges sont rattachées
-- au véhicule, pas au salarié). Pas d'index à créer.

-- inspection_photos.vehicule_id : FK ajoutée mais sans index
CREATE INDEX IF NOT EXISTS idx_inspection_photos_vehicule_id
  ON public.inspection_photos (vehicule_id);

-- app_state.updated_by : audit "qui a modifié"
CREATE INDEX IF NOT EXISTS idx_app_state_updated_by
  ON public.app_state (updated_by);

-- ===== Index composites (vehicule_id, date) =====
-- Pattern récurrent : "toutes les charges/pleins/entretiens/livraisons d'un véhicule sur une période"
-- (script-rentabilite, script-vehicules, script-carburant-anomalies, script-exports)
CREATE INDEX IF NOT EXISTS idx_livraisons_vehicule_date
  ON public.livraisons (vehicule_id, date_livraison DESC)
  WHERE vehicule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_charges_vehicule_date
  ON public.charges (vehicule_id, date_charge DESC)
  WHERE vehicule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carburant_vehicule_date
  ON public.carburant (vehicule_id, date_plein DESC)
  WHERE vehicule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entretiens_vehicule_date
  ON public.entretiens (vehicule_id, date_entretien DESC)
  WHERE vehicule_id IS NOT NULL;

-- ===== Index composites (salarie_id, date) =====
-- Pattern : "ce qu'un chauffeur a fait sur la semaine/mois"
-- (script-heures, script-salarie, script-stats)
CREATE INDEX IF NOT EXISTS idx_livraisons_salarie_date
  ON public.livraisons (salarie_id, date_livraison DESC)
  WHERE salarie_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carburant_salarie_date
  ON public.carburant (salarie_id, date_plein DESC)
  WHERE salarie_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_salarie_date
  ON public.incidents (salarie_id, date_incident DESC)
  WHERE salarie_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_salarie_date
  ON public.inspections (salarie_id, date_inspection DESC)
  WHERE salarie_id IS NOT NULL;

-- ===== Encaissement / facturation =====
-- script-encaissement scanne livraisons par client + statut + date_paiement
CREATE INDEX IF NOT EXISTS idx_livraisons_client_date
  ON public.livraisons (client_id, date_livraison DESC)
  WHERE client_id IS NOT NULL;

-- Recherche des impayés : statut_paiement <> 'paye' filtré sur date
CREATE INDEX IF NOT EXISTS idx_livraisons_impayes
  ON public.livraisons (date_livraison DESC)
  WHERE statut_paiement IS DISTINCT FROM 'paye';

-- date_paiement pour rapprochement bancaire / encaissé du mois
CREATE INDEX IF NOT EXISTS idx_livraisons_date_paiement
  ON public.livraisons (date_paiement DESC)
  WHERE date_paiement IS NOT NULL;

-- ===== Incidents en cours (dashboard alertes) =====
CREATE INDEX IF NOT EXISTS idx_incidents_statut_date
  ON public.incidents (statut, date_incident DESC)
  WHERE statut IS DISTINCT FROM 'clos';

-- ===== Inspections en attente =====
CREATE INDEX IF NOT EXISTS idx_inspections_statut
  ON public.inspections (statut, date_inspection DESC)
  WHERE statut IS DISTINCT FROM 'ok';

-- ===== Audit log : recherches par entité =====
-- idx_audit_log_table existe déjà ; on ajoute un composite (table, row_id) pour
-- "historique d'une livraison spécifique"
CREATE INDEX IF NOT EXISTS idx_audit_log_table_row
  ON public.audit_log_entries (table_name, row_id, created_at DESC);

-- ===== Messages : conversations =====
-- Pour reconstruire un fil entre deux salariés/admin
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages (auteur_salarie_id, destinataire_salarie_id, created_at DESC);
