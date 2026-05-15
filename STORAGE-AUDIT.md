# Audit clés localStorage — code vivant vs code mort

> Date : 2026-05-15
> Total clés écrites : 47 (unique)
> Total clés lues : 92 (unique, certaines en plus de celles écrites)
>
> Statuts :
> - 🟢 **LIVE** : écrite ET lue, intégrée au site
> - 🟡 **BOOT** : écrite au boot avec défaut (theme, taux_tva), normale
> - 🟠 **LEGACY** : écrite par ancienne version, plus lue → orpheline (à réintégrer ou supprimer)
> - 🔴 **DEAD** : ni écrite ni lue dans le code actuel → vestige
> - ⚪ **CONFIG** : config utilisateur persistante (paramètres, objectifs)

---

## 🟢 LIVE — Entités métier principales (intégrées)

| Clé | Domaine | Source data | Page d'utilisation |
|---|---|---|---|
| `livraisons` | Livraisons | seed + UI form | Livraisons (table/kanban/calendrier), Dashboard KPIs, Stats, Rentabilité |
| `clients` | Tiers | seed + UI | Clients, Livraisons (autocomplete) |
| `fournisseurs` | Tiers | seed + UI | Fournisseurs, Charges (FK) |
| `vehicules` | Flotte | seed + UI | Véhicules (cards), Carburant (FK), Entretiens (FK) |
| `salaries` | RH | seed + UI | Équipe, Salariés, Heures |
| `carburant` | Flotte | seed + UI | Carburant, Rentabilité |
| `charges` | Compta | seed + UI | Charges, Rentabilité, Encaissement |
| `entretiens` | Flotte | seed + UI | Entretiens, Véhicules |
| `inspections` | Flotte | seed + UI | Inspections |
| `incidents` | RH/Flotte | seed + UI | Incidents, Équipe |
| `paiements` | Compta | seed + UI | Encaissement, Livraisons (statutPaiement) |
| `alertes_admin` | Système | seed + auto | Alertes (toutes pages, badges sidebar) |
| `plannings_hebdo` | RH | seed + UI | Planning, Équipe, Heures |
| `absences_periodes` | RH | UI | Planning (overlay absences) |
| `postes` | RH | UI | Salariés (dropdown postes) |

---

## 🟡 BOOT — Defaults écrits au load (normaux)

| Clé | Écrit par | But |
|---|---|---|
| `theme` | `script-core-branding.js:120` | dark/light persistance |
| `taux_tva` | `script-tva.js:478` | Taux TVA par défaut (20%) |
| `mca_setup_skipped_until` | `script-setup-wizard.js` | Date jusqu'à laquelle skip wizard |
| `mca_setup_done` / `mca_setup_completed` | `script-setup-wizard.js` | Flag wizard terminé |
| `mca_pagination_mode` | UI table | Mode pagination préféré (10/25/50/100) |
| `mca_mobile_theme` | mobile UI | Theme mobile |
| `mca_dev_seeded` | seed | Flag seed exécuté |
| `delivpro_modifs_cleanup_at` | `script-core-edit-locks.js` | Timestamp dernier cleanup edit-locks |
| `*_migrated_v1` | adapters | Flag migration legacy → Supabase exécutée |

**Total ~10 clés** qui se réécrivent automatiquement au boot. C'est normal.

---

## 🟠 LEGACY — À réintégrer ou décommissionner

Ces clés EXISTENT dans le code (lues ou écrites) mais semblent **orphelines** : pas de page UI active qui les expose ou alors plusieurs versions concurrentes.

### Compta legacy (parallèle à `paiements`/`charges`/Supabase)
| Clé | Lue par | Écrite par | Statut suggéré |
|---|---|---|---|
| `factures_emises` | ✅ RÉINTÉGRÉ 2026-05-15 — section "Factures émises" page Encaissement + export CSV (script-encaissement-legacy.js). |
| `encaissements` / `encaissements_manuels` | Encaissement | UI form ? | **Fusionner** avec `paiements` (source unique) |
| `avoirs` / `avoirs_emis` | ✅ RÉINTÉGRÉ 2026-05-15 — section "Avoirs émis" page Encaissement (script-encaissement-legacy.js). |
| `acomptes` | ✅ RÉINTÉGRÉ 2026-05-15 — section "Acomptes reçus" page Encaissement (script-encaissement-legacy.js). |
| `relances` / `relances_log` | ✅ RÉINTÉGRÉ 2026-05-15 — section "Historique des relances" page Encaissement (script-encaissement-legacy.js). |

