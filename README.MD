# 🎵 Audio Inmersivo - Plataforma de Mejora y Espacialización de Audio con IA

> **Plataforma local auto-alojada para mejorar audio con IA y convertirlo a 3D/inmersivo**

## 🎯 Visión del Proyecto

Audio Inmersivo es una plataforma de código abierto diseñada para mejorar la calidad de audio de cualquier fuente (YouTube o archivos locales) utilizando modelos de IA de vanguardia, y convertirlo a formatos de sonido espacial (binaural, Ambisonics) para una experiencia inmersiva.

### ¿Por qué existe este proyecto?

- **Democratización del audio espacial**: Herramientas profesionales como Dolby Atmos son costosas y complejas
- **Mejora accesible con IA**: Cualquier usuario puede limpiar ruido, separar instrumentos y mejorar calidad
- **Uso local y privado**: Sin dependencia de servicios cloud, sin límites de uso, sin costos recurrentes
- **Comunidad y colaboración**: Biblioteca pública para compartir mejoras y experimentos

## ✨ Features Actuales

### Para Usuarios

- **Autenticación segura**: Registro, login, recuperación de contraseña
- **Dos tipos de entrada**:
  - URL de YouTube (extrae audio automáticamente)
  - Subida de archivos (mp3, wav, flac, m4a, ogg, aac, etc.)
- **Mejora con IA**:
  - Reducción de ruido (Demucs, HiFi-GAN)
  - Separación de fuentes (voces, instrumentos, bajo, batería)
  - Ecualización automática
- **Conversión a 3D**:
  - Binaural (headphones)
  - Ambisonics (altavoces)
  - Formato espacial inmersivo
- **Biblioteca dual**:
  - Espacio público: compartido con la comunidad
  - Espacio privado: solo accesible para el usuario
- **PWA móvil**: Instalable en iOS y Android, funciona offline

### Para Superadmin

- **Gestión de usuarios**: Crear, editar, eliminar, cambiar roles
- **Moderación de contenido**: Aprobar/rechazar submissions públicas
- **Métricas del sistema**: Uso de CPU/GPU, cola de procesamiento, almacenamiento
- **Configuración global**: Límites de archivos, modelos de IA activos, cuotas

## 🚀 Roadmap (Features Futuros)

- [ ] **Mix automático**: Transición suave entre canciones (crossfade, beat-matching)
- [ ] **Playlists colaborativas**: Usuarios pueden crear y compartir playlists
- [ ] **DJ mode**: Mezcla en tiempo real con controles de EQ, filtros, efectos
- [ ] **Recomendaciones IA**: Sugerir siguientes canciones basadas en BPM, tono, energía
- [ ] **Visualizaciones 3D**: Three.js + WebAudio para visualización espacial
- [ ] **Stems separados**: Descargar pistas individuales (voz, bajo, batería, otros)
- [ ] **API pública**: Para integraciones externas
- [ ] **Plugins de IA**: Cargar modelos personalizados de la comunidad
- [ ] **Exportación profesional**: Dolby Atmos, DTS:X, Ambisonics de alto orden
- [ ] **Social features**: Likes, comentarios, seguir usuarios, notifications

## 🏗️ Arquitectura

┌─────────────────────┐
│ Frontend (Next.js)│
│ PWA + NextAuth │
└─────────┬───────────┘
│ REST API
┌─────────▼───────────┐
│ Backend (FastAPI) │
│ Auth + API + Jobs │
└─────────┬───────────┘
│
┌──────▼───────┐
│ Celery Workers │
└──────┬───────┘
│
┌──────▼───────────────┐
│ Audio Services │
│ yt-dlp, FFmpeg, │
│ Demucs, spaudiopy │
└──────────────────────┘
│
┌──────▼───────┐
│ PostgreSQL │
│ MinIO (S3) │
└──────────────┘

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS, PWA |
| Backend | FastAPI, Python 3.12+, Prisma ORM |
| Base de datos | PostgreSQL 16 |
| Caché/Queue | Redis 7, Celery |
| Almacenamiento | MinIO (S3-compatible) |
| Audio IA | Demucs, HiFi-GAN, Noise Reduction |
| Audio 3D | spaudiopy, SPARTA, USAT |
| YouTube | yt-dlp, FFmpeg |
| Auth | NextAuth.js, JWT |
| Contenedores | Docker, Docker Compose |

