# Easypanel Production Runbook

This runbook is versioned so production work does not depend on private chat
history or local-only notes.

## Minimum Target

- VPS: 4 GB RAM, 2 vCPU, 20 GB disk minimum.
- Recommended for Demucs: 8 GB RAM, 4 vCPU, 60 GB disk.
- Public HTTPS domains:
  - App: `https://audio.example.com`
  - API: `https://api.audio.example.com`
  - Media: `https://media.audio.example.com`

## Import

1. Create an Easypanel project from this repository.
2. Use `docker-compose.yml` as the service definition.
3. Create persistent volumes for PostgreSQL, Redis, MinIO and `model_cache`.
4. Configure variables from `infra/easypanel/env.production.example`.
5. Generate fresh production secrets. Never reuse `.env` development values.

## Exposure Rules

- Frontend is public through HTTPS.
- Backend is public through HTTPS only.
- PostgreSQL and Redis must not expose public ports.
- MinIO API can be exposed through the media domain for presigned URLs.
- MinIO Console should stay private or behind Easypanel authentication.

## First Deploy

1. Deploy PostgreSQL, Redis and MinIO.
2. Deploy backend and worker.
3. Run migrations:

```bash
docker compose exec backend prisma migrate deploy --schema app/db/schema.prisma
```

4. Seed the first superadmin:

```bash
docker compose exec backend python -m app.scripts.seed
```

5. Deploy frontend with `NEXT_PUBLIC_API_URL` pointing to the API HTTPS domain.

## Verification

Run local repository checks before deployment:

```bash
npm.cmd run prod:readiness
```

Run live checks after deployment:

```powershell
$env:BACKEND_URL='https://api.audio.example.com'
node testing/backend/harness.mjs smoke
node testing/backend/harness.mjs load
```

```powershell
$env:FRONTEND_URL='https://audio.example.com'
node testing/frontend/harness.mjs smoke
node testing/frontend/harness.mjs perf
```

## Backup Policy

- PostgreSQL: daily dump, 7 daily and 4 weekly copies.
- MinIO: daily mirror or volume snapshot.
- Restore test: required before Stage 7 can close.

Use the scripts in `infra/ops/` as the baseline. Adapt paths/secrets in the
server environment, not in git.

## Restore Drill

Run this drill after the first production backup and before considering Stage 7
closed:

1. Create a clean Easypanel project or temporary VPS with empty PostgreSQL and
   MinIO volumes.
2. Copy one PostgreSQL dump and one MinIO mirror into paths visible to the
   relevant containers.
3. Run `infra/ops/restore-postgres.sh /path/to/backup.sql.gz`.
4. Run `infra/ops/restore-minio.sh /path/to/minio-backup-dir`.
5. Deploy backend, worker and frontend from the same git commit.
6. Verify `/api/v1/health`, login, private library, public library and one
   restored playlist.

## Deploy Checklist

- CI green on the commit being deployed.
- Production env group points `NEXT_PUBLIC_API_URL`, `CORS_ORIGINS` and
  `MINIO_PUBLIC_ENDPOINT` to HTTPS domains.
- PostgreSQL and Redis have no public ports.
- MinIO Console is private or behind Easypanel auth.
- `npm.cmd run prod:readiness` is green locally before deploy.
