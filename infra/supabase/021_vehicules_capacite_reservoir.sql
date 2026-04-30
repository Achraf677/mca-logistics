-- DelivPro - Vehicules : capacite reservoir (litres)
-- Sert a la detection d'anomalies carburant (rule #3 :
-- plein > capacite reservoir = fraude probable).

alter table public.vehicules add column if not exists capacite_reservoir numeric(6,1) default 0;
