"""Endpoints de administración de usuarios (solo SUPERADMIN).

Auditoría mínima: cada acción de admin queda en el log del backend con
el email del admin, la acción y el objetivo (Sprint 4.2).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool

from app.api.deps import require_superadmin
from app.db.client import prisma
from app.schemas.user import UserAdminUpdate, UserPublic
from app.services.storage import get_storage
from prisma.models import User

logger = logging.getLogger("audit.admin")
router = APIRouter()


async def _get_user_or_404(user_id: str) -> User:
    user = await prisma.user.find_unique(where={"id": user_id})
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.get("", response_model=list[UserPublic])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    _admin: User = Depends(require_superadmin),
) -> list[UserPublic]:
    """Lista todos los usuarios de la plataforma (paginado)."""
    users = await prisma.user.find_many(skip=skip, take=min(limit, 100), order={"createdAt": "desc"})
    return [UserPublic.from_orm_user(u) for u in users]


@router.patch("/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: str,
    payload: UserAdminUpdate,
    admin: User = Depends(require_superadmin),
) -> UserPublic:
    """Cambia rol o estado de un usuario. Un admin no puede degradarse/desactivarse a sí mismo."""
    user = await _get_user_or_404(user_id)

    if user.id == admin.id and (payload.role == "USER" or payload.is_active is False):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="No puedes quitarte el rol ni desactivarte a ti mismo (evita perder el acceso admin)",
        )

    data: dict = {}
    if payload.role is not None and payload.role != user.role:
        data["role"] = payload.role
    if payload.is_active is not None and payload.is_active != user.isActive:
        data["isActive"] = payload.is_active
        # Al desactivar, revocar todas las sesiones activas del usuario
        if payload.is_active is False:
            data["tokenVersion"] = user.tokenVersion + 1
    if not data:
        return UserPublic.from_orm_user(user)

    updated = await prisma.user.update(where={"id": user.id}, data=data)
    logger.info("ADMIN %s actualizó usuario %s: %s", admin.email, user.email, data)
    return UserPublic.from_orm_user(updated)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    admin: User = Depends(require_superadmin),
) -> None:
    """Elimina un usuario, sus audios (cascade en DB) y sus archivos en MinIO."""
    user = await _get_user_or_404(user_id)
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No puedes eliminar tu propia cuenta admin")

    # Objetos de MinIO primero: el cascade de la DB no conoce el almacenamiento
    audios = await prisma.audio.find_many(where={"ownerId": user.id})
    keys: list[str] = []
    for audio in audios:
        keys.extend(k for k in (audio.originalKey, audio.enhancedKey, audio.spatialKey, audio.ambisonicsKey) if k)
        if audio.stemsKeys:
            keys.extend(audio.stemsKeys.values())
    if keys:
        await run_in_threadpool(get_storage().remove_objects, keys)

    await prisma.user.delete(where={"id": user.id})
    logger.info(
        "ADMIN %s eliminó al usuario %s (%d audios, %d objetos)", admin.email, user.email, len(audios), len(keys)
    )
