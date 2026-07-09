# Production Readiness

Stage 7 depends on real infrastructure, but the repository now contains the
operational assets needed to deploy, verify and recover the system.

```mermaid
flowchart TB
    repo["Repository main"]
    easy["Easypanel project"]
    env["Production env group"]
    services["Frontend, Backend, Worker"]
    data["Postgres, Redis, MinIO"]
    backups["Backup scripts"]
    monitors["Health and uptime checks"]

    repo --> easy
    env --> easy
    easy --> services
    easy --> data
    data --> backups
    services --> monitors
    monitors -->|"BACKEND_URL / FRONTEND_URL"| harness["testing harness"]
```

## Local Readiness

```bash
npm.cmd run prod:readiness
```

The harness checks:

- Easypanel runbook and production env template exist.
- PostgreSQL and MinIO backup/restore scripts exist.
- PostgreSQL and Redis remain private in compose.
- Demucs model cache is persisted.
- `/docs` is disabled outside development.
- CI still covers PR backend/frontend checks.
- Restore and deploy drills are documented for the operator.

## Restore Drill

Before Stage 7 can close, run a restore in a clean environment:

1. Restore PostgreSQL with `infra/ops/restore-postgres.sh`.
2. Restore MinIO with `infra/ops/restore-minio.sh`.
3. Start backend and worker, then verify `/api/v1/health`.
4. Log in as the seeded superadmin and confirm existing audios/playlists are
   visible.
5. Run live smoke checks with `BACKEND_URL` and `FRONTEND_URL`.

## External Gates

These gates must be completed on the production VPS before Stage 7 can close:

- HTTPS domain for frontend, API and media.
- Branch protection and green CI for deployments.
- Successful external user flow on mobile.
- Restore test from PostgreSQL and MinIO backup.
- One week of operation without manual intervention.
