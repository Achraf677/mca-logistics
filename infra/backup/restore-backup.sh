#!/usr/bin/env bash
# MCA Logistics - Restore an encrypted backup
#
# Usage:
#   ./restore-backup.sh <YYYY-MM-DD> [--prefix daily|weekly|monthly]
#                                    [--target-db postgresql://...]
#                                    [--storage-only] [--db-only]
#                                    [--yes]
#
# By default this script REFUSES to restore into the production DB.
# Set TARGET_DB explicitly (or pass --target-db) and confirm with --yes.

set -Eeuo pipefail

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
DATE_ARG="${1:-}"
if [ -z "$DATE_ARG" ] || [[ ! "$DATE_ARG" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  cat >&2 <<EOF
usage: $0 <YYYY-MM-DD> [--prefix daily|weekly|monthly]
                       [--target-db <postgres-url>]
                       [--storage-only] [--db-only] [--yes]
EOF
  exit 1
fi
shift

PREFIX="daily"
TARGET_DB=""
DO_DB=1
DO_STORAGE=1
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --prefix)      PREFIX="$2"; shift 2 ;;
    --target-db)   TARGET_DB="$2"; shift 2 ;;
    --storage-only) DO_DB=0; shift ;;
    --db-only)      DO_STORAGE=0; shift ;;
    --yes)          ASSUME_YES=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Required env
# ---------------------------------------------------------------------------
REQUIRED_VARS=(
  R2_ACCOUNT_ID
  R2_ACCESS_KEY
  R2_SECRET_KEY
  R2_BUCKET
)
missing=()
for v in "${REQUIRED_VARS[@]}"; do
  [ -z "${!v:-}" ] && missing+=("$v")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "FATAL: missing env vars: ${missing[*]}" >&2
  exit 2
fi

# Need a destination DB url (never default to prod)
if [ "$DO_DB" = "1" ]; then
  TARGET_DB="${TARGET_DB:-${TARGET_DB_URL:-}}"
  if [ -z "$TARGET_DB" ]; then
    echo "FATAL: no --target-db / TARGET_DB_URL set." >&2
    echo "       Refusing to guess. Use a TEST project, never prod." >&2
    exit 2
  fi
  if echo "$TARGET_DB" | grep -qiE '(prod|production)'; then
    echo "REFUSING: target DB url contains 'prod'." >&2
    exit 2
  fi
fi

# Need a storage destination if restoring storage
if [ "$DO_STORAGE" = "1" ]; then
  if [ -z "${TARGET_SUPABASE_PROJECT_REF:-}" ] || \
     [ -z "${TARGET_SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    echo "WARN: TARGET_SUPABASE_PROJECT_REF / TARGET_SUPABASE_SERVICE_ROLE_KEY not set." >&2
    echo "      Storage files will be extracted locally only (no re-upload)." >&2
  fi
fi

# ---------------------------------------------------------------------------
# Tooling
# ---------------------------------------------------------------------------
need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; exit 3; }; }
need aws
need gpg
need tar
need pg_restore
need curl
need jq

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_KEY"
export AWS_DEFAULT_REGION="auto"
export AWS_EC2_METADATA_DISABLED=true
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
aws_r2() { aws --endpoint-url "$R2_ENDPOINT" "$@"; }

# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------
echo
echo "===================== RESTORE PLAN ====================="
echo "  date     : $DATE_ARG"
echo "  prefix   : $PREFIX"
echo "  source   : s3://${R2_BUCKET}/${PREFIX}/"
[ "$DO_DB"      = "1" ] && echo "  -> DB     : $TARGET_DB"
[ "$DO_STORAGE" = "1" ] && echo "  -> Storage: ${TARGET_SUPABASE_PROJECT_REF:-<local extract only>}"
echo "========================================================"
echo

if [ "$ASSUME_YES" != "1" ]; then
  read -r -p "Type RESTORE to continue: " ans
  [ "$ans" = "RESTORE" ] || { echo "aborted"; exit 1; }
fi

