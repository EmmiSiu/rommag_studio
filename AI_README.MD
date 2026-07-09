# AI_README.MD - Guia Operativa para Agentes

Este archivo es la guia de contexto para cualquier agente que continue el
desarrollo de Audio Inmersivo. Antes de implementar, lee este documento junto
con `docs/context-capsule.md`, `stages.md`, `README.md` y los archivos del
modulo que vayas a tocar.

Fecha de referencia: 2026-07-08.

## Objetivo del Proyecto

Audio Inmersivo es una plataforma auto-alojada para subir o ingestar audio,
mejorarlo con IA, separar stems y generar renders espaciales. El stack actual
incluye:

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, PWA con Serwist.
- Backend: FastAPI, Prisma Python, PostgreSQL, Redis/Celery y MinIO.
- Audio services: yt-dlp, FFmpeg, Demucs y pipeline espacial.
- Testing harness: scripts Node en `testing/` con reportes Markdown/JSON.

No asumas que librerias como NextAuth, React Query o Storybook ya existen en el
repo. Si una feature necesita una dependencia nueva, justificala, instalala en
el workspace correcto y actualiza documentacion y scripts.

## Lectura Inicial Obligatoria

1. `docs/context-capsule.md`: estado actual y reglas de continuidad.
2. `stages.md`: sprints completados, pendientes y criterios por modulo.
3. `README.md`: vision publica, setup y features.
4. `docs/testing-harness.md` y `testing/README.md`: pruebas reproducibles.
5. Codigo cercano al cambio: sigue patrones existentes antes de crear nuevos.

## Scripts Canonicos

Ejecuta los scripts desde la raiz del repo salvo que se indique lo contrario.
En Windows usa `npm.cmd` cuando el shell lo requiera.

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:backend
npm.cmd run test:frontend
npm.cmd run test:stage9
npm.cmd run test:stage10
npm.cmd run test:playlists
npm.cmd run test:harness
npm.cmd run perf:pipeline
npm.cmd run prod:readiness
```

### Frontend

```bash
npm.cmd --prefix frontend run dev -- --hostname 127.0.0.1 --port 3000
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run start -- --hostname 127.0.0.1 --port 3000
```

`npm.cmd run test:frontend` ejecuta lint, typecheck y build. Si `FRONTEND_URL`
esta definido, tambien corre smoke de navegador con Playwright en viewport
mobile de 375px, valida consola limpia, imagenes cargadas y ausencia de
overflow horizontal.

`npm.cmd run test:stage9` ejecuta el harness del reproductor 3D interactivo
cuando `FRONTEND_URL` esta definido. Mockea auth, metadata, `/stems` y WAVs
cortos; verifica decodificacion WebAudio, play/pausa, canvas Three.js no vacio
y layout mobile de 375px.

`npm.cmd run test:stage10` extiende el mismo flujo mockeado y activa Audio 8D;
verifica movimiento orbital del canvas/panners sin errores de consola.

`npm.cmd run test:playlists` ejecuta el harness colaborativo de Stage 8. Si
`FRONTEND_URL` y `BACKEND_URL`/`API_URL` estan definidos, crea usuarios efimeros
en un stack de desarrollo y verifica crear playlist, invitar colaborador,
cambiar rol y revocar acceso. Sin entorno live queda como skip documentado.

```powershell
$env:FRONTEND_URL='http://127.0.0.1:3000'
node testing/frontend/harness.mjs smoke
node testing/frontend/harness.mjs perf
```

`perf` usa Lighthouse y exige estos umbrales iniciales:

- Performance >= 80
- Accessibility >= 90
- Best Practices >= 90
- PWA >= 90 cuando Lighthouse entregue la categoria

Instala navegadores solo si Playwright lo pide:

```bash
npx.cmd playwright install chromium
```

### Backend

```bash
npm.cmd run test:backend
node testing/backend/harness.mjs unit
node testing/backend/harness.mjs smoke
node testing/backend/harness.mjs load
node testing/backend/harness.mjs pipeline
```

`test:backend` corre el modo `unit`. El harness busca Python automaticamente y
usa `backend/requirements-dev.txt`; si falta `pytest-cov`, cae a pytest plano y
marca coverage como skip controlado.

Para smoke/load real, define una API activa:

```powershell
$env:BACKEND_URL='http://127.0.0.1:8000'
node testing/backend/harness.mjs smoke
node testing/backend/harness.mjs load
```

`npm.cmd run perf:pipeline` valida readiness del pipeline y deja el benchmark
pesado de Demucs como prueba manual documentada. Tambien ejecuta fixtures WAV
cortos para el analisis musical de Stage 10.1 (BPM/key). Cuando se ejecute ese
benchmark real, registra RAM, duracion y resultado en `stages.md`.

Para backfill de analisis musical en audios existentes:

```bash
python -m app.scripts.analyze_existing_audio
python -m app.scripts.analyze_existing_audio --force
```

### Harness Completo

```bash
npm.cmd run test:harness
```

Ejecuta:

- Backend unit.
- Backend smoke con skip si no hay `BACKEND_URL`/`API_URL`.
- Frontend smoke con skip de navegador si no hay `FRONTEND_URL`.

Los reportes se generan en `testing/reports/`. Solo deben versionarse
`testing/reports/.gitkeep` y `testing/reports/README.md`; los reportes locales
quedan ignorados por `.gitignore`.

## Criterios Antes de Commit

Para cualquier cambio de codigo:

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:harness
npm.cmd run test:stage9
npm.cmd run test:stage10
npm.cmd run test:playlists
```

