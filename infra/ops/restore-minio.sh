#!/usr/bin/env sh
set -eu

: "${MINIO_BUCKET_AUDIO:=audios}"

backup_dir="${1:-}"
if [ -z "$backup_dir" ] || [ ! -d "$backup_dir" ]; then
  echo "Usage: infra/ops/restore-minio.sh /path/inside/minio-container/to/backup-dir" >&2
  exit 2
fi

docker compose exec -T minio mc mirror --overwrite --remove "$backup_dir" "local/${MINIO_BUCKET_AUDIO}"
