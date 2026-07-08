"""Router agregador de la API v1.

Cada dominio (auth, audios, users) registra su propio router aquí
(Open/Closed: añadir un dominio nuevo no modifica los existentes).
"""

from fastapi import APIRouter

from app.api.v1.endpoints import admin, audios, auth, health, users

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(audios.router, prefix="/audios", tags=["audios"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
