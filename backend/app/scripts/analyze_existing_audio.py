"""Backfill idempotente de metadata musical para audios existentes.

Uso:
    python -m app.scripts.analyze_existing_audio
    python -m app.scripts.analyze_existing_audio --force
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import UTC, datetime
import tempfile
from pathlib import Path

from app.db.client import prisma
from app.services.storage import get_storage
from audio_services.analysis import musical


async def analyze_existing(force: bool = False, limit: int = 100) -> int:
    await prisma.connect()
    updated = 0
    try:
        where = {"status": "COMPLETED"}
        if not force:
            where["analyzedAt"] = None

        audios = await prisma.audio.find_many(where=where, take=limit, order={"createdAt": "asc"})
        storage = get_storage()
        with tempfile.TemporaryDirectory(prefix="audio-analysis-") as tmp:
            tmpdir = Path(tmp)
            for audio in audios:
                object_key = audio.enhancedKey or audio.originalKey or audio.spatialKey
                if not object_key:
                    continue
                local_path = storage.download_file(object_key, tmpdir / f"{audio.id}.audio")
                analysis = musical.analyze_wav(local_path)
                await prisma.audio.update(
                    where={"id": audio.id},
                    data={
                        "bpm": analysis.bpm,
                        "musicalKey": analysis.musical_key,
                        "energy": analysis.energy,
                        "loudnessDb": analysis.loudness_db,
                        "analyzedAt": datetime.now(UTC),
                    },
                )
                updated += 1
    finally:
        await prisma.disconnect()
    return updated


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill musical analysis metadata.")
    parser.add_argument("--force", action="store_true", help="Recalculate even when analyzedAt is already set.")
    parser.add_argument("--limit", type=int, default=100, help="Maximum audios to process in one run.")
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    count = asyncio.run(analyze_existing(force=args.force, limit=args.limit))
    print(f"Audios analizados: {count}")
