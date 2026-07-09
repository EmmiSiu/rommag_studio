#!/usr/bin/env sh
set -eu

: "${MINIO_BUCKET_AUDIO:=audios}"
: "${BACKUP_DIR:=/backups/minio}"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/${MINIO_BUCKET_AUDIO}_${stamp}"

docker compose exec -T minio mc mirror --overwrite "local/${MINIO_BUCKET_AUDIO}" "$target"

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name "${MINIO_BUCKET_AUDIO}_*" -mtime +30 -exec rm -rf {} +
printf '%s\n' "$target"
