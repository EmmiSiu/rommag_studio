# Context Capsule

Fecha de referencia: 2026-07-08.

Audio Inmersivo es una plataforma auto-alojada para ingestar audio desde
YouTube o archivos locales, mejorarlo con IA y publicar renders binaurales,
Ambisonics y stems. El repo ya contiene frontend Next.js 15, backend FastAPI,
Prisma/PostgreSQL, Redis/Celery, MinIO y servicios de audio.

## Estado Actual

- Stage 0 y Stage 1 estan funcionales.
- Stage 2 tiene pipeline implementado, pero faltan pruebas pesadas reales:
  cache de modelos, benchmark de 4 minutos y carga de 5 audios.
- Stage 3, 4, 5 y 6 estan en progreso con UI, PWA, admin y CI basicos.
- Stage 7 requiere ambiente externo: dominio, HTTPS, Easypanel, backups.

## Reglas de Trabajo

- No cambiar APIs publicas sin actualizar README, OpenAPI y stages.
- Los features futuros se planifican por sprint antes de implementarse.
- Cada sprint debe terminar con harness o prueba reproducible.
- La landing publica no debe usar emojis; los iconos son componentes o assets.
- Los assets de marca de raiz (`LOGO-BIG.svg`, `LOGO-BIG.ico`) estan integrados en `frontend/public/brand/` y `frontend/app/favicon.ico`.

## Comandos Clave

```text
npm run test:backend
npm run test:frontend
npm run test:harness
npm run perf:frontend
npm run perf:pipeline
```
