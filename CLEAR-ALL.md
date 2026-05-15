# Clear ALL — procédure de remise à zéro complète

> Doc créée 2026-05-15 après résolution du bug "data fantôme qui revient après clear".
> Cause racine : (a) Supabase project unique partagé prod ↔ dev, (b) migration auto localStorage → Supabase qui ressuscitait les données.
> Fix dans commits `51c8e98` (v155 — détection localhost auto) et `d662d1f` (v156 — migration auto OPT-IN).

---

## 🎯 Quand utiliser ce doc

- Tu veux **repartir d'un état propre** (dev ou prod)
- Tu vois **des données fantômes** qui reviennent après un clear
- Tu lances un **audit visuel/fonctionnel** et veux contrôler les données affichées
- Tu changes de **modèle de données** et veux purger l'ancien format

---

## 🧪 Diagnostic préalable (avant clear)

**Console F12** sur `http://127.0.0.1:5500/admin.html` :

```js
fetch('/tools/diag-storage.js').then(r => r.text()).then(eval);
```

Affiche :
- Origin détecté (localhost ou prod)
- Clés localStorage avec leur taille
- sessionStorage
- IndexedDB databases
- Service Worker caches + registrations
- Cookies
- Session Supabase active ou non
- `isLocalOnlyMode` computed (true → adapters désactivés)

Cette vue te dit **d'où vient la data** avant de tout clear.

---

## ☢️ Procédure CLEAR LOCAL (dev — `127.0.0.1:5500`)

### Étape 1 — Hard reload pour charger v156+
```
Ctrl+Shift+R sur http://127.0.0.1:5500/admin.html
```

### Étape 2 — Nuke total via console F12
```js
(async () => {
  localStorage.clear();
  sessionStorage.clear();

  // IndexedDB (storage uploader, edit-locks)
  const dbs = await indexedDB.databases();
  for (const db of dbs) indexedDB.deleteDatabase(db.name);

  // SW caches (assets)
  const keys = await caches.keys();
  for (const k of keys) await caches.delete(k);

  // SW unregister
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();

  // Cookies
  document.cookie.split(';').forEach(c => {
    document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
  });

  // Supabase signOut (au cas où)
  try { await window.DelivProSupabase?.getClient?.()?.auth?.signOut(); } catch {}

  console.log('☢️ NUKE COMPLETE. Reload...');
  setTimeout(() => location.replace(location.pathname), 1500);
})();
```

OU plus court (helper exposé par diag-storage.js) :
```js
await window.MCA_NUKE_STORAGE();
```

### Étape 3 — Vérification post-clear
- Page vide
- ~25-32 clés localStorage = **NORMAL** (boot defaults : `theme`, `taux_tva`, flags `_migrated_v1`, etc. — cf [STORAGE-AUDIT.md](STORAGE-AUDIT.md))
- 0 livraison / 0 client / 0 véhicule affichés

### Étape 4 — Re-seed dev (optionnel)
```
http://127.0.0.1:5500/admin.html?reseed=1
```
→ Régénère 500 livraisons + 25 clients + 12 véhicules + 8 salariés + 250 pleins + 30 alertes (localStorage uniquement, **JAMAIS Supabase** grâce au fix v155).

---

## ☢️ Procédure CLEAR PROD (production — `mca-logistics.pages.dev`)

⚠️ **DESTRUCTIVE** — va supprimer toutes les données réelles. À faire seulement si :
- Pas d'autres admins actifs au moment T
- Backup Supabase effectué (`pg_dump`)
- Vraie intention de repartir de zéro

### Étape 1 — Clean ton localStorage prod (browser)
Ouvre https://mca-logistics.pages.dev → Console F12 :
```js
localStorage.clear();
sessionStorage.clear();
try { await window.DelivProSupabase.getClient().auth.signOut(); } catch {}
location.reload();
```

Tu seras déconnecté. Tu vois la page login.

### Étape 2 — DRY RUN Supabase (voir counts avant delete)

SQL Editor : https://supabase.com/dashboard/project/lkbfvgnhwgbapdtitglu/sql

```sql
SELECT 'livraisons' AS t, COUNT(*) AS to_delete FROM livraisons
UNION ALL SELECT 'paiements',         COUNT(*) FROM paiements
UNION ALL SELECT 'incidents',         COUNT(*) FROM incidents
UNION ALL SELECT 'inspections',       COUNT(*) FROM inspections
UNION ALL SELECT 'inspection_photos', COUNT(*) FROM inspection_photos
UNION ALL SELECT 'entretiens',        COUNT(*) FROM entretiens
UNION ALL SELECT 'carburant',         COUNT(*) FROM carburant
UNION ALL SELECT 'messages',          COUNT(*) FROM messages
UNION ALL SELECT 'salaries_documents', COUNT(*) FROM salaries_documents
UNION ALL SELECT 'absences_periodes', COUNT(*) FROM absences_periodes
UNION ALL SELECT 'plannings_hebdo',   COUNT(*) FROM plannings_hebdo
UNION ALL SELECT 'salaries',          COUNT(*) FROM salaries
UNION ALL SELECT 'vehicules',         COUNT(*) FROM vehicules
UNION ALL SELECT 'clients',           COUNT(*) FROM clients
UNION ALL SELECT 'fournisseurs',      COUNT(*) FROM fournisseurs
UNION ALL SELECT 'charges',           COUNT(*) FROM charges
UNION ALL SELECT 'postes',            COUNT(*) FROM postes
UNION ALL SELECT 'alertes_admin',     COUNT(*) FROM alertes_admin
UNION ALL SELECT 'edit_locks',        COUNT(*) FROM edit_locks
UNION ALL SELECT 'ai_pending_actions', COUNT(*) FROM ai_pending_actions
ORDER BY 1;
```

