"""Tareas Celery del pipeline de audio.

Pipeline por audio:
    PENDING -> DOWNLOADING -> ENHANCING -> SPATIALIZING -> COMPLETED | FAILED

Cada etapa delega en un módulo de `audio_services/` (Single Responsibility):
    - audio_services.extractor: yt-dlp / lectura de uploads
    - audio_services.enhancement: Demucs, reducción de ruido
    - audio_services.spatial: binaural / Ambisonics (spaudiopy)
"""

import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="audio.process", bind=True, max_retries=2)
def process_audio(self, audio_id: str) -> str:
    """Ejecuta el pipeline completo para un audio registrado en la DB.

    Args:
        audio_id: UUID del registro `Audio` a procesar.

    Returns:
        El mismo `audio_id` al completar (para encadenar tareas).
    """
    logger.info("Iniciando pipeline de audio id=%s", audio_id)

    # TODO(pipeline): implementar cada etapa actualizando Audio.status en la DB:
    #   1. Marcar DOWNLOADING; si sourceType=YOUTUBE, extraer con
    #      audio_services.extractor.youtube.download_audio(); si UPLOAD,
    #      descargar originalKey desde MinIO (app.services.storage).
    #   2. Marcar ENHANCING; aplicar audio_services.enhancement (Demucs /
    #      reducción de ruido) y subir resultado como enhancedKey.
    #   3. Marcar SPATIALIZING; aplicar audio_services.spatial (binaural /
    #      Ambisonics) y subir resultado como spatialKey.
    #   4. Marcar COMPLETED con metadatos (duración, sample rate, formato).
    #   En cualquier excepción: marcar FAILED con errorMessage y re-lanzar
    #   (self.retry) solo para errores transitorios (red, MinIO).

    logger.info("Pipeline pendiente de implementación para id=%s", audio_id)
    return audio_id
