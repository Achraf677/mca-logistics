# MCA Logistics — Backup chiffré quotidien

Outillage pour sauvegarder **toute la base Supabase + tous les buckets
Storage** du projet `lkbfvgnhwgbapdtitglu` :

- chiffrement asymétrique GPG (clé privée jamais sur le runner),
- stockage externe Cloudflare R2 (S3-compatible, cohérent avec
  l'hébergement Cloudflare Pages déjà en place),
- rétention rolling **daily 7 j / weekly 4 sem. / monthly 12 mois**,
- exécution quotidienne via GitHub Actions à **03:00 UTC**.

> Important : à ce stade aucun backup n'a encore été exécuté.
> Ce dossier ne contient que les scripts et la doc. Suivre la section
> *Mise en place* pour activer la chaîne.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `run-backup.sh`     | Script principal : pg_dump + dump Storage + tar + GPG + upload R2 + retention + log JSON |
| `restore-backup.sh` | Restauration : download R2 + déchiffrement + pg_restore + ré-upload Storage |
| `../../.github/workflows/backup.yml` | Cron GitHub Actions quotidien |

---

## 1. Générer la clé GPG (à faire **sur la machine de l'admin**, pas sur un serveur)

```bash
gpg --full-generate-key
# choisir : (9) ECC and ECC, Curve 25519, 0 = never expires
# nom: MCA Backup, email: backup@mca-logistics.local
```

Récupérer l'identifiant et exporter la **clé publique** uniquement :

```bash
gpg --list-keys --keyid-format LONG
# repérer la ligne "pub   ed25519/XXXXXXXXXXXXXXXX"
gpg --armor --export XXXXXXXXXXXXXXXX > mca-backup-pub.asc
```

**La clé privée reste sur la machine de l'admin** (et idéalement dans un
gestionnaire de secrets type 1Password / coffre offline). Si on la copie
sur le runner GitHub, un attaquant qui compromet le repo peut tout
déchiffrer — ça anéantit l'intérêt du chiffrement.

Faire au moins **deux exports de la clé privée** (USB chiffrée hors
ligne) sinon plus aucune restauration n'est possible :

```bash
gpg --armor --export-secret-keys XXXXXXXXXXXXXXXX > mca-backup-priv.asc
# stocker mca-backup-priv.asc sur 2 supports offline distincts.
```

---

## 2. Créer le bucket Cloudflare R2

1. Cloudflare dashboard → R2 → *Create bucket* → nom `mca-backups` (ou
   autre). Region = automatic.
2. R2 → *Manage R2 API Tokens* → *Create API token* :
   - Permissions : **Object Read & Write**
   - Bucket : restreindre à `mca-backups`
3. Noter `Access Key ID`, `Secret Access Key`, et l'`Account ID`
   (visible en haut à droite du dashboard).

Optionnel mais recommandé : activer la **Object Lock / Versioning**
sur le bucket pour empêcher une suppression malveillante.

---

## 3. Configurer les secrets GitHub

Repo → *Settings* → *Secrets and variables* → *Actions* → *New secret* :

| Secret | Valeur |
|---|---|
| `SUPABASE_DB_URL` | `postgresql://postgres:<password>@db.lkbfvgnhwgbapdtitglu.supabase.co:5432/postgres` (Supabase → Project Settings → Database → Connection string, mode "Session") |
| `SUPABASE_PROJECT_REF` | `lkbfvgnhwgbapdtitglu` |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` (Project Settings → API) |
| `R2_ACCOUNT_ID` | account id Cloudflare |
| `R2_ACCESS_KEY` | token R2 créé étape 2 |
| `R2_SECRET_KEY` | secret du token R2 |
| `R2_BUCKET` | `mca-backups` |
| `BACKUP_GPG_RECIPIENT` | l'email ou le keyid utilisé pour la clé GPG (ex. `backup@mca-logistics.local`) |
| `BACKUP_GPG_PUBLIC_KEY` | contenu armored de `mca-backup-pub.asc` (clé **publique** uniquement) |

> Ne JAMAIS mettre la clé privée GPG ni un mot de passe Supabase en clair
> ailleurs que dans GitHub Secrets.

Une fois fait, déclencher le workflow manuellement une fois pour
valider :

```
Actions → Daily Supabase Backup → Run workflow
```

Puis vérifier :
- l'objet `daily/mca-backup-YYYYMMDDTHHMMSSZ.tar.gpg` apparaît dans R2,
- le log JSON est attaché en artefact `backup-log-<run-id>` (statut
  `"status":"ok"`),
- la taille de l'archive chiffrée est cohérente (Mo, pas zéro).

---

## 4. Restaurer un backup

Toujours restaurer dans un projet **Supabase de test**, jamais en prod
(le script refuse explicitement les URLs contenant `prod`).

```bash
# Pré-requis local : psql/pg_restore 16, gpg avec la clé privée importée,
# awscli, jq, curl.

