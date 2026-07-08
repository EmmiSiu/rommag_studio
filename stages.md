# 🗺️ STAGES.md — Roadmap a Producción

> Documento de seguimiento del proyecto **Audio Inmersivo**: de esqueleto a producción.
> Cada stage tiene sprints con checklists medibles y **criterios de salida** (Definition of Done).
> Marca `[x]` al completar cada ítem. No avanzar de stage sin cumplir los criterios de salida.

**Leyenda de estado:** 🟢 Completado · 🟡 En progreso · ⚪ Pendiente

| Stage | Nombre | Estado |
|-------|--------|--------|
| 0 | Fundaciones (scaffold) | 🟢 |
| 1 | Backend core | ✅ |
| 2 | Pipeline de audio | 🟡 |
| 3 | Frontend funcional | 🟡 |
| 4 | Admin y moderación | 🟡 |
| 5 | PWA y experiencia móvil | 🟡 |
| 6 | Calidad: testing y CI/CD | 🟡 |
| 7 | Producción (Easypanel) | ⚪ |

---

## Stage 0 — Fundaciones 🟢

**Objetivo:** estructura del monorepo, contenedores y esqueleto funcional.

- [x] Estructura de carpetas SOLID (frontend / backend / audio_services / infra)
- [x] docker-compose.yml con 6 servicios y healthchecks
- [x] .env.example completo
- [x] schema.prisma (User, Audio, Role, Visibility, AudioStatus, SourceType)
- [x] FastAPI con auth JWT (registro, login, /me) y endpoints de audios
- [x] Celery + Redis configurados (tarea `audio.process` stub)
- [x] Landing page Next.js 15 + manifest PWA
- [x] Repositorio Git inicializado y publicado

---

## Stage 1 — Backend core ⚪

**Objetivo:** API completa y estable sobre datos reales; todo lo que no es procesamiento de audio.

### Sprint 1.1 — Base de datos operativa

- [x] Primera migración Prisma generada y aplicada (`20260708153108_init`)
- [x] Script de seed: crea el SUPERADMIN desde `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` (idempotente)
- [ ] `docker compose up` levanta todo el stack sin errores desde cero
- [x] Bucket `audios` de MinIO creado automáticamente al arrancar el backend

### Sprint 1.2 — Ingesta por subida de archivos

- [x] `POST /api/v1/audios/upload` con `UploadFile`
- [x] Validación de extensión contra `ALLOWED_AUDIO_FORMATS` **y** de contenido real (magic bytes, no solo extensión)
- [x] Límite de tamaño `MAX_UPLOAD_SIZE_MB` aplicado por streaming (no cargar todo en RAM)
- [x] Subida a MinIO como `originalKey` y encolado de `audio.process`
- [x] Nombres de objeto generados por el servidor (UUID), nunca el filename del usuario

### Sprint 1.3 — Auth completa

- [x] `POST /auth/refresh` (rotación de refresh token)
- [x] Recuperación de contraseña (token de un solo uso; email puede quedar en log en dev)
- [x] Rate limiting en `/auth/login` y `/auth/register` (slowapi o Redis)
- [x] Revocación: campo `tokenVersion` en User o denylist en Redis

### Sprint 1.4 — API de audios completa

- [x] `GET /audios/{id}/stream` → URL prefirmada de MinIO (con `?variant=` binaural/ambisonics/enhanced/original)
- [x] `DELETE /audios/{id}` (dueño o superadmin; borra también objetos de MinIO, incluidos stems)
- [x] `PATCH /audios/{id}` (título, visibility)
- [x] `GET /audios/{id}/status` para polling de progreso desde el frontend
- [x] `GET /audios/{id}/stems` → URLs prefirmadas por stem (contrato del reproductor 3D)

**Criterios de salida Stage 1:**
- [x] Flujo completo por API (curl/Postman): registro → login → subir archivo → ver en biblioteca privada *(verificado 2026-07-08)*
- [x] Ninguna credencial ni secreto hardcodeado (auditado con `git grep`)
- [x] Documentación OpenAPI (`/docs`) coherente: 16 rutas documentadas

---

## Stage 2 — Pipeline de audio ⚪