Para cambios de landing, UI, imagenes, PWA o performance:

```powershell
$env:FRONTEND_URL='http://127.0.0.1:3000'
node testing/frontend/harness.mjs smoke
node testing/frontend/harness.mjs perf
```

Para cambios de audio/pipeline:

```bash
npm.cmd run perf:pipeline
```

Para cambios de produccion, Easypanel, backups o seguridad operacional:

```bash
npm.cmd run prod:readiness
```

Para cambios backend con servicio activo:

```powershell
$env:BACKEND_URL='http://127.0.0.1:8000'
node testing/backend/harness.mjs smoke
node testing/backend/harness.mjs load
```

Si una prueba queda en skip, explica por que. No presentes un modulo como listo
si su prueba clave no se ejecuto o si falta ambiente externo.

## Reglas de Landing, Marca y UI

- No uses emojis en UI. Usa `lucide-react`, imagenes reales o componentes
  propios.
- El logo fuente vive en la raiz como `LOGO-BIG.svg` y `LOGO-BIG.ico`.
- El logo contiene una letra `R` blanca en el centro; necesita fondo oscuro para
  verse correctamente. Nunca lo coloques sobre fondos blancos o claros.
- Mantener copias integradas:
  - `frontend/public/brand/logo-big.svg`
  - `frontend/app/favicon.ico`
- Para elementos pequenos o above-the-fold, prioriza assets ligeros como
  `/icons/icon-192.png` si el SVG grande afecta LCP. Conserva el SVG para marca
  fuente, usos grandes y superficies oscuras.
- Cada imagen visible debe cargar con `naturalWidth > 0` en smoke de navegador.
- La landing debe conservar calidad premium: hero fuerte, producto visible,
  narrativa clara, CTA funcional, mobile 375px sin overflow y consola limpia.

## Reglas de Arquitectura

- Frontend no accede directo a DB; siempre usa API/backend.
- Backend responde JSON y no contiene UI.
- MinIO guarda archivos; PostgreSQL guarda metadatos; Redis coordina cache/colas.
- No cambies APIs publicas sin actualizar README, docs, OpenAPI cuando aplique y
  `stages.md`.
- Los features futuros se planifican primero en `stages.md`; no implementes
  features grandes fuera del sprint activo sin dejar criterios de prueba.
- Mantener PWA y mobile como requisitos de primera clase.

## Flujo de Trabajo del Agente

1. Revisa `git status --short` antes de tocar archivos.
2. Lee el stage/sprint relevante en `stages.md`.
3. Implementa cambios pequenos y coherentes con el codigo existente.
4. Actualiza docs y Mermaid en `docs/` si cambia arquitectura, flujo o testing.
5. Agrega o ajusta harness/scripts cuando una feature necesite verificacion
   reproducible.
6. Corre las pruebas apropiadas.
7. Resume resultados con comandos y cualquier skip real.
8. Si el usuario pidio subir a `main`, stagea, commitea y pushea solo despues de
   validar.

## Stages y Documentacion

Al cerrar trabajo de sprint:

- Marca avance en `stages.md` con fecha, criterio y evidencia.
- Si agregas features nuevos, ubicalos en el stage correcto antes de
  implementarlos.
- Mantén diagramas Mermaid actualizados en `docs/` para arquitectura, flujos,
  roadmap y harness.
- Usa `docs/context-capsule.md` para dejar continuidad a futuros agentes.

## Dependencias y Entornos

- Frontend dependencies: `frontend/package.json`.
- Backend runtime dependencies: `backend/requirements.txt`.
- Backend dev/test dependencies: `backend/requirements-dev.txt`.
- No instales dependencias globales salvo necesidad justificada.
- No versionar `.env`, `.env.local`, caches, `.next`, reportes generados ni
  binarios de audio/modelos.

## Comandos de Docker

```bash
npm.cmd run setup
npm.cmd run dev
npm.cmd run up
npm.cmd run down
npm.cmd run logs
npm.cmd run db:migrate
npm.cmd run db:seed
```

PostgreSQL y Redis deben permanecer internos en produccion. MinIO expone API y
consola solo segun despliegue. Para Easypanel, configurar variables compartidas,
volumenes persistentes, backups de PostgreSQL y respaldo periodico de MinIO.

## Checklist Rapido por Feature

- Codigo implementado y tipado.
- Estados de carga/error incluidos cuando aplica.
- UI responsive y accesible.
- Sin emojis visibles en UI.
- Tests o harness reproducible agregado/actualizado.
- `stages.md` y docs actualizados.
- `npm.cmd run lint` pasa.
- `npm.cmd run typecheck` pasa.
- `npm.cmd run build` pasa.
- `npm.cmd run test:harness` pasa o skips justificados.
- `npm.cmd run test:playlists` pasa o skip live justificado si toca playlists.
- `npm.cmd run test:stage9` pasa o skip justificado si toca reproductor 3D.
- `npm.cmd run test:stage10` pasa o skip justificado si toca Audio 8D.
- Smoke/perf frontend ejecutado si toca landing/UI/PWA.
- Smoke/load backend ejecutado si toca API activa.

## Notas de Seguridad

- Secrets solo en variables de entorno.
- JWT y auth deben mantenerse compatibles con el backend actual.
- No exponer DB/Redis publicamente.
- Validar inputs en frontend y backend.
- No registrar tokens, URLs presignadas sensibles ni contrasenas.
- Mantener CORS explicito en produccion.
