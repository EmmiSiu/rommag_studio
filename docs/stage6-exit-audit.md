# Stage 6 Exit Audit

Fecha: 2026-07-08.

Stage 6 tiene harness y CI versionados, pero sus criterios de salida finales
dependen de controles externos de GitHub.

## Evidencia Local Disponible

- `.github/workflows/ci.yml` ejecuta backend, frontend y build Docker.
- `npm.cmd run lint` valida ESLint frontend.
- `npm.cmd run typecheck` valida TypeScript frontend.
- `npm.cmd run build` valida build Next.js/Serwist.
- `npm.cmd run test:harness` orquesta backend unit/smoke y frontend smoke.
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
