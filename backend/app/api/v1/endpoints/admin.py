"""Métricas del sistema para el dashboard de administración (solo SUPERADMIN)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import require_superadmin
from app.db.client import prisma
from prisma.models import User

router = APIRouter()

_AUDIO_STATUSES = ["PENDING", "DOWNLOADING", "ENHANCING", "SPATIALIZING", "COMPLETED", "FAILED"]


class SystemMetrics(BaseModel):
    """Snapshot de métricas del sistema."""

    total_users: int
    active_users: int
    audios_by_status: dict[str, int]
    pending_moderation: int
    total_audio_seconds: float


@router.get("/metrics", response_model=SystemMetrics)
async def get_metrics(_admin: User = Depends(require_superadmin)) -> SystemMetrics:
    """Conteos de usuarios, pipeline y cola de moderación."""
    total_users = await prisma.user.count()
    active_users = await prisma.user.count(where={"isActive": True})
    audios_by_status = {
        status: await prisma.audio.count(where={"status": status}) for status in _AUDIO_STATUSES
    }
    pending_moderation = await prisma.audio.count(
        where={"visibility": "PUBLIC", "isApproved": False, "status": "COMPLETED"}
    )
    # Suma de duraciones conocidas (proxy del almacenamiento usado)
    completed = await prisma.audio.find_many(where={"durationSeconds": {"not": None}})
    total_audio_seconds = sum(a.durationSeconds or 0 for a in completed)

    return SystemMetrics(
        total_users=total_users,
        active_users=active_users,
        audios_by_status=audios_by_status,
        pending_moderation=pending_moderation,
        total_audio_seconds=total_audio_seconds,
    )
