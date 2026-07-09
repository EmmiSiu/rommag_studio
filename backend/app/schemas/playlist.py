"""Schemas Pydantic for playlists and collaboration."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.audio import AudioPublic


class PlaylistCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    visibility: Literal["PUBLIC", "PRIVATE"] = "PRIVATE"


class PlaylistUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    visibility: Literal["PUBLIC", "PRIVATE"] | None = None


class PlaylistItemCreate(BaseModel):
    audio_id: str


class PlaylistCollaboratorCreate(BaseModel):
    email: EmailStr
    role: Literal["EDITOR", "VIEWER"] = "VIEWER"


class PlaylistCollaboratorUpdate(BaseModel):
    role: Literal["EDITOR", "VIEWER"]


class PlaylistModerationDecision(BaseModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=500)


class PlaylistItemOut(BaseModel):
    id: str
    audio_id: str
    position: int
    added_by_id: str
    created_at: datetime
    audio: AudioPublic | None = None


class PlaylistCollaboratorOut(BaseModel):
    id: str
    user_id: str
    email: str
    display_name: str
    role: Literal["EDITOR", "VIEWER"]
    created_at: datetime


class PlaylistPublic(BaseModel):
    id: str
    title: str
    description: str | None
    owner_id: str
    visibility: str
    is_approved: bool
    items_count: int
    role: Literal["OWNER", "EDITOR", "VIEWER", "PUBLIC"]
    created_at: datetime
    updated_at: datetime
    items: list[PlaylistItemOut] = Field(default_factory=list)
    collaborators: list[PlaylistCollaboratorOut] = Field(default_factory=list)

    @classmethod
    def from_orm_playlist(cls, playlist, role: str = "PUBLIC") -> "PlaylistPublic":
        items = []
        for item in getattr(playlist, "items", []) or []:
            audio = getattr(item, "audio", None)
            items.append(
                PlaylistItemOut(
                    id=item.id,
                    audio_id=item.audioId,
                    position=item.position,
                    added_by_id=item.addedById,
                    created_at=item.createdAt,
                    audio=AudioPublic.from_orm_audio(audio) if audio else None,
                )
            )

        collaborators = []
        for collaborator in getattr(playlist, "collaborators", []) or []:
            user = getattr(collaborator, "user", None)
            collaborators.append(
                PlaylistCollaboratorOut(
                    id=collaborator.id,
                    user_id=collaborator.userId,
                    email=user.email if user else "",
                    display_name=user.displayName if user else "",
                    role=collaborator.role,
                    created_at=collaborator.createdAt,
                )
            )

        return cls(
            id=playlist.id,
            title=playlist.title,
            description=playlist.description,
            owner_id=playlist.ownerId,
            visibility=playlist.visibility,
            is_approved=playlist.isApproved,
            items_count=len(items),
            role=role,  # type: ignore[arg-type]
            created_at=playlist.createdAt,
            updated_at=playlist.updatedAt,
            items=items,
            collaborators=collaborators,
        )
