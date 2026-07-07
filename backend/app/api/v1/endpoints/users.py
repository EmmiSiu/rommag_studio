"""Endpoints de administración de usuarios (solo SUPERADMIN)."""

from fastapi import APIRouter, Depends

from app.api.deps import require_superadmin
from app.db.client import prisma
from app.schemas.user import UserPublic
from prisma.models import User

router = APIRouter()


@router.get("", response_model=list[UserPublic])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    _admin: User = Depends(require_superadmin),
) -> list[UserPublic]:
    """Lista todos los usuarios de la plataforma (paginado)."""
    users = await prisma.user.find_many(skip=skip, take=min(limit, 100), order={"createdAt": "desc"})
    return [UserPublic.from_orm_user(u) for u in users]


# TODO(admin): PATCH /{user_id} (cambiar rol, activar/desactivar),
# DELETE /{user_id}, y endpoints de moderación de audios públicos.
