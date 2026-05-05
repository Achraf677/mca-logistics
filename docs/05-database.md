# 05 — Base de données

Backend PostgreSQL via Supabase, projet `lkbfvgnhwgbapdtitglu`.

> Source de vérité : les fichiers SQL versionnés dans
> `infra/supabase/00X_*.sql`. Cette page reflète l'état observé au
> 2026-05-05 (migration 031). Pour récupérer l'état réel à un instant
> donné, lancer `mcp__supabase__list_tables` ou consulter le
> [Table Editor](https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/editor).

## Tables (23)

Schéma `public`. Toutes en RLS, auth admin via JWT, salarié filtré par
`auth.uid() = salarie_id`.

### Métier — Tiers

| Table | Rôle | Champs notables |
|---|---|---|
| `clients` | Clients facturés | `id`, `nom`, `siren` (9 chiffres), `tva_intracom`, `pays`, `siret`, `adresse_*`, `delai_paiement`, `categorie`, `note_interne` |
| `fournisseurs` | Fournisseurs (carbu, entretien, sous-traitance) | `id`, `nom`, `siren`, `tva_intracom`, `categorie`, `note_interne` |

### Métier — Flotte

| Table | Rôle | Champs notables |
|---|---|---|
| `vehicules` | Véhicules | `id`, `immat`, `marque`, `modele`, `genre` (VL / VU / PL), `carburant_type`, `puissance_din`, `puissance_fiscale`, `ptac`, `mise_en_circulation`, `assurance` (jsonb), `finance` (jsonb : mode/montant/durée), `controle_technique` (jsonb), `capacite_reservoir`, `docs` (jsonb metadata), bucket `vehicules-cartes-grises` |
| `carburant` | Pleins | `id`, `vehicule_id`, `salarie_id`, `date`, `litres`, `prix_litre`, `montant_ht`, `montant_ttc`, `tva_taux`, `tva_montant`, `km`, `station`, `bucket recus` |
| `entretiens` | Entretiens | `id`, `vehicule_id`, `type` (vidange, pneus, CT, …), `date`, `km`, `montant`, `fournisseur_id`, `note` |
| `inspections` | Inspections hebdo | `id`, `vehicule_id`, `salarie_id`, `semaine_iso`, `checklist` (jsonb 8 points), `commentaire` |
| `inspection_photos` | Photos par point inspection | `id`, `inspection_id`, `point` (string), bucket `inspections-photos` (privé) |

### Métier — Équipe

| Table | Rôle | Champs notables |
|---|---|---|
| `salaries` | Chauffeurs et autres salariés | `id`, `prenom`, `nom`, `poste_id`, `vehicule_affecte`, `salaire_brut`, `permis` (jsonb : types + dates expir), `medical` (jsonb), `docs` (jsonb metadata), bucket `salaries-documents` |
| `salaries_documents` | Index documents salariés | `id`, `salarie_id`, `type` (CNI, RIB, permis, etc.), `path`, `mime`, `taille`, `expire_le` |
| `postes` | Référentiel postes | `id`, `intitule`, `salaire_base` |
| `incidents` | Incidents salariés | `id`, `salarie_id`, `date`, `severite`, `statut`, `description`, `traite_par`, `traite_le` |
| `plannings_hebdo` | Planning par semaine | `id`, `salarie_id`, `semaine_iso`, `jours` (jsonb : 7 jours × {type, heures, vehicule}) |
| `absences_periodes` | Absences longues (CP, maladie, …) | `id`, `salarie_id`, `debut`, `fin`, `type`, `motif` |

### Métier — Opérations

| Table | Rôle | Champs notables |
|---|---|---|
| `livraisons` | Livraisons | `id`, `client_id`, `salarie_id`, `vehicule_id`, `date`, `depart`, `arrivee`, `montant_ht`, `tva_taux`, `tva_montant`, `montant_ttc`, `statut` (en_attente / en_cours / livree / litige), `statut_paiement` (attente / partiel / paye / retard), `paye_le`, `numero_facture`, `numero_bl`, `signature_url`, `client_siren` (snapshot), `client_tva_intracom` (snapshot), `client_pays` (snapshot) |
| `paiements` | Paiements clients | `id`, `livraison_id`, `montant`, `date`, `mode`, `reference` |
| `charges` | Charges hors carburant | `id`, `categorie`, `fournisseur_id`, `vehicule_id` (optionnel), `date`, `montant_ht`, `tva_taux`, `montant_ttc`, `statut_paiement`, `note` |

### Système

