#!/usr/bin/env bash
set -euo pipefail

# Restore Postgres from pg_dump custom format.
# Usage: BACKUP_FILE=db-YYYYMMDD-HHMMSS.dump ./deploy/restore.sh
# Requires env: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE BACKUP_FILE

if [ -z "${BACKUP_FILE:-}" ]; then
  echo "Set BACKUP_FILE to a pg_dump file"
  exit 1
fi

echo "[*] Restoring $BACKUP_FILE ..."
pg_restore --clean --if-exists --no-owner --dbname="$PGDATABASE" "$BACKUP_FILE"
echo "[+] Done."