# ---------------------------------------------------------------------------
# Locate the backup file for that date
# ---------------------------------------------------------------------------
WORK_DIR="$(mktemp -d -t mca-restore-XXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "[*] Looking up backup for $DATE_ARG in ${PREFIX}/..."
KEY=$(aws_r2 s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "${PREFIX}/" --output json \
      | jq -r --arg d "${DATE_ARG//-/}" \
          '.Contents // [] | map(select(.Key | contains($d))) | sort_by(.LastModified) | last | .Key // empty')

if [ -z "$KEY" ]; then
  echo "FATAL: no backup found for ${DATE_ARG} in ${PREFIX}/" >&2
  exit 4
fi
echo "    found: $KEY"

ENCRYPTED="${WORK_DIR}/$(basename "$KEY")"
aws_r2 s3 cp "s3://${R2_BUCKET}/${KEY}" "$ENCRYPTED" --only-show-errors

# ---------------------------------------------------------------------------
# Decrypt (uses the GPG private key from the operator's keyring)
# ---------------------------------------------------------------------------
ARCHIVE="${ENCRYPTED%.gpg}"
echo "[*] Decrypting (will prompt for GPG passphrase if needed)..."
gpg --decrypt --output "$ARCHIVE" "$ENCRYPTED"

# ---------------------------------------------------------------------------
# Extract
# ---------------------------------------------------------------------------
EXTRACT="${WORK_DIR}/extract"
mkdir -p "$EXTRACT"
tar -xf "$ARCHIVE" -C "$EXTRACT"
echo "[*] Extracted to $EXTRACT"

# ---------------------------------------------------------------------------
# Restore DB
# ---------------------------------------------------------------------------
if [ "$DO_DB" = "1" ]; then
  DUMP="${EXTRACT}/db.dump"
  if [ ! -f "$DUMP" ]; then
    echo "FATAL: db.dump not in archive" >&2
    exit 5
  fi
  echo "[*] pg_restore --clean --if-exists --no-owner --no-privileges ..."
  pg_restore --clean --if-exists --no-owner --no-privileges \
    --dbname="$TARGET_DB" "$DUMP"
fi

# ---------------------------------------------------------------------------
# Restore Storage (re-upload via service_role to the target project)
# ---------------------------------------------------------------------------
if [ "$DO_STORAGE" = "1" ] && [ -n "${TARGET_SUPABASE_PROJECT_REF:-}" ]; then
  STORAGE_DIR="${EXTRACT}/storage"
  API="https://${TARGET_SUPABASE_PROJECT_REF}.supabase.co"
  AUTH="Authorization: Bearer ${TARGET_SUPABASE_SERVICE_ROLE_KEY}"
  KEY_HDR="apikey: ${TARGET_SUPABASE_SERVICE_ROLE_KEY}"

  if [ -f "${STORAGE_DIR}/_buckets.json" ]; then
    jq -c '.[]' "${STORAGE_DIR}/_buckets.json" | while read -r b; do
      name=$(echo "$b" | jq -r '.name')
      public=$(echo "$b" | jq -r '.public // false')
      curl -fsS -X POST -H "$AUTH" -H "$KEY_HDR" -H "Content-Type: application/json" \
        -d "$(jq -nc --arg n "$name" --argjson p "$public" '{id:$n,name:$n,public:$p}')" \
        "${API}/storage/v1/bucket" >/dev/null || true
    done
  fi

  find "$STORAGE_DIR" -mindepth 2 -type f | while IFS= read -r f; do
    rel="${f#${STORAGE_DIR}/}"
    bucket="${rel%%/*}"
    object="${rel#*/}"
    [ "$bucket" = "_buckets.json" ] && continue
    echo "    upload ${bucket}/${object}"
    curl -fsS -X POST -H "$AUTH" -H "$KEY_HDR" \
      -H "x-upsert: true" \
      --data-binary "@${f}" \
      "${API}/storage/v1/object/${bucket}/${object}" >/dev/null \
      || echo "      WARN: upload failed for ${bucket}/${object}" >&2
  done
fi

echo "[+] Restore complete."
