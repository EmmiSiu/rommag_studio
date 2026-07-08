"""Endpoints de autenticación: registro, login, refresh, reset y perfil.

Notas de seguridad:
- Mensajes genéricos en login/forgot (no revelar si un email existe).
- Rate limiting por IP en los endpoints de fuerza bruta.
- Revocación de sesiones vía `User.tokenVersion` (se incrementa al resetear
  la contraseña; todos los JWT anteriores dejan de valer).
"""

import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import get_current_user
from app.core.ratelimit import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)
from app.db.client import prisma
from app.schemas.user import (
    ForgotPasswordRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenPair,
    UserCreate,
    UserLogin,
    UserPublic,
)
from prisma.models import User

logger = logging.getLogger(__name__)
router = APIRouter()

RESET_TOKEN_TTL = timedelta(hours=1)


def _token_pair(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(user.id, user.tokenVersion),
        refresh_token=create_refresh_token(user.id, user.tokenVersion),
    )


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, payload: UserCreate) -> UserPublic:
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
@limiter.limit("5/minute")
async def login(request: Request, payload: UserLogin) -> TokenPair:
    """Valida credenciales y emite un par de tokens JWT (access + refresh)."""
    user = await prisma.user.find_unique(where={"email": payload.email})
    if user is None or not verify_password(payload.password, user.passwordHash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    if not user.isActive:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada")
    return _token_pair(user)


@router.post("/refresh", response_model=TokenPair)
@limiter.limit("30/minute")
async def refresh(request: Request, payload: RefreshRequest) -> TokenPair:
    """Emite un par nuevo de tokens a partir de un refresh token válido."""
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido o expirado")

    user = await prisma.user.find_unique(where={"id": str(claims["sub"])})
    if user is None or not user.isActive or claims.get("ver") != user.tokenVersion:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido o expirado")
    return _token_pair(user)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("3/minute")
async def forgot_password(request: Request, payload: ForgotPasswordRequest) -> dict[str, str]:
    """Inicia la recuperación de contraseña.

    Responde 202 siempre (exista o no el email) para no permitir enumeración.
    TODO(email): enviar el token por correo; mientras no haya SMTP queda en
    el log del backend (solo útil en desarrollo/self-hosted).
    """
    user = await prisma.user.find_unique(where={"email": payload.email})
    if user is not None and user.isActive:
        plain_token, token_hash = generate_reset_token()
        await prisma.user.update(
            where={"id": user.id},
            data={
                "passwordResetToken": token_hash,
                "passwordResetExpiresAt": datetime.now(timezone.utc) + RESET_TOKEN_TTL,
            },
        )
        logger.info("Token de reset para %s: %s", user.email, plain_token)
    return {"detail": "Si el email existe, se envió un enlace de recuperación"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def reset_password(request: Request, payload: ResetPasswordRequest) -> dict[str, str]:
    """Cambia la contraseña con un token de un solo uso y revoca todas las sesiones."""
    token_hash = hash_reset_token(payload.token)
    user = await prisma.user.find_first(where={"passwordResetToken": token_hash})
    expired = (
        user is None
        or user.passwordResetExpiresAt is None
        or user.passwordResetExpiresAt < datetime.now(timezone.utc)
    )
    if expired:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Token inválido o expirado")

    await prisma.user.update(
        where={"id": user.id},
        data={
            "passwordHash": hash_password(payload.new_password),
            "passwordResetToken": None,
            "passwordResetExpiresAt": None,
            # Revoca todos los JWT emitidos hasta ahora
            "tokenVersion": user.tokenVersion + 1,
        },
    )
    return {"detail": "Contraseña actualizada; vuelve a iniciar sesión"}


@router.get("/me", response_model=UserPublic)
async def read_me(current_user: User = Depends(get_current_user)) -> UserPublic:
    """Devuelve el perfil del usuario autenticado."""
    return UserPublic.from_orm_user(current_user)
