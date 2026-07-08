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
# torch CPU-only en su propia capa (es lo más pesado; así los cambios en
# requirements-audio.txt no lo re-descargan). El default de PyPI arrastra
# ~7GB de librerías CUDA que un worker CPU jamás usa.
RUN if [ "$INSTALL_AUDIO_DEPS" = "true" ]; then \
        pip install --no-cache-dir torch torchaudio torchcodec --index-url https://download.pytorch.org/whl/cpu; \
    fi
# Los HRIRs por defecto de spaudiopy se generan AQUÍ (escriben en
# site-packages, que en runtime es solo-lectura para appuser).
RUN if [ "$INSTALL_AUDIO_DEPS" = "true" ]; then \
        pip install --no-cache-dir -r requirements-audio.txt \
        && python -c "from spaudiopy.io import get_default_hrirs; get_default_hrirs()"; \
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
RUN useradd --create-home appuser && chown -R appuser:appuser /srv \
    # Pre-crear ~/.cache con dueño correcto: el volumen model_cache hereda
    # esta propiedad en su primer montaje (si no, nace root y torch no escribe)
    && mkdir -p /home/appuser/.cache && chown appuser:appuser /home/appuser/.cache
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