**Objetivo:** el worker procesa audio de verdad, de URL/archivo a audio 3D descargable.

### Sprint 2.1 — Extracción y normalización

- [x] `audio.process` actualiza `Audio.status` en cada etapa (DB desde el worker)
- [x] Descarga de YouTube con yt-dlp (`audio_services/extractor/youtube.py`) funcionando
- [x] Normalización a WAV con FFmpeg + metadatos (duración, sample rate) guardados en DB
- [x] Manejo de errores: video privado/geo-bloqueado/eliminado → `FAILED` con `errorMessage` claro
- [x] Límite `MAX_AUDIO_DURATION_SECONDS` aplicado antes de procesar (0 = sin límite)

### Sprint 2.2 — Mejora con IA

- [x] Separación de fuentes con Demucs (`htdemucs`, configurable vía `DEMUCS_MODEL`) implementada
- [x] Reducción de ruido (noisereduce conservador, `prop_decrease=0.5`)
- [x] Resultado subido a MinIO como `enhancedKey`; stems subidos como `stemsKeys` (JSON)
- [ ] Caché de modelos en volumen `model_cache` verificada (segunda ejecución no re-descarga)
- [ ] Medir tiempos/RAM por pista de 4 min y documentarlos aquí: ____ min / ____ GB

### Sprint 2.3 — Espacialización 3D

- [x] Render binaural con spaudiopy (stems posicionados en el campo sonoro + HRTF)
- [x] Codificación Ambisonics (orden 1, formato AmbiX) → `ambisonicsKey`
- [x] Evaluación de USAT: ¿se integra o se descarta? Decisión documentada: **descartado en v1** (no está en PyPI; FOA + binaural se resuelven con spaudiopy y codificación AmbiX propia — ver nota al pie)
- [x] Resultado final subido como `spatialKey`, status `COMPLETED`

### Sprint 2.4 — Robustez del pipeline

- [x] Reintentos solo en errores transitorios (red, MinIO); fallos permanentes no reintentan
- [x] Limpieza de archivos temporales del worker (incluso en fallo — `finally`)
- [x] Timeout por tarea validado (`task_time_limit=1800`)
- [ ] Prueba de carga: 5 audios encolados a la vez, ninguno se pierde ni corrompe

**Criterios de salida Stage 2:**
- [ ] URL de YouTube → audio binaural escuchable con auriculares en < 15 min (pista de 4 min, CPU)
- [ ] Archivo subido → mismo resultado
- [ ] Un fallo de pipeline deja registro claro (`errorMessage`) y no tumba el worker

> **📌 Decisiones de arquitectura (Stage 2 — julio 2026):**
> 1. **Contrato de stems (WASM-ready):** los stems de Demucs se persisten individualmente
>    en MinIO (`Audio.stemsKeys` JSON + `GET /audios/{id}/stems`). Motivo: habilitar el
>    futuro reproductor 3D interactivo con espacialización **en el cliente** (Rust→WASM
>    en AudioWorklet, convolución HRTF en vivo). El servidor separa; el navegador posiciona.
>    El render binaural/Ambisonics de servidor se mantiene para descarga y compatibilidad.
> 2. **Orden del enhancement:** denoise (noisereduce, conservador) sobre el mix normalizado
>    → `enhancedKey`; Demucs corre sobre el WAV **sin** denoise (rinde mejor con señal
>    cruda; el ruido residual cae en el stem `other`). Revisar con métricas reales.
> 3. **USAT descartado en v1:** no está en PyPI; binaural por convolución HRIR (spaudiopy)
>    y FOA AmbiX (ACN/SN3D) codificado manualmente cubren el alcance actual.
> 4. **Staging de la escena:** vocals al frente (0°±15°), bass centrado (0°±5°), drums
>    detrás (180°±40°), other abierto (0°±70°) — tabla `STEM_STAGING` en
>    `audio_services/spatial/binaural.py`, pendiente de ajuste por escucha.

---

## Stage 3 — Frontend funcional ⚪

**Objetivo:** un usuario real puede usar toda la plataforma desde el navegador.

### Sprint 3.1 — Auth UI

