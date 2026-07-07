# =============================================================================
# Audio Inmersivo - Imagen del backend (API) y del worker (Celery).
# Contexto de build: la RAÍZ del repo (para incluir audio_services/):
#   docker build -f backend/Dockerfile .
# El worker se construye con --build-arg INSTALL_AUDIO_DEPS=true
# =============================================================================

FROM python:3.12-slim AS base

# FFmpeg es requerido por yt-dlp, demucs y las utilidades de conversión
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# Dependencias primero (aprovecha la caché de capas de Docker)
COPY backend/requirements.txt backend/requirements-audio.txt ./
RUN pip install --no-cache-dir -r requirements.txt

ARG INSTALL_AUDIO_DEPS=false
RUN if [ "$INSTALL_AUDIO_DEPS" = "true" ]; then \
        pip install --no-cache-dir -r requirements-audio.txt; \
    fi

# Código de la aplicación
COPY backend/app ./app
COPY audio_services ./audio_services

# Generar el cliente Prisma
RUN prisma generate --schema app/db/schema.prisma

EXPOSE 8000

# Usuario sin privilegios (seguridad: no correr como root)
RUN useradd --create-home appuser && chown -R appuser:appuser /srv
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
