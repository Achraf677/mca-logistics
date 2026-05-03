#!/usr/bin/env bash
# MCA Logistics - Daily encrypted backup runner
#
# Dumps Supabase Postgres + all Storage buckets, encrypts the resulting
# tarball with GPG (asymmetric, public key only on runner), uploads to
# Cloudflare R2 (S3-compatible) and applies a rolling retention policy
# (daily 7d / weekly 4w / monthly 12m).
#
# IMPORTANT: this script never writes the GPG private key on disk and
# never uploads cleartext archives. All secrets must come from env vars.

set -Eeuo pipefail

# ---------------------------------------------------------------------------
# Required environment variables
# ---------------------------------------------------------------------------
REQUIRED_VARS=(
  SUPABASE_DB_URL              # postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres
  SUPABASE_PROJECT_REF         # e.g. lkbfvgnhwgbapdtitglu
  SUPABASE_SERVICE_ROLE_KEY    # service_role JWT (Storage API)
  R2_ACCOUNT_ID                # Cloudflare account id
  R2_ACCESS_KEY                # R2 access key id
  R2_SECRET_KEY                # R2 secret access key
  R2_BUCKET                    # destination bucket name
  BACKUP_GPG_RECIPIENT         # GPG public key id / email (recipient)
)

missing=()
for v in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!v:-}" ]; then
    missing+=("$v")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "FATAL: missing env vars: ${missing[*]}" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DATE_UTC="$(date -u +%Y-%m-%d)"
TS_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
DOW="$(date -u +%u)"          # 1..7 (Monday=1)
DOM="$(date -u +%d)"          # 01..31

WORK_DIR="${BACKUP_WORK_DIR:-/tmp/mca-backup-${TS_UTC}}"
LOG_DIR="${BACKUP_LOG_DIR:-/var/log}"
LOG_FILE="${LOG_DIR}/mca-backup-${DATE_UTC}.log"

R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_PREFIX_DAILY="daily"
R2_PREFIX_WEEKLY="weekly"
R2_PREFIX_MONTHLY="monthly"

RETENTION_DAILY_DAYS=7
RETENTION_WEEKLY_DAYS=28
RETENTION_MONTHLY_DAYS=370

mkdir -p "$WORK_DIR" "$LOG_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT

# ---------------------------------------------------------------------------
# Tooling check
# ---------------------------------------------------------------------------
need() {
  command -v "$1" >/dev/null 2>&1 || { echo "FATAL: missing binary: $1" >&2; exit 3; }
}
need pg_dump
need gpg
need curl
need jq
need tar
need aws

# AWS CLI configured for R2 via env (no profile written to disk)
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_KEY"
export AWS_DEFAULT_REGION="auto"
export AWS_EC2_METADATA_DISABLED=true

aws_r2() {
  aws --endpoint-url "$R2_ENDPOINT" "$@"
}

# Status accumulator for the JSON report
REPORT_STATUS="ok"
REPORT_ERRORS=()
report_error() {
  REPORT_STATUS="error"
  REPORT_ERRORS+=("$1")
  echo "ERROR: $1" >&2
}

# ---------------------------------------------------------------------------
# 1) Postgres dump (custom format -> reimport via pg_restore)
# ---------------------------------------------------------------------------
DB_DUMP="${WORK_DIR}/db.dump"
echo "[*] pg_dump..."
if ! pg_dump --format=custom --no-owner --no-privileges \
     --file="$DB_DUMP" "$SUPABASE_DB_URL"; then
  report_error "pg_dump failed"
fi
DB_DUMP_BYTES=0
if [ -f "$DB_DUMP" ]; then
  DB_DUMP_BYTES=$(stat -c '%s' "$DB_DUMP")
fi

# ---------------------------------------------------------------------------
# 2) Storage buckets - list + dump every object via service_role
# ---------------------------------------------------------------------------
STORAGE_DIR="${WORK_DIR}/storage"
mkdir -p "$STORAGE_DIR"

SUPABASE_API="https://${SUPABASE_PROJECT_REF}.supabase.co"
AUTH_HEADER="Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
APIKEY_HEADER="apikey: ${SUPABASE_SERVICE_ROLE_KEY}"