- [x] Páginas `/register` y `/login` con validación de formularios
- [x] Manejo de sesión (access token solo en memoria + refresh en localStorage con rotación; cookie ligera `ai_session` sin token para el middleware)
- [x] Rutas protegidas (middleware de Next.js) y logout
- [x] Estados de error legibles (credenciales inválidas, cuenta desactivada, rate limit)

### Sprint 3.2 — Ingesta y progreso

- [x] Página "Nuevo audio": tab URL de YouTube / tab subir archivo (drag & drop)
- [x] Barra de progreso de subida (XHR con `upload.onprogress`)
- [x] Vista de estado del pipeline en vivo (polling a `/status`): Descargando → Mejorando → Espacializando
- [x] Notificación al completar o fallar

### Sprint 3.3 — Biblioteca y reproductor

- [x] Biblioteca privada y pública con paginación
- [x] Reproductor de audio (streaming desde URL prefirmada, selector de variante binaural/mejorado/original)
- [x] Descarga del resultado (binaural / Ambisonics / stems individuales)
- [x] Cambiar visibilidad y eliminar audios propios

**Criterios de salida Stage 3:**
- [ ] Flujo E2E completo sin tocar la API a mano
- [ ] Sin errores en consola del navegador en el flujo feliz
- [ ] Usable en viewport móvil (375px)

---

## Stage 4 — Admin y moderación ⚪

### Sprint 4.1 — Panel superadmin

- [x] Dashboard `/studio/admin` (solo SUPERADMIN, verificado en backend en cada endpoint, no solo UI)
- [x] Gestión de usuarios: listar, activar/desactivar, cambiar rol, eliminar
- [x] Cola de moderación: aprobar/rechazar audios públicos (`isApproved`) con pre-escucha
- [x] Métricas básicas: nº usuarios, audios por estado, cola de moderación (almacenamiento: proxy de duración acumulada; bytes exactos pendiente)

### Sprint 4.2 — Endpoints de admin

- [x] `PATCH /users/{id}` y `DELETE /users/{id}` (con `require_superadmin`; borra también objetos MinIO; anti-lockout: un admin no puede degradarse a sí mismo)
- [x] `PATCH /audios/{id}/moderate` (aprobar/rechazar con motivo; rechazo → vuelve a PRIVATE) + `GET /audios/moderation/queue`
- [x] Auditoría mínima: logger `audit.admin` con email del admin, acción y objetivo
- [x] `GET /admin/metrics` (usuarios, audios por estado, cola de moderación)

**Criterios de salida Stage 4:**
- [ ] Un audio PUBLIC no aparece en la biblioteca pública hasta ser aprobado
- [ ] Un USER no puede acceder a ningún endpoint/página de admin (probado)

---

## Stage 5 — PWA y experiencia móvil ⚪

### Sprint 5.1 — PWA instalable

- [x] Iconos PNG 192/512 + `apple-touch-icon` 180 (generados del diseño del SVG)
- [x] Service worker con Serwist (`@serwist/next`): precache del shell + estrategias por defecto; audios excluidos (URLs prefirmadas). Solo activo en producción
- [ ] Instalable en Android (Chrome) e iOS (Safari "Añadir a pantalla de inicio") — probado en dispositivo real *(requiere HTTPS + dispositivo: pendiente de Stage 7)*
- [x] Página offline de cortesía (`/offline`, fallback de navegación del SW)

### Sprint 5.2 — Pulido móvil

- [x] Reproductor usable con pantalla bloqueada (Media Session API: metadata, play/pausa y seek nativos)
- [ ] Subida de archivos desde el picker móvil funciona (UI ajustada a `<label>` nativo; falta prueba en dispositivo real)
- [ ] Lighthouse PWA ≥ 90

**Criterios de salida Stage 5:**
- [ ] App instalada y flujo completo ejecutado en un Android y un iPhone reales

---

## Stage 6 — Calidad: testing y CI/CD ⚪

### Sprint 6.1 — Tests backend

