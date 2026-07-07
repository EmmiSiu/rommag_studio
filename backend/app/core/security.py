"""Primitivas de seguridad: hashing de contraseñas y tokens JWT.

Responsabilidad única: criptografía y tokens. NO conoce la base de datos
ni los modelos de usuario; eso pertenece a `app/services/auth_service.py`.
"""

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

def _create_token(subject: str, expires_delta: timedelta, token_type: str) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str) -> str:
    return _create_token(
        user_id,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        user_id,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )


def decode_token(token: str, expected_type: str = "access") -> str:
    """Valida un token y devuelve el user_id (claim `sub`).

    Raises:
        jwt.InvalidTokenError: token expirado, firma inválida o tipo incorrecto.
    """
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Se esperaba un token de tipo '{expected_type}'")
    return str(payload["sub"])
