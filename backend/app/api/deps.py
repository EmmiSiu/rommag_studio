"""Dependencias compartidas de FastAPI (autenticación y autorización).

Interface Segregation: los endpoints declaran exactamente lo que necesitan
(`get_current_user` o `require_superadmin`), no un contexto gigante.
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_token
from app.db.client import prisma
from prisma.models import User

_bearer_scheme = HTTPBearer(auto_error=False)

_CREDENTIALS_ERROR = HTTPException(
    status.HTTP_401_UNAUTHORIZED,
    detail="Token inválido o expirado",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> User:
    """Resuelve el usuario autenticado a partir del header `Authorization: Bearer`."""
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except jwt.InvalidTokenError:
        raise _CREDENTIALS_ERROR

    user = await prisma.user.find_unique(where={"id": str(payload["sub"])})
    if user is None or not user.isActive:
        raise _CREDENTIALS_ERROR
    # Revocación: un token emitido antes del último cambio de tokenVersion no vale
    if payload.get("ver") != user.tokenVersion:
        raise _CREDENTIALS_ERROR
    return user


async def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Restringe el endpoint a usuarios con rol SUPERADMIN."""
    if current_user.role != "SUPERADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Requiere rol SUPERADMIN")
    return current_user
