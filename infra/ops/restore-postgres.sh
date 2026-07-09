#!/usr/bin/env sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

backup_file="${1:-}"
if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
  echo "Usage: infra/ops/restore-postgres.sh /path/to/backup.sql.gz" >&2
  exit 2
fi

gzip -dc "$backup_file" | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