Valider visuellement les counts.

### Étape 3 — DELETE Supabase

```sql
BEGIN;

-- Enfants d'abord (FK)
DELETE FROM paiements;
DELETE FROM incidents;
DELETE FROM inspection_photos;
DELETE FROM inspections;
DELETE FROM entretiens;
DELETE FROM carburant;
DELETE FROM messages;
DELETE FROM salaries_documents;
DELETE FROM absences_periodes;
DELETE FROM plannings_hebdo;

-- Parent
DELETE FROM livraisons;

-- Entités
DELETE FROM salaries;
DELETE FROM vehicules;
DELETE FROM clients;
DELETE FROM fournisseurs;
DELETE FROM charges;
DELETE FROM postes;

-- Système
DELETE FROM alertes_admin;
DELETE FROM edit_locks;
DELETE FROM ai_pending_actions;

COMMIT;
```

### Étape 4 — Re-login prod
Tu te re-logges sur pages.dev. L'adapter va `pullAll()` mais Supabase est vide → ton localStorage reste vide. **Plus de résurrection** grâce au fix v156 (migration auto désactivée par défaut).

### Étape 5 — Vérif post-clear
Relance le DRY RUN Étape 2 → tous les counts à **0**.

---

## 🛡️ Tables Supabase préservées (à ne JAMAIS clear sans raison)

| Table | Rows actuels | Pourquoi garder |
|---|---|---|
| `profiles` | 44 | Comptes auth Supabase — supprimer = login cassé |
| `admin_identities` | 2 | Toi + admins associés |
| `audit_log_entries` | ~14k | Traçabilité légale immutable |
| `app_state` | 1 | Config globale app |
| `_backup_app_state` | 1 | Backup système |
| `ai_memory`, `ai_brief_runs`, `ai_quota_daily`, `ai_visual_audit_runs` | 0 | Déjà vides, schémas IA |
| Tables `migrations` Supabase | - | Sinon schéma se redéploie |

---

## 🔧 Re-activer la migration legacy (si besoin de migrer)

Si tu veux que `localStorage → Supabase` push initial soit ré-activée (par exemple pour migrer un user qui n'a jamais sync) :

Console F12 sur prod :
```js
localStorage.setItem('mca_enable_legacy_migration', '1');
location.reload();
```

Ou via JS global avant chargement scripts :
```js
window.MCA_ENABLE_LEGACY_MIGRATION = true;
```

⚠️ N'oublie pas de **désactiver** après la migration pour éviter ressurection future :
```js
localStorage.removeItem('mca_enable_legacy_migration');
```

---

## 🚦 Modes d'isolation des adapters Supabase

Les adapters (livraisons, clients, vehicules, etc.) **ne s'activent PAS** dans les cas suivants :

| Condition | Comportement |
|---|---|
| `hostname` = `localhost` / `127.0.0.1` / `0.0.0.0` / `*.local` | ❌ Désactivés (auto-détection v155) |
| `protocol` = `file://` | ❌ Désactivés |
| `window.MCA_DISABLE_SUPABASE_SYNC === true` | ❌ Désactivés (override JS) |
| `sessionStorage.disable_supabase_sync === '1'` | ❌ Désactivés (override session) |
| `admin_login` = `dev-admin` ou commence par `dev-` | ❌ Désactivés |
| `auth_mode` = `local` ou `dev` | ❌ Désactivés |
| Pas de session Supabase auth active | ❌ Désactivés |
| Aucune des conditions ci-dessus | ✅ Actifs (mode prod normal) |

---

## 📋 Checklist quick reference

### Pour clear dev :
- [ ] `Ctrl+Shift+R` admin.html
- [ ] Console F12 : `await window.MCA_NUKE_STORAGE()`
- [ ] (optionnel) `?reseed=1` pour repeupler

### Pour clear prod :
- [ ] Backup Supabase (`pg_dump` ou Supabase dashboard Export)
- [ ] Notifier équipe / window de maintenance
- [ ] Browser prod : clear localStorage + signOut
- [ ] Supabase SQL : DRY RUN counts
- [ ] Supabase SQL : `BEGIN; DELETE; COMMIT;`
- [ ] Supabase SQL : re-DRY RUN → tout à 0
- [ ] Browser prod : re-login → page vide
- [ ] Test création 1 entité → push Supabase OK
- [ ] Vérifier `audit_log_entries` toujours présent

---

## 🔗 Liens

- [STORAGE-AUDIT.md](STORAGE-AUDIT.md) — inventaire 47 clés localStorage + plan réintégration code legacy
- [tools/diag-storage.js](tools/diag-storage.js) — diagnostic + `MCA_NUKE_STORAGE()` helper
- [tools/supabase-cleanup-aggressive.sql](tools/supabase-cleanup-aggressive.sql) — SQL canonique
- [entity-supabase-adapter.js](entity-supabase-adapter.js) — `isLocalOnlyMode()` + migration opt-in
- [WORK-PRINCIPLES.md](WORK-PRINCIPLES.md) — Principe #10 (data riche obligatoire)
