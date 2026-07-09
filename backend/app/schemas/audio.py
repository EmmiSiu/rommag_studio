"""Schemas Pydantic del dominio Audio (contratos de la API)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator

from prisma.models import Audio

_YOUTUBE_HOSTS = {"www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com"}


class AudioCreateFromYouTube(BaseModel):
    """Payload de ingesta desde YouTube."""

    title: str = Field(min_length=1, max_length=200)
    url: HttpUrl
    visibility: Literal["PUBLIC", "PRIVATE"] = "PRIVATE"

    @field_validator("url")
    @classmethod
    def must_be_youtube(cls, v: HttpUrl) -> HttpUrl:
        """Solo aceptar dominios de YouTube (evita SSRF hacia hosts arbitrarios)."""
        if v.host not in _YOUTUBE_HOSTS:
            raise ValueError("La URL debe ser de YouTube")
        return v


class AudioUpdate(BaseModel):
    """Payload de edición: solo campos gestionables por el dueño."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    visibility: Literal["PUBLIC", "PRIVATE"] | None = None


class ModerationDecision(BaseModel):
    """Decisión de moderación sobre un audio público (solo SUPERADMIN)."""

    approve: bool
    reason: str | None = Field(default=None, max_length=500)


class AudioStatusOut(BaseModel):
    """Estado del pipeline (respuesta de polling)."""

    id: str
    status: str
    error_message: str | None


class StreamURL(BaseModel):
    """URL prefirmada temporal para streaming/descarga."""

    url: str
    expires_in_seconds: int


class StemsOut(BaseModel):
    """URLs prefirmadas de los stems separados (contrato del reproductor 3D)."""

    stems: dict[str, str]
    expires_in_seconds: int


class AudioPublic(BaseModel):
    """Representación pública de un audio."""

    id: str
    title: str
    owner_id: str
    source_type: str
    status: str
    visibility: str
    is_approved: bool
    duration_seconds: float | None
    format: str | None
    bpm: float | None
    musical_key: str | None
    energy: float | None
    loudness_db: float | None
    analyzed_at: datetime | None
    error_message: str | None
    has_stems: bool
    has_ambisonics: bool
    created_at: datetime

    @classmethod
    def from_orm_audio(cls, audio: Audio) -> "AudioPublic":
        return cls(
            id=audio.id,
            title=audio.title,
            owner_id=audio.ownerId,
            source_type=audio.sourceType,
            status=audio.status,
            visibility=audio.visibility,
            is_approved=audio.isApproved,
            duration_seconds=audio.durationSeconds,
            format=audio.format,
            bpm=getattr(audio, "bpm", None),
            musical_key=getattr(audio, "musicalKey", None),
            energy=getattr(audio, "energy", None),
            loudness_db=getattr(audio, "loudnessDb", None),
            analyzed_at=getattr(audio, "analyzedAt", None),
            error_message=audio.errorMessage,
            has_stems=bool(audio.stemsKeys),
            has_ambisonics=audio.ambisonicsKey is not None,
            created_at=audio.createdAt,
        )
