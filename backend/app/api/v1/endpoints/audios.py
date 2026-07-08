"""Endpoints de audios: ingesta (YouTube/upload), biblioteca y gestión.

Los endpoints solo validan y delegan: la ingesta encola tareas Celery
(`app/workers/tasks/audio_tasks.py`) y el trabajo pesado ocurre en el worker.
El acceso a MinIO (síncrono) siempre pasa por run_in_threadpool para no
bloquear el event loop.
"""

import logging
import tempfile
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user, require_superadmin
from app.core.config import settings
from app.db.client import prisma
from app.schemas.audio import (
    AudioCreateFromYouTube,
    AudioPublic,
    AudioStatusOut,
    AudioUpdate,
    ModerationDecision,
    StemsOut,
    StreamURL,
)
from app.services.storage import get_storage
from app.services.upload_validation import sanitize_title, sniff_audio_format
from app.workers.tasks.audio_tasks import process_audio
from prisma.models import Audio, User

router = APIRouter()
audit_logger = logging.getLogger("audit.admin")

UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MiB


# --- Helpers -------------------------------------------------------------------

async def _get_audio_or_404(audio_id: str) -> Audio:
    audio = await prisma.audio.find_unique(where={"id": audio_id})
    if audio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Audio no encontrado")
    return audio


def _can_read(audio: Audio, user: User) -> bool:
    is_owner = audio.ownerId == user.id
    is_public = audio.visibility == "PUBLIC" and audio.isApproved
    return is_owner or is_public or user.role == "SUPERADMIN"


def _require_owner_or_admin(audio: Audio, user: User) -> None:
    if audio.ownerId != user.id and user.role != "SUPERADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin permiso sobre este audio")


# --- Ingesta ---------------------------------------------------------------------

@router.post("/youtube", response_model=AudioPublic, status_code=status.HTTP_202_ACCEPTED)
async def create_from_youtube(
    payload: AudioCreateFromYouTube,
    current_user: User = Depends(get_current_user),
) -> AudioPublic:
    """Registra un audio desde URL de YouTube y encola su procesamiento."""
    audio = await prisma.audio.create(
        data={
            "title": payload.title,
            "ownerId": current_user.id,
            "sourceType": "YOUTUBE",
            "sourceUrl": str(payload.url),
            "visibility": payload.visibility,
        }
    )
    process_audio.delay(audio_id=audio.id)
    return AudioPublic.from_orm_audio(audio)


@router.post("/upload", response_model=AudioPublic, status_code=status.HTTP_202_ACCEPTED)
async def upload_audio(
    file: UploadFile,
    title: str | None = Form(default=None, max_length=200),
    visibility: str = Form(default="PRIVATE", pattern="^(PUBLIC|PRIVATE)$"),
    current_user: User = Depends(get_current_user),
) -> AudioPublic:
    """Sube un archivo de audio, lo valida y encola su procesamiento.

    Validación en dos capas: extensión declarada Y contenido real (magic
    bytes). El archivo se persiste en MinIO bajo una clave UUID generada
    por el servidor; el filename del usuario solo se usa como título.
    """
    # 1. Extensión declarada
    original_name = file.filename or ""
    extension = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if extension not in settings.allowed_formats_list:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Formato no soportado; permitidos: {settings.ALLOWED_AUDIO_FORMATS}",
        )

    # 2. Streaming a disco con límite de tamaño (nunca todo el archivo en RAM)
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    received = 0
    detected_format: str | None = None

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{extension}") as tmp:
        tmp_path = Path(tmp.name)
        try:
            while chunk := await file.read(UPLOAD_CHUNK_SIZE):
                if detected_format is None:
                    detected_format = sniff_audio_format(chunk[:16])
                    if detected_format is None:
                        raise HTTPException(
                            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            detail="El contenido del archivo no es un formato de audio reconocido",
                        )
                received += len(chunk)
                if received > max_bytes:
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"El archivo excede el máximo de {settings.MAX_UPLOAD_SIZE_MB} MB",
                    )
                tmp.write(chunk)
        except HTTPException:
            tmp.close()
            tmp_path.unlink(missing_ok=True)
            raise

    if received == 0:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Archivo vacío")

    # 3. Registro + subida a MinIO con clave generada por el servidor
    audio = await prisma.audio.create(
        data={
            "title": title or sanitize_title(original_name),
            "ownerId": current_user.id,
            "sourceType": "UPLOAD",
            "visibility": visibility,
            "format": detected_format,
        }
    )
    object_key = f"{current_user.id}/{audio.id}/original-{uuid.uuid4().hex}.{detected_format}"
    try:
        storage = get_storage()
        await run_in_threadpool(
            storage.upload_file, tmp_path, object_key, file.content_type or "application/octet-stream"
        )
    except Exception:
        await prisma.audio.update(
            where={"id": audio.id},
            data={"status": "FAILED", "errorMessage": "Error subiendo el archivo al almacenamiento"},
        )
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Error de almacenamiento; reintenta")
    finally:
        tmp_path.unlink(missing_ok=True)

    audio = await prisma.audio.update(where={"id": audio.id}, data={"originalKey": object_key})
    process_audio.delay(audio_id=audio.id)
    return AudioPublic.from_orm_audio(audio)