### RH legacy
| Clé | Statut | Action |
|---|---|---|
| `chauffeurs` | Alias historique de `salaries` | **Supprimer** : redondant |
| `plannings` (vs `plannings_hebdo`) | Ancien format planning | **Vérifier** : si vide, supprimer |
| `heures_pointage` (vs `heures`) | 2 formats coexistants | **Fusionner** : garder un seul |
| `km_sal_<id>` | ✅ DÉJÀ intégré (verified 2026-05-15) — page Heures&Km section "Relevés kilométriques" + table `tb-releve-km` + `afficherReleveKm()` (script.js:1324) + edit modal `modal-edit-km`. |
| `notifs_sal_<id>` | Notifications par salarié | **Réintégrer** : centre notif salarié espace mobile |
| `messages_<id>` | Chat par salarié | **Réintégrer** : chat admin↔salarié dans drawer |

### Documents legacy
| Clé | Statut | Action |
|---|---|---|
| `documents_livraison_<id>` | Pièces jointes par livraison | **Réintégrer** : onglet Documents drawer livraison (existe déjà — vérifier wiring) |
| `logo_entreprise` / `logo_entreprise_path` / `logo_entreprise_url` | ✅ DÉJÀ propre (verified 2026-05-15) — `url` = canonique display, `path` = path Supabase Storage pour re-signing, `logo_entreprise` = fallback legacy data URL pré-Supabase. Pattern intentionnel. |
| `notes_internes` | ✅ DÉJÀ intégré (verified 2026-05-15) — notes par salarié via `modal-note-interne` + `confirmerNoteInterne()` (script-core-ui.js:347). Pattern : map salId → {texte, date}, pas global. |

