"""Tareas Celery del pipeline de audio.

Pipeline por audio:
    PENDING -> DOWNLOADING -> ENHANCING -> SPATIALIZING -> COMPLETED | FAILED

Cada etapa delega en un módulo de `audio_services/` (Single Responsibility):
    - audio_services.extractor: yt-dlp / lectura de uploads
    - audio_services.enhancement: Demucs, reducción de ruido
    - audio_services.spatial: binaural / Ambisonics

Manejo de errores:
    - Transitorios (red, MinIO): reintento con backoff (max_retries), sin
      marcar FAILED hasta agotar reintentos.
    - Permanentes (video no disponible, formato inválido, error de modelo):
      FAILED inmediato con `errorMessage` legible; no se reintenta.

La tarea es síncrona (Celery); el cliente Prisma es asyncio, por lo que
todo el pipeline corre dentro de un único `asyncio.run` por tarea.
"""

import asyncio
from datetime import UTC, datetime
import logging
import shutil
import tempfile
import uuid
from pathlib import Path

from celery.exceptions import MaxRetriesExceededError
from minio.error import S3Error
from prisma import Json

from app.core.config import settings
from app.db.client import prisma
from app.services.storage import get_storage
from app.workers.celery_app import celery_app

# Solo stdlib en el top-level de estos módulos: seguros de importar desde la API
from audio_services.analysis import musical
from audio_services.enhancement import separator
from audio_services.spatial import binaural as spatial
from audio_services.utils import ffmpeg as ffmpeg_utils

logger = logging.getLogger(__name__)

_ERROR_MESSAGE_MAX = 500


class _TransientError(Exception):
    """Error recuperable (red/almacenamiento): la tarea debe reintentarse."""


class _PermanentError(Exception):
    """Error definitivo: marcar FAILED sin reintentar. El mensaje es apto para el usuario."""


@celery_app.task(name="audio.process", bind=True, max_retries=2)
def process_audio(self, audio_id: str) -> str:
    """Ejecuta el pipeline completo para un audio registrado en la DB.

    Args:
        audio_id: UUID del registro `Audio` a procesar.

    Returns:
        El mismo `audio_id` al completar (para encadenar tareas).
    """
    logger.info("Iniciando pipeline de audio id=%s (intento %s)", audio_id, self.request.retries + 1)
    try:
        asyncio.run(_run_pipeline(audio_id))
    except _TransientError as exc:
        try:
            raise self.retry(exc=exc, countdown=30 * (self.request.retries + 1))
        except MaxRetriesExceededError:
            asyncio.run(_mark_failed(audio_id, f"Error transitorio persistente: {exc}"))
            raise
    return audio_id


# --- Orquestación ----------------------------------------------------------------


async def _run_pipeline(audio_id: str) -> None:
    await prisma.connect()
    workdir = Path(tempfile.mkdtemp(prefix=f"audio-{audio_id[:8]}-"))
    try:
        audio = await prisma.audio.find_unique(where={"id": audio_id})
        if audio is None:
            logger.warning("Audio id=%s ya no existe; se descarta la tarea", audio_id)
            return
        if audio.status == "COMPLETED":
            logger.info("Audio id=%s ya está COMPLETED; tarea idempotente", audio_id)
            return

        try:
            await _execute_stages(audio, workdir)
        except _TransientError:
            raise
        except (S3Error, ConnectionError, TimeoutError) as exc:
            # Red/almacenamiento: dejar que Celery reintente
            raise _TransientError(str(exc)) from exc
        except _PermanentError as exc:
            logger.warning("Pipeline FAILED (permanente) id=%s: %s", audio_id, exc)
            await _mark_failed(audio_id, str(exc))
        except Exception as exc:
            logger.exception("Pipeline FAILED (inesperado) id=%s", audio_id)
            await _mark_failed(audio_id, _friendly_message(exc))
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
        await prisma.disconnect()