echo "[*] Listing storage buckets..."
buckets_json="$(curl -fsS -H "$AUTH_HEADER" -H "$APIKEY_HEADER" \
  "${SUPABASE_API}/storage/v1/bucket")" || {
  report_error "could not list storage buckets"
  buckets_json="[]"
}

bucket_count=0
object_count=0

# Recursive object lister (Supabase storage paginates by prefix)
list_bucket_recursive() {
  local bucket="$1"
  local prefix="${2:-}"
  local offset=0
  local limit=1000
  while :; do
    local body
    body=$(jq -nc --arg p "$prefix" --argjson l "$limit" --argjson o "$offset" \
      '{prefix:$p,limit:$l,offset:$o,sortBy:{column:"name",order:"asc"}}')
    local page
    page=$(curl -fsS -X POST \
      -H "$AUTH_HEADER" -H "$APIKEY_HEADER" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "${SUPABASE_API}/storage/v1/object/list/${bucket}") || {
      report_error "list failed bucket=${bucket} prefix=${prefix}"
      return 1
    }
    local count
    count=$(echo "$page" | jq 'length')
    [ "$count" -eq 0 ] && break

    # Files have id != null, folders have id == null
    echo "$page" | jq -r '.[] | select(.id != null) | .name' | while IFS= read -r name; do
      [ -z "$name" ] && continue
      local full="${prefix}${name}"
      local out="${STORAGE_DIR}/${bucket}/${full}"
      mkdir -p "$(dirname "$out")"
      if ! curl -fsS -H "$AUTH_HEADER" -H "$APIKEY_HEADER" \
            -o "$out" \
            "${SUPABASE_API}/storage/v1/object/${bucket}/${full}"; then
        report_error "download failed ${bucket}/${full}"
      fi
    done

    # Recurse into folders
    echo "$page" | jq -r '.[] | select(.id == null) | .name' | while IFS= read -r folder; do
      [ -z "$folder" ] && continue
      list_bucket_recursive "$bucket" "${prefix}${folder}/"
    done

    [ "$count" -lt "$limit" ] && break
    offset=$((offset + limit))
  done
}

echo "$buckets_json" | jq -r '.[].name' | while IFS= read -r bucket; do
  [ -z "$bucket" ] && continue
  echo "[*] Dumping bucket: $bucket"
  mkdir -p "${STORAGE_DIR}/${bucket}"
  list_bucket_recursive "$bucket" ""
done

bucket_count=$(echo "$buckets_json" | jq 'length')
object_count=$(find "$STORAGE_DIR" -type f 2>/dev/null | wc -l)

# Save bucket metadata too (policies / public flag etc.)
echo "$buckets_json" > "${STORAGE_DIR}/_buckets.json"

# ---------------------------------------------------------------------------
# 3) Tarball
# ---------------------------------------------------------------------------
ARCHIVE="${WORK_DIR}/mca-backup-${TS_UTC}.tar"
echo "[*] Creating archive..."
tar -C "$WORK_DIR" -cf "$ARCHIVE" \
  "$(basename "$DB_DUMP")" \
  "$(basename "$STORAGE_DIR")" \
  || report_error "tar failed"

ARCHIVE_BYTES=$(stat -c '%s' "$ARCHIVE" 2>/dev/null || echo 0)

# ---------------------------------------------------------------------------
# 4) GPG encryption (asymmetric - private key NOT on this runner)
# ---------------------------------------------------------------------------
ENCRYPTED="${ARCHIVE}.gpg"
echo "[*] Encrypting with GPG recipient=${BACKUP_GPG_RECIPIENT}..."

# Import public key from env if provided (CI typically passes it as a secret)
if [ -n "${BACKUP_GPG_PUBLIC_KEY:-}" ]; then
  echo "$BACKUP_GPG_PUBLIC_KEY" | gpg --batch --import 2>/dev/null || true
fi

if ! gpg --batch --yes --trust-model always \
     --compress-algo zlib \
     --cipher-algo AES256 \
     --encrypt --recipient "$BACKUP_GPG_RECIPIENT" \
     --output "$ENCRYPTED" "$ARCHIVE"; then
  report_error "gpg encrypt failed"
  exit 1
