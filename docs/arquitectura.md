# Arquitectura Funcional

Este documento resume la arquitectura viva de Audio Inmersivo para desarrollo,
testing y despliegue. El sistema separa UI, API, cola, almacenamiento y
procesamiento pesado para mantener cada módulo reemplazable y testeable.

```mermaid
flowchart TB
    user["Usuario web o PWA"]
    frontend["Frontend Next.js\nApp Router, PWA, Media Session"]
    api["Backend FastAPI\nAuth, audios, admin, OpenAPI"]
    worker["Worker Celery\nPipeline de audio"]
    postgres[("PostgreSQL\nUsuarios, audios, estados")]
    redis[("Redis\nBroker y resultados Celery")]
    minio[("MinIO\nOriginales, stems, renders")]

    subgraph audio["audio_services"]
        extractor["Extractor\nyt-dlp"]
        ffmpeg["FFmpeg utils\nprobe, normalize"]
        enhance["Enhancement\nDemucs, denoise"]
        spatial["Spatial\nbinaural, Ambisonics"]
    end

    user --> frontend
    frontend --> api
    api --> postgres
    api --> minio
    api --> redis
    redis --> worker
    worker --> postgres
    worker --> minio
    worker --> extractor
    worker --> ffmpeg
    worker --> enhance
    worker --> spatial
```

## Contratos Principales

```mermaid
flowchart LR
    auth["Auth\naccess en memoria\nrefresh rotado"]
    audio["Audio API\nupload, youtube, status, stream"]
    admin["Admin API\nusers, moderation, metrics"]
    storage["Storage\nkeys UUID y URLs prefirmadas"]

    auth --> audio
    auth --> admin
    audio --> storage
    admin --> storage
```

## Estados del Pipeline

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> DOWNLOADING
    DOWNLOADING --> ENHANCING
    ENHANCING --> SPATIALIZING
    SPATIALIZING --> COMPLETED
    DOWNLOADING --> FAILED
    ENHANCING --> FAILED
    SPATIALIZING --> FAILED
    FAILED --> [*]
    COMPLETED --> [*]
```
