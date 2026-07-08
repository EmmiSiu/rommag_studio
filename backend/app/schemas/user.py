"""Schemas Pydantic del dominio Usuario (contratos de la API).

Nunca exponer el modelo Prisma directamente: estos schemas controlan
qué campos entran (validación) y salen (nunca passwordHash).
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from prisma.models import User


class UserCreate(BaseModel):
    """Payload de registro."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=50)


class UserLogin(BaseModel):
    """Payload de login."""

    email: EmailStr
    password: str


class TokenPair(BaseModel):
    """Respuesta de login/refresh: par de tokens JWT."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Payload de renovación de sesión."""

    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    """Payload de inicio de recuperación de contraseña."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Payload de cambio de contraseña con token de un solo uso."""

    token: str = Field(min_length=16, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserAdminUpdate(BaseModel):
    """Payload de administración de usuarios (solo SUPERADMIN)."""

    role: Literal["USER", "SUPERADMIN"] | None = None
    is_active: bool | None = None


class UserPublic(BaseModel):
    """Representación pública de un usuario (sin datos sensibles)."""

    id: str
    email: EmailStr
    display_name: str
    role: str
    is_active: bool
    created_at: datetime

    @classmethod
    def from_orm_user(cls, user: User) -> "UserPublic":
        return cls(
            id=user.id,
            email=user.email,
            display_name=user.displayName,
            role=user.role,
            is_active=user.isActive,
            created_at=user.createdAt,
        )
