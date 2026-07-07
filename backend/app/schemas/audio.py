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
    error_message: str | None
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
            error_message=audio.errorMessage,
            created_at=audio.createdAt,
        )