# --- Biblioteca -------------------------------------------------------------------

@router.get("/library/public", response_model=list[AudioPublic])
async def list_public_library(skip: int = 0, limit: int = 50) -> list[AudioPublic]:
    """Biblioteca pública: solo audios aprobados por moderación."""
    audios = await prisma.audio.find_many(
        where={"visibility": "PUBLIC", "isApproved": True, "status": "COMPLETED"},
        skip=skip,
        take=min(limit, 100),
        order={"createdAt": "desc"},
    )
    return [AudioPublic.from_orm_audio(a) for a in audios]


@router.get("/library/mine", response_model=list[AudioPublic])
async def list_my_library(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
) -> list[AudioPublic]:
    """Biblioteca privada del usuario autenticado (todos sus audios)."""
    audios = await prisma.audio.find_many(
        where={"ownerId": current_user.id},
        skip=skip,
        take=min(limit, 100),
        order={"createdAt": "desc"},
    )
    return [AudioPublic.from_orm_audio(a) for a in audios]


# --- Moderación (solo SUPERADMIN) -------------------------------------------------

@router.get("/moderation/queue", response_model=list[AudioPublic])
async def list_moderation_queue(
    skip: int = 0,
    limit: int = 50,
    _admin: User = Depends(require_superadmin),
) -> list[AudioPublic]:
    """Cola de moderación: audios públicos completados pendientes de aprobación."""
    audios = await prisma.audio.find_many(
        where={"visibility": "PUBLIC", "isApproved": False, "status": "COMPLETED"},
        skip=skip,
        take=min(limit, 100),
        order={"createdAt": "asc"},
    )
    return [AudioPublic.from_orm_audio(a) for a in audios]


@router.patch("/{audio_id}/moderate", response_model=AudioPublic)
async def moderate_audio(
    audio_id: str,
    payload: ModerationDecision,
    admin: User = Depends(require_superadmin),
) -> AudioPublic:
    """Aprueba o rechaza un audio público.

    Rechazo → el audio vuelve a PRIVATE (el dueño lo conserva, pero no se
    publica). La decisión queda en el log de auditoría con el motivo.
    """
    audio = await _get_audio_or_404(audio_id)
    if payload.approve:
        updated = await prisma.audio.update(where={"id": audio.id}, data={"isApproved": True})
    else:
        updated = await prisma.audio.update(
            where={"id": audio.id}, data={"isApproved": False, "visibility": "PRIVATE"}
        )
    audit_logger.info(
        "ADMIN %s %s audio %s (%s): %s",
        admin.email,
        "aprobó" if payload.approve else "rechazó",
        audio.id,
        audio.title,
        payload.reason or "sin motivo",
    )
    return AudioPublic.from_orm_audio(updated)


# --- Detalle y gestión ---------------------------------------------------------------

