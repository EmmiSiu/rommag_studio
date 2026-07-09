# Stage 6 Exit Audit

Fecha: 2026-07-09.

Stage 6 tiene harness y CI versionados, pero sus criterios de salida finales
dependen de controles externos de GitHub.

## Evidencia Local Disponible

- `.github/workflows/ci.yml` ejecuta backend, frontend y build Docker.
- `npm.cmd run lint` valida ESLint frontend *(pasó 2026-07-09)*.
- `npm.cmd run typecheck` valida TypeScript frontend *(pasó 2026-07-09)*.
- `npm.cmd run build` valida build Next.js/Serwist *(pasó 2026-07-09; rerun en solitario tras evitar build concurrente)*.
- `npm.cmd run test:harness` orquesta backend unit/smoke y frontend smoke.
- `npm.cmd run test:playlists` orquesta el smoke colaborativo live de Stage 8
  cuando hay frontend/API activos; sin entorno queda como skip controlado.
- `npm.cmd run prod:readiness` valida readiness local de Stage 7, incluyendo
  scripts backup/restore PostgreSQL/MinIO y checklist de restore/deploy.
- `npm.cmd run test:backend` usó Python temporal en `C:\tmp\rommag-stage6-pytest`
  y ejecutó 29 tests con coverage *(pasó 2026-07-09; warning no bloqueante de
  `.pytest_cache` por permisos)*.
- `testing/reports/` genera evidencia local en JSON/Markdown.

## Criterios de Salida Stage 6

| Criterio | Estado | Evidencia |
|---|---:|---|
| `main` protegida: no se mergea con CI en rojo | Bloqueado externo | Requiere configurar branch protection en GitHub |
| PR de prueba con bug intencional detectado por CI | Bloqueado externo | Requiere abrir PR real y confirmar check rojo |

## Decision

Stage 6 queda avalado localmente, pero no cerrado. Para cerrarlo, un operador
de GitHub debe activar branch protection sobre `main` y registrar un PR de
prueba que falle CI por un bug controlado.
