"""Endpoints de autenticación: registro, login y perfil propio."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password
from app.db.client import prisma
from app.schemas.user import TokenPair, UserCreate, UserLogin, UserPublic
from prisma.models import User

router = APIRouter()


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate) -> UserPublic:
    """Registra un usuario nuevo con rol USER."""
    existing = await prisma.user.find_unique(where={"email": payload.email})
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="El email ya está registrado")

    user = await prisma.user.create(
        data={
            "email": payload.email,
            "passwordHash": hash_password(payload.password),
            "displayName": payload.display_name,
        }
    )
    return UserPublic.from_orm_user(user)


@router.post("/login", response_model=TokenPair)
async def login(payload: UserLogin) -> TokenPair:
    """Valida credenciales y emite un par de tokens JWT (access + refresh)."""
    user = await prisma.user.find_unique(where={"email": payload.email})
    # Mensaje genérico: no revelar si el email existe (evita enumeración de usuarios)
    if user is None or not verify_password(payload.password, user.passwordHash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    if not user.isActive:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada")

    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserPublic)
async def read_me(current_user: User = Depends(get_current_user)) -> UserPublic:
    """Devuelve el perfil del usuario autenticado."""
    return UserPublic.from_orm_user(current_user)
