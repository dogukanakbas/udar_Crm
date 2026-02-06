#!/usr/bin/env bash
set -euo pipefail

# Simple Postgres dump + media/static tar.
# Requires env: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE BACKUP_DIR

TS=$(date +%Y%m%d-%H%M%S)
DIR=${BACKUP_DIR:-/backups}
mkdir -p "$DIR"

echo "[*] Dumping Postgres..."
pg_dump --format=custom --file="$DIR/db-$TS.dump" "$PGDATABASE"

echo "[*] Archiving media/static (if present)..."
if [ -d "./backend/media" ]; then
  tar -czf "$DIR/media-$TS.tgz" -C backend media
fi
if [ -d "./backend/staticfiles" ]; then
  tar -czf "$DIR/static-$TS.tgz" -C backend staticfiles
fi

echo "[+] Done: $DIR/db-$TS.dump"