### Audit/Agent IA
| Clé | Statut | Action |
|---|---|---|
| `audit_log` (vs Supabase `audit_log_entries`) | Log local fallback | **Garder** comme cache offline |
| `agent_decisions` | ✅ DÉJÀ intégré (verified 2026-05-15) — affiché dans panneau-agent (#agent-decisions-list, admin.html:5172) côté PC + script-mobile.js lignes 3920-4150 côté mobile. Pattern : panneau dédié, pas onglet Brouillons IA. |

### Compta config
| Clé | Statut | Action |
|---|---|---|
| `tva_declarations` | ✅ RÉINTÉGRÉ 2026-05-15 — page TVA section "Historique des déclarations TVA" (admin.html `#tva-historique-card` + script-tva-historique.js). |
| `charges_categories` | ✅ RÉINTÉGRÉ 2026-05-16 — Paramètres > Comptabilité section "Catégories charges custom" + CRUD chip-based (script-charges-categories.js). |
| `config_anomalies_carburant` | Seuils détection anomalies | ✅ DÉJÀ : modal "Configurer anomalies" |
| `config_rentabilite` | Config calcul rentabilité | ✅ DÉJÀ : modal "Config" Rentabilité |
| `rentabilite_calculateur_v2` | State du simulateur Rentabilité | ✅ DÉJÀ : tab Simulateur |

### KPI objectifs
| Clé | Statut | Action |
|---|---|---|
| `objectif_ca_mensuel` | Cible CA mensuelle | **Réintégrer** : Dashboard delta vs objectif |
| `objectif_livraisons_mensuel` | Cible livraisons mensuelles | **Réintégrer** : Dashboard delta vs objectif |

### Configuration entreprise
| Clé | Statut | Action |
|---|---|---|
| `params` / `params_entreprise` / `config_entreprise` | 3 clés pour params | **Fusionner** : 1 seule (params_entreprise) |

### Auth / admin
| Clé | Statut | Action |
|---|---|---|
| `admin_accounts` | Comptes admin (multi-admin) | ✅ DÉJÀ : page Paramètres > Sécurité (à vérifier) |
| `backup_admin_last_export` | Timestamp dernier export | ✅ DÉJÀ : feedback "Dernière sauvegarde" |
| `max_tentatives` | Max tentatives login | ✅ DÉJÀ : Paramètres > Sécurité |
| `session_timeout_min` | Timeout session | ✅ DÉJÀ : Paramètres > Sécurité |
| `relance_delai` | Jours avant relance auto | **Vérifier** wiring : Paramètres > Comptabilité ? |
| `mca_debug` | Mode debug verbose | **Cacher** : flag dev uniquement |

---

## 🔴 DEAD — Vestiges sans usage

_(Aucun pour l'instant — toutes les clés ont au moins un read ou un write quelque part)_

---

## 🎯 Plan d'action priorisé

### Priorité 1 — Fusion clés dupliquées (gain de cohérence immédiat)
1. **Params entreprise** : `params` + `params_entreprise` + `config_entreprise` → 1 seule (`params_entreprise`)
2. ~~**Logo** : `logo_entreprise` + `logo_entreprise_path` + `logo_entreprise_url`~~ — FALSE POSITIVE 2026-05-15 : 3 rôles distincts (url canonique / path Supabase / fallback data URL). Pattern intentionnel.
3. **Heures** : `heures` + `heures_pointage` → 1 seule (`heures`)
4. **Encaissement** : `encaissements` + `encaissements_manuels` → 1 seule (fusionnée avec `paiements`)
5. **Chauffeurs** : supprimer `chauffeurs` (redondant avec `salaries`)

### Priorité 2 — Réintégrer fonctionnalités orphelines
6. ✅ **Page TVA section "Historique déclarations"** (`tva_declarations`) — DONE 2026-05-15 (script-tva-historique.js)
7. ✅ **Page Encaissement section "Acomptes"** (`acomptes`) — DONE 2026-05-15 (script-encaissement-legacy.js)
8. ✅ **Page Encaissement section "Avoirs émis"** (`avoirs`) — DONE 2026-05-15 (script-encaissement-legacy.js)
9. ✅ **Page Encaissement section "Factures émises"** (`factures_emises`) — DONE 2026-05-15 (script-encaissement-legacy.js + export CSV)
10. ✅ **Page Encaissement section "Historique relances"** (`relances` + `relances_log`) — DONE 2026-05-15 (script-encaissement-legacy.js)
11. **Drawer livraison onglet "Documents"** vérifier wiring (`documents_livraison_*`)
12. **Drawer salarié onglet "Messages"** (`messages_<id>`)
13. **Drawer salarié onglet "Notifications"** (`notifs_sal_<id>`)
14. ✅ **Heures&Km section "Relevé km par salarié"** (`km_sal_<id>`) — VERIFIED 2026-05-15 (déjà via afficherReleveKm() + tb-releve-km)
15. ✅ **Dashboard widget "Objectif CA"** (`objectif_ca_mensuel`) — DONE 2026-05-15 (Paramètres input + script-core-storage save)
16. ✅ **Dashboard widget "Objectif livraisons"** (`objectif_livraisons_mensuel`) — DONE 2026-05-15 (idem)
17. ✅ **Paramètres>Comptabilité config "Catégories charges custom"** (`charges_categories`) — DONE 2026-05-16 (script-charges-categories.js + chips CRUD)
18. ✅ **Brouillons IA / Panneau agent "Décisions"** (`agent_decisions`) — VERIFIED 2026-05-15 (déjà via panneau-agent #agent-decisions-list)
19. ✅ **Notes internes** (`notes_internes`) — VERIFIED 2026-05-15 (modal per-employee, pas global)

### Priorité 3 — Documentation / nettoyage
20. Documenter chaque clé dans un fichier `STORAGE-KEYS.md` avec contrat (shape, durée vie, source de vérité)

---

## 📊 Pourquoi 32 clés après clear ?

Après `localStorage.clear()` + reload, le boot du site écrit automatiquement :
- 1× theme (dark default)
- 1× taux_tva (20% default)
- 1× mca_pagination_mode (50 default)
- 1× session_timeout_min (30 default)
- 1× max_tentatives (3 default)
- ~5× flags `_migrated_v1` (adapters)
- Si `?reseed=1` : 17 clés données + 1 flag mca_dev_seeded

**Total ~25-32 clés** au boot post-clear. **C'est normal**. Ce sont les valeurs par défaut + le seed dev.

Pour un vrai état "vide post-clear" sans aucun défaut : utiliser un compte non-dev (pas `dev-admin`), passer en mode prod (`auth_mode='supabase'`), et le site ne seed pas.

---

## Liens

- `tools/supabase-cleanup-aggressive.sql` — clear côté Supabase
- `script-dev-seed.js:103` — `clearAll()` exhaustif (post Phase 60 V7)
- `WORK-PRINCIPLES.md` Principe #10 — data riche obligatoire pour audit visuel
