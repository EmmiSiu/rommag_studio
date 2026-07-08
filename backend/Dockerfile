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
# torch CPU-only primero: el default de PyPI arrastra CUDA (~7GB de librerías
# nvidia) que un worker CPU jamás usa. Ahorro: ~6GB de imagen.
RUN if [ "$INSTALL_AUDIO_DEPS" = "true" ]; then \
        pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu \
        && pip install --no-cache-dir -r requirements-audio.txt; \
    fi

# Código de la aplicación
COPY backend/app ./app
COPY audio_services ./audio_services

# Generar el cliente Prisma. Los binarios del query engine van a una ruta
# global legible por appuser (el default ~/.cache/prisma-python quedaría en
# /root y sería ilegible al cambiar de usuario).
ENV PRISMA_BINARY_CACHE_DIR=/opt/prisma-binaries
RUN prisma generate --schema app/db/schema.prisma \
    && chmod -R a+rX /opt/prisma-binaries

EXPOSE 8000

# Usuario sin privilegios (seguridad: no correr como root)
RUN useradd --create-home appuser && chown -R appuser:appuser /srv
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
