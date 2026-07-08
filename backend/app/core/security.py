"""Primitivas de seguridad: hashing de contraseñas y tokens JWT.

Responsabilidad única: criptografía y tokens. NO conoce la base de datos
ni los modelos de usuario; eso pertenece a los endpoints/servicios.

Los tokens incluyen el claim `ver` (tokenVersion del usuario): al
incrementar `User.tokenVersion` se revocan todas las sesiones emitidas.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import settings


# --- Contraseñas -------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """Genera un hash bcrypt con salt aleatorio."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compara en tiempo constante una contraseña contra su hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# --- JWT ---------------------------------------------------------------------

def _create_token(subject: str, expires_delta: timedelta, token_type: str, token_version: int) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "ver": token_version,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, token_version: int) -> str:
    return _create_token(
        user_id,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
        token_version=token_version,
    )


def create_refresh_token(user_id: str, token_version: int) -> str:
    return _create_token(
        user_id,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
        token_version=token_version,
    )


def decode_token(token: str, expected_type: str = "access") -> dict[str, Any]:
    """Valida un token y devuelve su payload (`sub`, `ver`, ...).

    Raises:
        jwt.InvalidTokenError: token expirado, firma inválida o tipo incorrecto.
    """
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Se esperaba un token de tipo '{expected_type}'")
    return payload


# --- Tokens de un solo uso (reset de contraseña) --------------------------------

def generate_reset_token() -> tuple[str, str]:
    """Genera un token de reset.

    Returns:
        (token_plano, hash_sha256): el plano se envía al usuario; en DB
        solo se guarda el hash (si la DB se filtra, los tokens no sirven).
    """
    plain = secrets.token_urlsafe(32)
    return plain, hash_reset_token(plain)


def hash_reset_token(plain_token: str) -> str:
    return hashlib.sha256(plain_token.encode("utf-8")).hexdigest()
