"""Audio Inmersivo - Punto de entrada de la API (FastAPI).

Responsabilidad única: ensamblar la aplicación (middlewares, routers,
ciclo de vida). La lógica de negocio vive en `app/services`, la
configuración en `app/core/config.py` y los endpoints en `app/api`.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.client import prisma


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Ciclo de vida: conecta/desconecta recursos externos (12-Factor: backing services)."""
    await prisma.connect()
    yield
    await prisma.disconnect()


def create_app() -> FastAPI:
    """Factory de la aplicación (facilita testing y evita estado global)."""
    app = FastAPI(
        title=settings.APP_NAME,
        description="Plataforma auto-alojada de mejora y espacialización de audio con IA",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.APP_ENV == "development" else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