fi

# Sanity check: the cleartext archive must not leave the runner.
shred -u "$ARCHIVE" 2>/dev/null || rm -f "$ARCHIVE"

ENCRYPTED_BYTES=$(stat -c '%s' "$ENCRYPTED")
ENCRYPTED_SHA256=$(sha256sum "$ENCRYPTED" | awk '{print $1}')

# ---------------------------------------------------------------------------
# 5) Upload to R2 (daily, plus weekly on Monday, plus monthly on 1st)
# ---------------------------------------------------------------------------
BASENAME="mca-backup-${TS_UTC}.tar.gpg"
upload_to() {
  local prefix="$1"
  local key="${prefix}/${BASENAME}"
  echo "[*] Uploading s3://${R2_BUCKET}/${key}"
  if ! aws_r2 s3 cp "$ENCRYPTED" "s3://${R2_BUCKET}/${key}" --only-show-errors; then
    report_error "upload failed prefix=${prefix}"
    return 1
  fi
}

upload_to "$R2_PREFIX_DAILY"
if [ "$DOW" = "1" ]; then
  upload_to "$R2_PREFIX_WEEKLY"
fi
if [ "$DOM" = "01" ]; then
  upload_to "$R2_PREFIX_MONTHLY"
fi

# ---------------------------------------------------------------------------
# 6) Rolling retention - delete objects older than threshold per prefix
# ---------------------------------------------------------------------------
prune_prefix() {
  local prefix="$1"
  local max_days="$2"
  local cutoff_epoch=$(( $(date -u +%s) - max_days * 86400 ))
  echo "[*] Pruning ${prefix}/ (>${max_days}d)..."
  aws_r2 s3api list-objects-v2 \
    --bucket "$R2_BUCKET" --prefix "${prefix}/" \
    --output json 2>/dev/null \
    | jq -r --argjson c "$cutoff_epoch" \
        '.Contents // [] | .[] | select((.LastModified | fromdateiso8601) < $c) | .Key' \
    | while IFS= read -r key; do
        [ -z "$key" ] && continue
        echo "    delete $key"
        aws_r2 s3 rm "s3://${R2_BUCKET}/${key}" --only-show-errors \
          || report_error "prune failed ${key}"
      done
}

prune_prefix "$R2_PREFIX_DAILY"   "$RETENTION_DAILY_DAYS"
prune_prefix "$R2_PREFIX_WEEKLY"  "$RETENTION_WEEKLY_DAYS"
prune_prefix "$R2_PREFIX_MONTHLY" "$RETENTION_MONTHLY_DAYS"

# ---------------------------------------------------------------------------
# 7) JSON report
# ---------------------------------------------------------------------------
errors_json=$(printf '%s\n' "${REPORT_ERRORS[@]:-}" | jq -R . | jq -s 'map(select(length>0))')

jq -nc \
  --arg ts "$TS_UTC" \
  --arg date "$DATE_UTC" \
  --arg status "$REPORT_STATUS" \
  --arg project "$SUPABASE_PROJECT_REF" \
  --arg bucket "$R2_BUCKET" \
  --arg basename "$BASENAME" \
  --arg sha "$ENCRYPTED_SHA256" \
  --argjson db_bytes "$DB_DUMP_BYTES" \
  --argjson archive_bytes "$ARCHIVE_BYTES" \
  --argjson encrypted_bytes "$ENCRYPTED_BYTES" \
  --argjson buckets "$bucket_count" \
  --argjson objects "$object_count" \
  --argjson errors "$errors_json" \
  '{
    timestamp_utc: $ts,
    date_utc: $date,
    status: $status,
    supabase_project: $project,
    r2_bucket: $bucket,
    artifact: $basename,
    sha256: $sha,
    sizes: {
      pg_dump: $db_bytes,
      tar: $archive_bytes,
      encrypted: $encrypted_bytes
    },
    storage: { buckets: $buckets, objects: $objects },
    errors: $errors
  }' | tee -a "$LOG_FILE"

# Exit non-zero so CI marks the run failed if anything went wrong
if [ "$REPORT_STATUS" != "ok" ]; then
  exit 1
fi
