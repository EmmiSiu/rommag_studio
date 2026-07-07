"""Endpoint de salud para healthchecks de Docker/Easypanel."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness probe: la API está arriba y responde."""
    return {"status": "ok"}
