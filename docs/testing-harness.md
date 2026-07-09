# Testing Harness Architecture

Los harness viven en `testing/` y generan reportes reproducibles en
`testing/reports/`.

```mermaid
flowchart TB
    root["npm scripts raiz"]
    backend["testing/backend/harness.mjs"]
    frontend["testing/frontend/harness.mjs"]
    production["testing/production/harness.mjs"]
    playlists["frontend collaboration mode"]
    all["testing/run-all.mjs"]
    reports[("testing/reports\nJSON + Markdown")]

    root --> backend
    root --> frontend
    root --> production
    root --> playlists
    root --> all
    all --> backend
    all --> frontend
    backend --> reports
    frontend --> reports
    playlists --> frontend
    production --> reports
```

## Backend Harness

```mermaid
flowchart LR
    unit["unit\npytest + coverage"]
    smoke["smoke\n/api/v1/health"]
    load["load\n25 concurrent health checks"]
    pipeline["pipeline\nDemucs benchmark checklist"]

    unit --> report["backend report"]
    smoke --> report
    load --> report
    pipeline --> report
```

## Frontend Harness

```mermaid
flowchart LR
    lint["lint"]
    typecheck["typecheck"]
    build["production build"]
    browser["browser smoke\nconsole, images, 375px"]
    lighthouse["Lighthouse\nPWA/performance"]
    collaboration["collaboration\ncreate, invite, edit, revoke"]

    lint --> report["frontend report"]
    typecheck --> report
    build --> report
    browser --> report
    lighthouse --> report
    collaboration --> report
```

`node testing/frontend/harness.mjs collaboration` runs only with a live frontend
and API. Without `FRONTEND_URL` plus `BACKEND_URL`/`API_URL`, it records a
controlled skip instead of pretending Stage 8 was verified.

## Production Readiness Harness

```mermaid
flowchart LR
    runbook["Easypanel runbook"]
    env["production env template"]
    backups["backup/restore scripts"]
    restore["restore/deploy checklist"]
    compose["compose exposure checks"]
    ci["CI PR coverage"]

    runbook --> report["production readiness report"]
    env --> report
    backups --> report
    restore --> report
    compose --> report
    ci --> report
```
