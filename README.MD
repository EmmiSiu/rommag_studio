<div align="center">

# 🎵 Audio Inmersivo

**Plataforma auto-alojada para mejorar audio con IA y convertirlo a 3D inmersivo**

[![Next.js](https://img.shields.io/badge/Next.js_15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React_19-087EA4?logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python_3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis_7-FF4438?logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

*YouTube o archivo local → mejora con IA (Demucs) → audio 3D binaural/Ambisonics → tu biblioteca*

</div>

---

## 📑 Tabla de Contenidos

- [Visión del Proyecto](#-visión-del-proyecto)
- [¿Cómo funciona?](#-cómo-funciona)
- [Features](#-features)
- [Arquitectura](#️-arquitectura)
- [Pipeline de Audio](#-pipeline-de-audio)
- [Modelo de Datos](#-modelo-de-datos)
- [Stack Tecnológico](#️-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Despliegue](#-instalación-y-despliegue)
- [Roadmap](#-roadmap)
- [Seguridad](#-seguridad)

---

## 🎯 Visión del Proyecto

Audio Inmersivo es una plataforma de código abierto diseñada para mejorar la calidad de audio de cualquier fuente (YouTube o archivos locales) utilizando modelos de IA de vanguardia, y convertirlo a formatos de sonido espacial (binaural, Ambisonics) para una experiencia inmersiva.

### ¿Por qué existe este proyecto?

| | |
|---|---|
| 🎛️ **Democratización del audio espacial** | Herramientas profesionales como Dolby Atmos son costosas y complejas |
| 🤖 **Mejora accesible con IA** | Cualquier usuario puede limpiar ruido, separar instrumentos y mejorar calidad |
| 🔒 **Uso local y privado** | Sin dependencia de servicios cloud, sin límites de uso, sin costos recurrentes |
| 🤝 **Comunidad y colaboración** | Biblioteca pública para compartir mejoras y experimentos |

---

## ⚡ ¿Cómo funciona?

```mermaid
flowchart LR
    A["🎬 URL de YouTube<br/>o 📁 archivo de audio"] --> B["🤖 Mejora con IA<br/>ruido · separación de fuentes"]
    B --> C["🎧 Espacialización 3D<br/>binaural · Ambisonics"]
    C --> D["📚 Tu biblioteca<br/>privada o pública"]

    style A fill:#1e293b,stroke:#38bdf8,color:#e2e8f0
    style B fill:#1e293b,stroke:#a78bfa,color:#e2e8f0
    style C fill:#1e293b,stroke:#f472b6,color:#e2e8f0
    style D fill:#1e293b,stroke:#4ade80,color:#e2e8f0
```

---

## ✨ Features

### Para Usuarios

- 🔐 **Autenticación segura**: registro, login, JWT con refresh tokens
- 🎬 **Dos tipos de entrada**:
  - URL de YouTube (extrae audio automáticamente con yt-dlp)
  - Subida de archivos (mp3, wav, flac, m4a, ogg, aac, etc.)
- 🤖 **Mejora con IA**:
  - Reducción de ruido
  - Separación de fuentes con Demucs (voces, instrumentos, bajo, batería)
- 🎧 **Conversión a 3D**:
  - Binaural (audífonos)
  - Ambisonics (altavoces)
- 📚 **Biblioteca dual**: espacio público moderado + espacio privado
- 📱 **PWA móvil**: instalable en iOS y Android

### Para Superadmin

- 👥 **Gestión de usuarios**: crear, editar, desactivar, cambiar roles
- ✅ **Moderación de contenido**: aprobar/rechazar submissions públicas
- 📊 **Métricas del sistema**: cola de procesamiento, almacenamiento, usuarios

---

## 🏗️ Arquitectura

Seis servicios independientes orquestados con Docker Compose. PostgreSQL, Redis y MinIO viven **solo en la red interna**; únicamente el frontend, la API y MinIO exponen puertos.

```mermaid
flowchart TB
    subgraph Cliente
        U["👤 Usuario<br/>(navegador / PWA móvil)"]
    end

    subgraph Docker["🐳 Red interna Docker (audio-net)"]
        F["🖥️ Frontend<br/>Next.js 15 + React 19<br/>:3000"]
        B["⚙️ Backend API<br/>FastAPI + Prisma<br/>:8000"]
        W["🔄 Worker Celery<br/>procesamiento pesado"]

        subgraph Datos["Servicios de respaldo (sin puertos públicos)"]
            P[("🐘 PostgreSQL 16<br/>usuarios y audios")]
            R[("⚡ Redis 7<br/>cola de tareas")]
            M[("📦 MinIO<br/>archivos de audio<br/>:9000/:9001")]
        end

        subgraph IA["🧠 audio_services (módulos puros)"]
            YT["yt-dlp<br/>extracción"]
            FF["FFmpeg<br/>conversión"]
            DM["Demucs<br/>separación IA"]
            SP["spaudiopy<br/>binaural · Ambisonics"]
        end
    end

    U -->|HTTPS| F
    F -->|REST API| B
    B --> P
    B -->|encola tarea| R
    B -->|URLs prefirmadas| M
    R -->|entrega tarea| W
    W --> P
    W --> M
    W --> YT & FF & DM & SP

    style U fill:#0f172a,stroke:#38bdf8,color:#e2e8f0
    style F fill:#1e293b,stroke:#38bdf8,color:#e2e8f0
    style B fill:#1e293b,stroke:#4ade80,color:#e2e8f0
    style W fill:#1e293b,stroke:#a78bfa,color:#e2e8f0
    style P fill:#0f172a,stroke:#60a5fa,color:#e2e8f0
    style R fill:#0f172a,stroke:#f87171,color:#e2e8f0
    style M fill:#0f172a,stroke:#fbbf24,color:#e2e8f0
```

### Flujo de una petición de procesamiento

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant F as Frontend
    participant B as Backend (FastAPI)
    participant R as Redis
    participant W as Worker (Celery)
    participant M as MinIO

    U->>F: Pega URL de YouTube
    F->>B: POST /api/v1/audios/youtube (JWT)
    B->>B: Valida URL (solo dominios de YouTube)
    B->>R: Encola tarea audio.process
    B-->>F: 202 Accepted (audio en PENDING)
    R->>W: Entrega la tarea
    W->>W: yt-dlp → FFmpeg → Demucs → spaudiopy
    W->>M: Sube original, mejorado y espacializado
    W->>B: Actualiza status → COMPLETED
    F->>B: Polling GET /audios/{id}/status
    B->>M: Genera URL prefirmada
    B-->>F: URL de streaming
    F-->>U: 🎧 Reproduce audio 3D
```

---

## 🔄 Pipeline de Audio

Cada audio avanza por una máquina de estados registrada en la base de datos (`AudioStatus`):

```mermaid
stateDiagram-v2
    [*] --> PENDING: Usuario registra audio
    PENDING --> DOWNLOADING: Worker toma la tarea
    DOWNLOADING --> ENHANCING: Audio extraído y normalizado (WAV)
    ENHANCING --> SPATIALIZING: IA aplicada (Demucs + denoise)
    SPATIALIZING --> COMPLETED: Render 3D subido a MinIO
    DOWNLOADING --> FAILED: Video no disponible / error
    ENHANCING --> FAILED: Error del modelo
    SPATIALIZING --> FAILED: Error de render
    COMPLETED --> [*]
    FAILED --> [*]: errorMessage registrado

    note right of ENHANCING
        Demucs separa voces, batería,
        bajo e instrumentos
    end note
    note right of SPATIALIZING
        Binaural (HRTF) para audífonos
        Ambisonics para altavoces
    end note
```

---

## 🗃️ Modelo de Datos

```mermaid
erDiagram
    USER ||--o{ AUDIO : "posee"

    USER {
        uuid id PK
        string email UK
        string passwordHash
        string displayName
        Role role "USER | SUPERADMIN"
        boolean isActive
        datetime createdAt
    }

    AUDIO {
        uuid id PK
        string title
        uuid ownerId FK
        SourceType sourceType "YOUTUBE | UPLOAD"
        string sourceUrl "nullable"
        AudioStatus status "PENDING → ... → COMPLETED"
        string originalKey "objeto MinIO"
        string enhancedKey "objeto MinIO"
        string spatialKey "render binaural"
        string ambisonicsKey "render AmbiX orden 1"
        json stemsKeys "stems Demucs (reproductor 3D)"
        float durationSeconds
        Visibility visibility "PUBLIC | PRIVATE"
        boolean isApproved "moderación"
        datetime createdAt
    }
```

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Rol |
|------|------------|-----|
| 🖥️ Frontend | Next.js 15 · React 19 · Tailwind CSS v4 | App Router, PWA instalable |
| ⚙️ Backend | FastAPI · Python 3.12+ · Prisma ORM | API REST tipada, OpenAPI |
| 🐘 Base de datos | PostgreSQL 16 | Usuarios, audios, estados |
| ⚡ Caché/Queue | Redis 7 · Celery | Cola de procesamiento asíncrono |
| 📦 Almacenamiento | MinIO (S3-compatible) | Archivos de audio, URLs prefirmadas |
| 🤖 Audio IA | Demucs · noisereduce | Separación de fuentes, limpieza |
| 🎧 Audio 3D | spaudiopy · USAT | Binaural (HRTF), Ambisonics |
| 🎬 Extracción | yt-dlp · FFmpeg | YouTube, conversión de formatos |
| 🔐 Auth | JWT (access + refresh) · bcrypt | Sesiones seguras |
| 🐳 Contenedores | Docker · Docker Compose | 6 servicios aislados |

---

## 📁 Estructura del Proyecto

```text
audio-inmersivo/
├── docker-compose.yml        # Orquestación: frontend, backend, worker, postgres, redis, minio
├── .env.example              # Variables de entorno (copiar a .env)
├── package.json              # Scripts de orquestación (setup, up, db:migrate...)
├── stages.md                 # 🗺️ Roadmap medible a producción
│
├── frontend/                 # Next.js 15 + React 19 + Tailwind v4 + PWA
│   ├── app/                  # App Router (layout.tsx, page.tsx, globals.css)
│   ├── public/               # manifest.json, icons/
│   └── Dockerfile            # Build multi-stage (standalone)
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

---

## 🚀 Instalación y Despliegue

### Requisitos

- Docker y Docker Compose
- VPS con al menos **4GB RAM, 2 CPU cores, 20GB storage** (8GB RAM recomendado para Demucs)
- Easypanel (opcional, para gestión visual)

### Pasos

```bash
# 1. Clonar repositorio
git clone https://github.com/EmmiSiu/rommag_studio.git
cd rommag_studio

# 2. Configurar variables (crea .env desde .env.example)
npm run setup
#    → edita .env con tus credenciales

# 3. Levantar servicios
docker compose up -d --build

# 4. Aplicar migraciones
npm run db:migrate
```

| Servicio | URL local |
|----------|-----------|
| 🖥️ Frontend | `http://localhost:3000` |
| ⚙️ Backend API (docs) | `http://localhost:8000/docs` |
| 📦 MinIO Console | `http://localhost:9001` |

### Easypanel (producción)

1. Importar `docker-compose.yml` como proyecto
2. Configurar el grupo de variables de entorno en el dashboard
3. Mapear dominios y volúmenes persistentes
4. Deploy automático con Git

---

## 🗺️ Roadmap

El progreso detallado con checklists por sprint vive en **[stages.md](stages.md)**:

```mermaid
timeline
    title De esqueleto a producción
    Stage 0 : Fundaciones ✅ : scaffold, Docker, esquema DB
    Stage 1-2 : Backend core : pipeline de audio real (yt-dlp, Demucs, 3D)
    Stage 3-4 : Frontend : biblioteca, reproductor, panel admin
    Stage 5-6 : PWA móvil : testing y CI/CD
    Stage 7 : Producción 🚀 : Easypanel, HTTPS, backups
```

**Features futuros:** mix automático con beat-matching · playlists colaborativas · DJ mode · recomendaciones IA · visualizaciones 3D (Three.js + WebAudio) · stems descargables · API pública · exportación Dolby Atmos / DTS:X · social features

---

## 🔐 Seguridad

- 🔑 Autenticación JWT con refresh tokens y hashing bcrypt
- 🧪 Validación de archivos (tipo, tamaño) y de URLs (solo dominios de YouTube — anti-SSRF)
- 🚦 Rate limiting en endpoints críticos
- 🧹 Sanitización de inputs (XSS, SQL injection vía Prisma)
- 🐳 Aislamiento de contenedores: DB y Redis sin puertos públicos, procesos sin root
- 🔒 HTTPS obligatorio en producción (Let's Encrypt)

---

## 📝 Licencia

MIT License — ver [LICENSE](LICENSE).

## 🤝 Contribuciones

¡Bienvenidas! Mira los issues abiertos y envía tu PR.

## 📞 Contacto

- **Autor:** Luis Emiliano Romero Magallanes
- **GitHub:** [EmmiSiu](https://github.com/EmmiSiu)
- **Instagram:** [emmisiu_21_](https://instagram.com/emmisiu_21_)

---

<div align="center">

**Hecho con ❤️ para la comunidad del audio inmersivo**

</div>