- [ ] pytest configurado con DB de test (fixtures)
- [ ] Tests de auth (registro, login, token expirado, roles)
- [ ] Tests de permisos de audios (dueño/público/privado/admin)
- [x] Tests unitarios de validación de subidas (magic bytes, sanitización) — 19 tests en `backend/tests/`; ffmpeg probe pendiente
- [ ] Cobertura ≥ 70% en `app/` (excluyendo workers pesados)

### Sprint 6.2 — Tests frontend

- [x] `npm run typecheck` y `lint` sin errores (ESLint CLI + `tsc --noEmit`, verificado 2026-07-08)
- [ ] Tests de componentes críticos (auth forms, uploader) con Vitest/Testing Library
- [ ] Un test E2E del flujo feliz con Playwright (contra stack de compose)

### Sprint 6.3 — CI/CD (GitHub Actions)

- [x] Workflow CI: lint + typecheck + build frontend, compileall + pytest backend en cada PR (`.github/workflows/ci.yml`)
- [x] Build de imagen Docker backend en CI (valida Dockerfile + prisma generate)
- [x] Badge de CI en README
- [ ] (Opcional) push de imágenes a GHCR con tag por commit

**Criterios de salida Stage 6:**
- [ ] `main` protegida: no se mergea con CI en rojo
- [ ] Un PR de prueba con un bug intencional es detectado por CI

---

## Stage 7 — Producción (Easypanel) ⚪

> Guía operativa detallada en `pguide.md` (no versionado).

### Sprint 7.1 — Despliegue inicial

- [ ] VPS aprovisionado (mín. 4GB RAM / 2 vCPU / 20GB, recomendado 8GB para Demucs)
- [ ] Easypanel instalado y proyecto creado desde este repo (ver pguide.md)
- [ ] Grupo de variables de entorno compartidas configurado (secretos generados nuevos, NO los de dev)
- [ ] Servicios desplegados: frontend, backend, worker, postgres, redis, minio
- [ ] Migraciones aplicadas y superadmin seedeado

### Sprint 7.2 — Dominio y seguridad

- [ ] Dominio apuntado + HTTPS (Let's Encrypt vía Easypanel/Traefik)
- [ ] PostgreSQL y Redis SIN puertos públicos (verificado con escaneo externo)
- [ ] MinIO Console (9001) no expuesta públicamente o detrás de auth
- [ ] CORS_ORIGINS restringido al dominio real
- [ ] `/docs` deshabilitado en producción (APP_ENV=production)
- [ ] Contraseñas de servicio rotadas y guardadas en un gestor de contraseñas

### Sprint 7.3 — Backups y observabilidad

- [ ] Backup diario de PostgreSQL (cron con `pg_dump`) con retención 7/30 días
- [ ] Backup periódico del volumen de MinIO
- [ ] Restauración PROBADA (un backup sin prueba de restore no es backup)
- [ ] Logs centralizados visibles en Easypanel; alerta básica de disco lleno
- [ ] Healthchecks/uptime monitor externo (p. ej. UptimeRobot) sobre `/api/v1/health`

### Sprint 7.4 — Operación continua

- [ ] Procedimiento de actualización documentado y probado (deploy desde Git sin downtime perceptible)
- [ ] Límite de disco monitoreado (audios + modelos crecen rápido)
- [ ] Política de retención de audios FAILED (limpieza automática)
- [ ] Prueba con 3–5 usuarios reales y feedback registrado como issues

**Criterios de salida Stage 7 (= EN PRODUCCIÓN):**
- [ ] Usuario externo se registra, procesa un audio y lo escucha en su móvil vía HTTPS
- [ ] Backup restaurado con éxito en un entorno limpio
- [ ] Una semana de operación sin intervención manual

---

## 📈 Métricas de progreso

| Métrica | Valor actual | Objetivo |
|---------|--------------|----------|
| Stages completados | 1/8 | 8/8 |
| Flujo E2E funcional | No | Sí |
| Cobertura de tests backend | 0% | ≥ 70% |
| Lighthouse PWA | — | ≥ 90 |
| Tiempo pipeline (pista 4 min, CPU) | — | < 15 min |

> Actualiza esta tabla al cerrar cada stage. Registra decisiones importantes
> (modelos elegidos, trade-offs) como notas al pie del stage correspondiente.