@router.get("/{audio_id}", response_model=AudioPublic)
async def get_audio(audio_id: str, current_user: User = Depends(get_current_user)) -> AudioPublic:
    """Detalle de un audio: el dueño siempre; otros solo si es público aprobado."""
    audio = await _get_audio_or_404(audio_id)
    if not _can_read(audio, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin acceso a este audio")
    return AudioPublic.from_orm_audio(audio)


@router.get("/{audio_id}/status", response_model=AudioStatusOut)
async def get_audio_status(
    audio_id: str, current_user: User = Depends(get_current_user)
) -> AudioStatusOut:
    """Estado del pipeline para polling desde el frontend."""
    audio = await _get_audio_or_404(audio_id)
    if not _can_read(audio, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin acceso a este audio")
    return AudioStatusOut(id=audio.id, status=audio.status, error_message=audio.errorMessage)


@router.get("/{audio_id}/stream", response_model=StreamURL)
async def get_stream_url(
    audio_id: str,
    variant: Literal["auto", "binaural", "ambisonics", "enhanced", "original"] = "auto",
    current_user: User = Depends(get_current_user),
) -> StreamURL:
    """URL prefirmada temporal del render solicitado.

    `auto` (default) devuelve el mejor disponible: binaural → mejorado →
    original, para que el audio sea reproducible aunque el pipeline aún
    no haya terminado etapas. Las demás variantes exigen que el render
    exista (409 si no).
    """
    audio = await _get_audio_or_404(audio_id)
    if not _can_read(audio, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin acceso a este audio")

    variant_keys = {
        "auto": audio.spatialKey or audio.enhancedKey or audio.originalKey,
        "binaural": audio.spatialKey,
        "ambisonics": audio.ambisonicsKey,
        "enhanced": audio.enhancedKey,
        "original": audio.originalKey,
    }
    object_key = variant_keys[variant]
    if object_key is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"El render '{variant}' aún no está disponible para este audio",
        )

    url = await run_in_threadpool(get_storage().get_presigned_url, object_key)
    return StreamURL(url=url, expires_in_seconds=3600)


@router.get("/{audio_id}/stems", response_model=StemsOut)
async def get_stems_urls(
    audio_id: str, current_user: User = Depends(get_current_user)
) -> StemsOut:
    """URLs prefirmadas de los stems separados (vocals, drums, bass, other).

    Contrato del reproductor 3D interactivo: el cliente descarga los stems
    y los espacializa en vivo (WASM + AudioWorklet); también sirve para la
    descarga individual de pistas.
    """
    audio = await _get_audio_or_404(audio_id)
    if not _can_read(audio, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin acceso a este audio")
    if not audio.stemsKeys:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="El audio aún no tiene stems disponibles")

    storage = get_storage()
    stems = {
        name: await run_in_threadpool(storage.get_presigned_url, key)
        for name, key in audio.stemsKeys.items()
    }
    return StemsOut(stems=stems, expires_in_seconds=3600)


@router.patch("/{audio_id}", response_model=AudioPublic)
async def update_audio(
    audio_id: str,
    payload: AudioUpdate,
    current_user: User = Depends(get_current_user),
) -> AudioPublic:
    """Edita título o visibilidad (solo dueño o superadmin)."""
    audio = await _get_audio_or_404(audio_id)
    _require_owner_or_admin(audio, current_user)

    data: dict = {}
    if payload.title is not None:
        data["title"] = payload.title
    if payload.visibility is not None and payload.visibility != audio.visibility:
        data["visibility"] = payload.visibility
        # Al hacerse público vuelve a requerir moderación
        data["isApproved"] = False
    if not data:
        return AudioPublic.from_orm_audio(audio)

    updated = await prisma.audio.update(where={"id": audio.id}, data=data)
    return AudioPublic.from_orm_audio(updated)


@router.delete("/{audio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audio(
    audio_id: str, current_user: User = Depends(get_current_user)
) -> None:
    """Elimina un audio y sus objetos en MinIO (solo dueño o superadmin)."""
    audio = await _get_audio_or_404(audio_id)
    _require_owner_or_admin(audio, current_user)

    stem_keys = list(audio.stemsKeys.values()) if audio.stemsKeys else []
    keys = [
        k
        for k in (audio.originalKey, audio.enhancedKey, audio.spatialKey, audio.ambisonicsKey, *stem_keys)
        if k
    ]
    if keys:
        await run_in_threadpool(get_storage().remove_objects, keys)
    await prisma.audio.delete(where={"id": audio.id})