export R2_ACCOUNT_ID=xxx
export R2_ACCESS_KEY=xxx
export R2_SECRET_KEY=xxx
export R2_BUCKET=mca-backups

# DB cible (projet TEST !)
export TARGET_DB_URL='postgresql://postgres:<pwd>@db.<test-ref>.supabase.co:5432/postgres'

# Storage cible (optionnel, pour ré-uploader les fichiers)
export TARGET_SUPABASE_PROJECT_REF=<test-ref>
export TARGET_SUPABASE_SERVICE_ROLE_KEY=<service_role du projet test>

./infra/backup/restore-backup.sh 2026-05-03 --prefix daily
```

Options :

- `--prefix daily|weekly|monthly` — quelle rotation interroger
- `--db-only` / `--storage-only` — restaurer une moitié seulement
- `--target-db <url>` — surcharge `TARGET_DB_URL`
- `--yes` — saute la confirmation interactive (réservé scripts)

Le script va :

1. lister les objets du préfixe et trouver celui dont le nom contient
   la date demandée,
2. le télécharger depuis R2,
3. demander la passphrase GPG pour déchiffrer,
4. extraire `db.dump` + `storage/<bucket>/...`,
5. lancer `pg_restore --clean --if-exists --no-owner --no-privileges`,
6. recréer les buckets + ré-uploader chaque fichier via l'API Storage
   du projet cible.

---

## 5. Plan de test (à faire **mensuellement**)

Un backup non testé = pas un backup. Calendrier suggéré, premier lundi
de chaque mois :

1. Créer (ou réutiliser) un projet Supabase **test** vide.
2. Récupérer son `db_url`, son `project_ref` et son `service_role`.
3. Lancer `restore-backup.sh` sur le backup de la veille (`daily`).
4. Vérifications minimales sur le projet test :
   - `select count(*) from livraisons;` cohérent avec la prod (à 24 h
     près),
   - quelques requêtes RLS via clé `anon` retournent les bonnes lignes,
   - dans Storage, ouvrir un PDF d'inspection et un justificatif
     carburant — doivent s'afficher,
   - lancer l'app PWA pointée sur le projet test (changer
     `supabase-config.js`) et faire un tour rapide des écrans.
5. Logger le résultat (date, durée, taille restaurée, anomalies) dans
   un ticket "Backup drill <mois>".
6. Détruire le projet test ou le vider pour le mois suivant.

Si une étape échoue : ne pas attendre, traiter en P1.

---

## Notes de sécurité

- **Clé privée GPG** : jamais sur le runner, jamais dans le repo, jamais
  dans GitHub Secrets. Uniquement chez l'admin + offline backup.
- **Service role Supabase** : confère un accès total à la DB et au
  Storage. La rotation tous les 6 mois est recommandée (Supabase →
  *API* → *Reset service_role*).
- **Token R2** : limité au bucket de backup uniquement (pas de
  permissions sur d'autres buckets Cloudflare).
- Le script **shred** l'archive en clair après chiffrement et n'écrit
  jamais le contenu déchiffré ailleurs que dans `/tmp` du runner
  éphémère.
- Le workflow GitHub Actions ne doit **jamais** être déclenché depuis
  un fork ou un PR externe (cron + workflow_dispatch only).

---

## Dépannage rapide

| Symptôme | Cause probable |
|---|---|
| `pg_dump: server version 16.x; pg_dump 14.x` | runner sans le client PG 16 — vérifier l'étape *Install dependencies* du workflow |
| `gpg: <recipient>: skipped: No public key` | secret `BACKUP_GPG_PUBLIC_KEY` vide ou mauvaise clé ; ré-exporter et coller dans le secret |
| `An error occurred (InvalidAccessKeyId)` | mauvaises clés R2 ou endpoint manquant — vérifier `R2_ACCOUNT_ID` |
| `download failed <bucket>/<file>` dans le log | objet renommé/supprimé pendant le dump ; relancer si occasionnel |
| Archive chiffrée > quelques Go | normal si beaucoup de pièces jointes Storage ; envisager R2 lifecycle pour bascule en classe d'archive |
