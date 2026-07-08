"""Fixtures base para tests backend.

Los tests unitarios actuales no necesitan servicios externos. Las fixtures de
DB quedan listas para tests de integración sin arriesgar datos de desarrollo:
solo se conectan cuando TEST_DATABASE_URL apunta a una base aislada.
"""

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
import os

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/audio_inmersivo_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret")
os.environ.setdefault("MINIO_ROOT_USER", "test")
os.environ.setdefault("MINIO_ROOT_PASSWORD", "test-password")


@pytest.fixture
def test_database_url() -> str:
    """URL de base de datos para tests de integración.

    Usar TEST_DATABASE_URL explícito evita ejecutar fixtures DB contra la base
    de desarrollo por accidente.
    """
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Define TEST_DATABASE_URL para ejecutar tests con base de datos")
    if "test" not in database_url.lower():
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base de datos de test")
    return database_url


@pytest.fixture
def prisma_test_client(test_database_url: str) -> Callable[[], AsyncIterator[object]]:
    """Factory de cliente Prisma para tests async con DB.

    Uso esperado:
        async with prisma_test_client() as db:
            ...
    """

    @asynccontextmanager
    async def _client() -> AsyncIterator[object]:
        previous_database_url = os.environ.get("DATABASE_URL")
        os.environ["DATABASE_URL"] = test_database_url

        from prisma import Prisma

        prisma = Prisma()
        await prisma.connect()
        try:
            yield prisma
        finally:
            await prisma.disconnect()
            if previous_database_url is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = previous_database_url

    return _client