## 📁 Estructura del Proyecto

```text
audio-inmersivo/
├── docker-compose.yml        # Orquestación: frontend, backend, worker, postgres, redis, minio
├── .env.example              # Variables de entorno (copiar a .env)
├── package.json              # Scripts de orquestación (setup, up, db:migrate...)
├── README.md                 # Este archivo
│
├── frontend/                 # Next.js 15 + React 19 + Tailwind v4 + PWA
│   ├── app/                  # App Router (layout.tsx, page.tsx, globals.css)
│   ├── public/               # manifest.json, icons/
│   ├── Dockerfile            # Build multi-stage (standalone)
│   └── package.json
│
├── backend/                  # FastAPI + Prisma + Celery
│   ├── app/
│   │   ├── api/              # deps.py (auth) + v1/endpoints (health, auth, audios, users)
│   │   ├── core/             # config.py (env tipado), security.py (bcrypt, JWT)
│   │   ├── db/               # schema.prisma + client.py (singleton)
│   │   ├── schemas/          # Contratos Pydantic (user.py, audio.py)
│   │   ├── services/         # Lógica de negocio (storage.py → MinIO)
│   │   ├── workers/          # celery_app.py + tasks/audio_tasks.py
│   │   └── main.py           # Factory de la app FastAPI
│   ├── Dockerfile            # Imagen API y worker (arg INSTALL_AUDIO_DEPS)
│   ├── requirements.txt      # Dependencias base (API)
│   └── requirements-audio.txt# Dependencias pesadas de IA (solo worker)
│
├── audio_services/           # Procesamiento puro (sin DB ni API)
│   ├── extractor/            # youtube.py (yt-dlp)
│   ├── enhancement/          # separator.py (Demucs, reducción de ruido)
│   ├── spatial/              # binaural.py (spaudiopy, Ambisonics)
│   └── utils/                # ffmpeg.py (conversión, metadatos)
│
└── infra/                    # Configuración de servicios de respaldo
    └── postgres/init/        # SQL de primer arranque (extensiones)
```

## 🚀 Instalación y Despliegue

### Requisitos

- Docker y Docker Compose
- VPS con al menos 4GB RAM, 2 CPU cores, 20GB storage
- Easypanel (opcional, para gestión visual)

### Pasos

1. **Clonar repositorio**

```bash
git clone https://github.com/tu-usuario/audio-inmersivo.git
cd audio-inmersivo
```

1. **Configurar variables**

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

1. **Levantar servicios**

```bash
docker-compose up -d
```

1. **Iniciar bases de datos**

```bash
npm run db:migrate
# equivale a: docker compose exec backend prisma migrate deploy --schema app/db/schema.prisma
```

1. **Acceder**

- Frontend: `http://tu-vps-ip:3000`
- Backend API: `http://tu-vps-ip:8000`
- MinIO Console: `http://tu-vps-ip:9001`

### Easypanel

1. Importar `docker-compose.yml` como proyecto
2. Configurar variables de entorno en el dashboard
3. Mapear puertos y volúmenes
4. Deploy automático con Git

## 🔐 Seguridad

- Autenticación JWT con refresh tokens
- Validación de archivos (tipo, tamaño, malware)
- Rate limiting en endpoints críticos
- Sanitización de inputs (XSS, SQL injection)
- Aislamiento de contenedores
- HTTPS obligatorio (Let's Encrypt)

## 📝 Licencia

MIT License - Uso libre, personal y educativo. No se permite uso comercial sin autorización.

## 🤝 Contribuciones

¡Bienvenidas! Mira los issues abiertos y envía tu PR.

## 📞 Contacto

- Autor: Luis Emiliano Romero Magallanes
- GitHub: [EmmiSiu]
- Instagram: [emmisiu_21_]

---

**Hecho con ❤️ para la comunidad del audio inmersivo**
