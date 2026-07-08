"""Seed de datos iniciales: crea/asegura el SUPERADMIN (12-Factor: admin process).

Idempotente: puede ejecutarse en cada deploy sin efectos secundarios.
Uso: python -m app.scripts.seed
"""

import asyncio
import sys

from app.core.config import settings
from app.core.security import hash_password
from app.db.client import prisma


async def seed_superadmin() -> None:
    if not settings.SUPERADMIN_PASSWORD:
        print("ERROR: SUPERADMIN_PASSWORD no está definida en el entorno", file=sys.stderr)
        raise SystemExit(1)

    await prisma.connect()
    try:
        existing = await prisma.user.find_unique(where={"email": settings.SUPERADMIN_EMAIL})
        if existing is None:
            await prisma.user.create(
                data={
                    "email": settings.SUPERADMIN_EMAIL,
                    "passwordHash": hash_password(settings.SUPERADMIN_PASSWORD),
                    "displayName": "Superadmin",
                    "role": "SUPERADMIN",
                }
            )
            print(f"Superadmin creado: {settings.SUPERADMIN_EMAIL}")
        elif existing.role != "SUPERADMIN" or not existing.isActive:
            await prisma.user.update(
                where={"id": existing.id},
                data={"role": "SUPERADMIN", "isActive": True},
            )
            print(f"Superadmin reparado (rol/estado): {settings.SUPERADMIN_EMAIL}")
        else:
            print(f"Superadmin ya existe: {settings.SUPERADMIN_EMAIL} — nada que hacer")
    finally:
        await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(seed_superadmin())
