"""Endpoints de audios: ingesta (YouTube/upload) y biblioteca.

Los endpoints solo validan y delegan: la ingesta encola tareas Celery
(`app/workers/tasks/audio_tasks.py`) y el trabajo pesado ocurre en el worker.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.db.client import prisma
from app.schemas.audio import AudioCreateFromYouTube, AudioPublic
from app.workers.tasks.audio_tasks import process_audio
from prisma.models import User

router = APIRouter()


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


@router.get("/{audio_id}", response_model=AudioPublic)
async def get_audio(audio_id: str, current_user: User = Depends(get_current_user)) -> AudioPublic:
    """Detalle de un audio: el dueño siempre puede verlo; otros solo si es público aprobado."""
    audio = await prisma.audio.find_unique(where={"id": audio_id})
    if audio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Audio no encontrado")

    is_owner = audio.ownerId == current_user.id
    is_public = audio.visibility == "PUBLIC" and audio.isApproved
    if not (is_owner or is_public or current_user.role == "SUPERADMIN"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin acceso a este audio")
    return AudioPublic.from_orm_audio(audio)


# TODO(upload): POST /upload con UploadFile — validar extensión contra
# settings.allowed_formats_list, tamaño contra MAX_UPLOAD_SIZE_MB, subir a
# MinIO vía app/services/storage.py y encolar process_audio.
