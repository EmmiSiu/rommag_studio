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
        user_id = decode_token(credentials.credentials, expected_type="access")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")

    user = await prisma.user.find_unique(where={"id": user_id})
    if user is None or not user.isActive:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Usuario no válido")
    return user


async def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Restringe el endpoint a usuarios con rol SUPERADMIN."""
    if current_user.role != "SUPERADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Requiere rol SUPERADMIN")
    return current_user