| Table | Rôle |
|---|---|
| `profiles` | Liaison `auth.users` ↔ rôle (admin / salarie) |
| `admin_identities` | Métadonnées admins (display_name, avatar) |
| `messages` | Chat admin ↔ salarié 1:1 |
| `alertes_admin` | Centre d'alertes (permis expiré, CT proche, …) |
| `audit_log_entries` | Journal d'audit immuable |
| `app_state` | Legacy : payload jsonb (en voie d'extinction, admin only depuis 024) |
| `_backup_app_state` | Backup historique avant migration |

## Storage (7 buckets, tous privés)

| Bucket | Usage |
|---|---|
| `vehicules-cartes-grises` | PDF carte grise par véhicule |
| `vehicules-docs` | Autres docs véhicules (assurance, contrat, etc.) |
| `salaries-documents` | CNI, permis, RIB, contrat de travail, etc. |
| `inspections-photos` | Photos par point d'inspection (privé depuis 027) |
| `carburant-recus` | Photos tickets carburant chauffeur |
| `company-assets` | Logo entreprise (007) |
| `factures-pdf` | PDF factures émises (cache) |

Accès : **signed URLs uniquement**, TTL 10 min côté `storage-uploader.js`.

## RLS (Row-Level Security)

Pattern global :

```sql
-- Admin : full access
create policy "admin_all" on public.<table>
  for all to authenticated
  using (
    exists (select 1 from public.profiles
            where id = auth.uid() and role = 'admin')
  );

-- Salarié : ses propres lignes uniquement
create policy "salarie_own" on public.<table>
  for select to authenticated
  using (salarie_id = auth.uid());
```

Ajustements par table dans `003_admin_salaries_policies.sql`,
`011_clients_realtime.sql`, `024_app_state_admin_only.sql`,
`026_versionner_policies_admin.sql`, `031_vehicules_cartes_grises_chauffeur_read.sql`.

## Realtime

Activé sur les tables où la sync entre admins / chauffeurs est utile :
- `clients` (depuis 011)
- `salaries` + `salaries_documents` (depuis 014, 015)
- `vehicules` (depuis 012)
- `livraisons`, `charges`, `carburant`, `entretiens`, `inspections`,
  `incidents`, `plannings_hebdo`, `messages`, `alertes_admin` (depuis 016).

## Migrations (état au 2026-05-05)

| # | Fichier | Sujet |
|---|---|---|
| 001 | `001_init.sql` | Schema initial (22 tables, RLS, FK, indexes) |
| 002 | `002_auth_login_bridge.sql` | Pont auth admin / salarié |
| 003 | `003_admin_salaries_policies.sql` | RLS policies salariés |
| 004 | `004_remote_app_state.sql` | `app_state.payload` (legacy sync) |
| 005 | `005_normalize_admin_display_names.sql` | Cleanup admins |
| 006 | `006_inspection_storage.sql` | Bucket `inspections-photos` |
| 007 | `007_company_assets_storage.sql` | Bucket logo entreprise |
| 008 | `008_phase0_foundations.sql` | Backup + triggers `updated_at` + colonnes manquantes |
| 009 | `009_phase0_storage_buckets.sql` | 5 buckets Storage privés |
| 010 | `010_clients_full_columns.sql` | Colonnes clients (siren, tva_intracom, etc.) |
| 011 | `011_clients_realtime.sql` | Realtime ON `public.clients` |
| 012 | `012_vehicules_full_columns.sql` | Colonnes véhicules (assurance, finance jsonb) |
| 013 | `013_legacy_app_state_to_native.sql` | Triggers transition app_state → tables natives |
| 014 | `014_salaries_full_columns.sql` | Colonnes salariés + realtime |
| 015 | `015_salaries_docs_metadata.sql` | Docs jsonb sur `public.salaries` + realtime `salaries_documents` |
| 016 | `016_phase4_remaining_entities.sql` | Realtime sur entités restantes |
| 017 | `017_audit_log.sql` | Table `audit_log_entries` |
| 018 | `018_fournisseurs_full.sql` | Colonnes fournisseurs |
| 019 | `019_cleanup_app_state.sql` | Nettoyage `app_state.payload` |
| 020 | `020_charges_statut_paiement.sql` | Colonne `statut_paiement` sur charges |
| 021 | `021_vehicules_capacite_reservoir.sql` | Capacité réservoir véhicules |
| 022 | `022_vehicules_docs_bucket.sql` | Bucket `vehicules-docs` |
| 023 | `023_fix_vehicules_docs_chauffeur_join.sql` | Fix join chauffeur ↔ docs véhicule |
| 024 | `024_app_state_admin_only.sql` | RLS `app_state` admin uniquement |
| 026 | `026_versionner_policies_admin.sql` | Versionnage policies admin |
| 027 | `027_inspections_photos_private.sql` | Bucket inspections-photos privé |
| 028 | `028_indexes_perf.sql` | Indexes de performance |
| 030 | `030_purge_app_state_legacy_entities.sql` | Purge entités legacy |
| 031 | `031_vehicules_cartes_grises_chauffeur_read.sql` | Lecture carte grise par chauffeur |

> Les migrations 025 et 029 ont été squashed lors de leur création.

## Edge functions (Deno, déployées via Supabase Dashboard)

| Fonction | Rôle |
|---|---|
| `provision-salarie-access` | Crée un auth.user + profile + salarié + envoie un mail invite |
| `delete-salarie-access` | Supprime un auth.user + cascade RLS |

Code source : `infra/supabase/functions/<nom>/index.ts`.

## Règles métier critiques (rappel)

- **Validation SIREN** : 9 chiffres exactement.
- **Validation TVA intracom FR** : algorithme CGI art. 289 II.
- **TVA carburant déductible** selon genre véhicule (CGI art. 298-4-1° et 298-4 D).
- **Snapshots client dans livraisons** : `client_siren`, `client_tva_intracom`, `client_pays` figés à la création (préserve l'historique si le client change ses infos).
- **Statut livraison ↔ statut paiement = découplés** intentionnellement.
- **Verrou d'édition concurrent** : un seul admin peut éditer une fiche à la fois.
- **Téléchargements** : signed URLs Storage avec TTL 10 min.