async def _execute_stages(audio, workdir: Path) -> None:
    storage = get_storage()
    prefix = f"{audio.ownerId}/{audio.id}"

    # --- 1. DOWNLOADING: obtener el original y normalizar a WAV -------------------
    await _set_status(audio.id, "DOWNLOADING")
    raw_dir = workdir / "raw"
    raw_dir.mkdir(parents=True)

    if audio.sourceType == "YOUTUBE":
        raw_path = _download_from_youtube(audio.sourceUrl, raw_dir)
        original_key = f"{prefix}/original-{uuid.uuid4().hex}{raw_path.suffix}"
        storage.upload_file(raw_path, original_key)
        await prisma.audio.update(where={"id": audio.id}, data={"originalKey": original_key})
    else:
        if not audio.originalKey:
            raise _PermanentError("El audio no tiene archivo original registrado")
        raw_path = storage.download_file(audio.originalKey, raw_dir / "original")

    metadata = ffmpeg_utils.probe_metadata(raw_path)
    duration = metadata["duration_seconds"]
    if duration <= 0:
        raise _PermanentError("No se pudo leer la duración del audio (¿archivo corrupto?)")
    if settings.MAX_AUDIO_DURATION_SECONDS > 0 and duration > settings.MAX_AUDIO_DURATION_SECONDS:
        raise _PermanentError(
            f"El audio dura {duration:.0f}s; el máximo permitido es {settings.MAX_AUDIO_DURATION_SECONDS}s"
        )

    input_wav = ffmpeg_utils.convert_to_wav(raw_path, workdir / "input.wav")
    analysis = musical.analyze_wav(input_wav)
    await prisma.audio.update(
        where={"id": audio.id},
        data={
            "durationSeconds": duration,
            "sampleRate": metadata["sample_rate"] or None,
            "format": audio.format or metadata["format"],
            "bpm": analysis.bpm,
            "musicalKey": analysis.musical_key,
            "energy": analysis.energy,
            "loudnessDb": analysis.loudness_db,
            "analyzedAt": datetime.now(UTC),
        },
    )

    # --- 2. ENHANCING: denoise del mix + separación en stems (Demucs) -------------
    await _set_status(audio.id, "ENHANCING")

    enhanced_path = separator.reduce_noise(input_wav, workdir / "enhanced.wav")
    enhanced_key = f"{prefix}/enhanced-{uuid.uuid4().hex}.wav"
    storage.upload_file(enhanced_path, enhanced_key, "audio/wav")

    # Los stems se separan del WAV original (no del denoised): Demucs rinde
    # mejor sobre señal sin procesar y el ruido residual cae en el stem "other".
    stems = separator.separate_sources(input_wav, workdir / "stems", model=settings.DEMUCS_MODEL)
    stems_keys: dict[str, str] = {}
    for stem_name, stem_path in stems.items():
        stem_key = f"{prefix}/stems/{stem_name}-{uuid.uuid4().hex}.wav"
        storage.upload_file(stem_path, stem_key, "audio/wav")
        stems_keys[stem_name] = stem_key

    await prisma.audio.update(
        where={"id": audio.id},
        data={"enhancedKey": enhanced_key, "stemsKeys": Json(stems_keys)},
    )

    # --- 3. SPATIALIZING: binaural (audífonos) + Ambisonics (altavoces) -----------
    await _set_status(audio.id, "SPATIALIZING")

    binaural_path = spatial.to_binaural(stems, workdir / "binaural.wav")
    spatial_key = f"{prefix}/binaural-{uuid.uuid4().hex}.wav"
    storage.upload_file(binaural_path, spatial_key, "audio/wav")

    ambisonics_path = spatial.to_ambisonics(stems, workdir / "ambisonics.wav")
    ambisonics_key = f"{prefix}/ambisonics-{uuid.uuid4().hex}.wav"
    storage.upload_file(ambisonics_path, ambisonics_key, "audio/wav")

    # --- 4. COMPLETED --------------------------------------------------------------
    await prisma.audio.update(
        where={"id": audio.id},
        data={
            "status": "COMPLETED",
            "errorMessage": None,
            "spatialKey": spatial_key,
            "ambisonicsKey": ambisonics_key,
        },
    )
    logger.info("Pipeline COMPLETED id=%s (%.0fs de audio)", audio.id, duration)


# --- Helpers ---------------------------------------------------------------------


def _download_from_youtube(url: str, output_dir: Path) -> Path:
    """Descarga con yt-dlp traduciendo sus errores a la taxonomía del pipeline."""
    # Import perezoso: yt-dlp solo está instalado en el contenedor worker
    import yt_dlp

    from audio_services.extractor import youtube

    try:
        return youtube.download_audio(url, output_dir)
    except yt_dlp.utils.DownloadError as exc:
        raise _PermanentError(
            "No se pudo descargar el video (privado, eliminado o geo-bloqueado)"
        ) from exc


def _friendly_message(exc: Exception) -> str:
    """Mensaje de error apto para mostrar al usuario (sin stacktraces)."""
    import subprocess

    if isinstance(exc, subprocess.CalledProcessError):
        return "Error convirtiendo el audio (formato no procesable)"
    text = f"Error en el pipeline ({type(exc).__name__}): {exc}"
    return text[:_ERROR_MESSAGE_MAX]


async def _set_status(audio_id: str, status: str) -> None:
    await prisma.audio.update(where={"id": audio_id}, data={"status": status})
    logger.info("Audio id=%s -> %s", audio_id, status)


async def _mark_failed(audio_id: str, message: str) -> None:
    """Marca FAILED con mensaje legible. Conexión propia: se llama también fuera del pipeline."""
    connected = prisma.is_connected()
    if not connected:
        await prisma.connect()
    try:
        await prisma.audio.update(
            where={"id": audio_id},
            data={"status": "FAILED", "errorMessage": message[:_ERROR_MESSAGE_MAX]},
        )
    finally:
        if not connected:
            await prisma.disconnect()
