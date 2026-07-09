"""Playlist endpoints: personal organization and collaboration."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, require_superadmin
from app.db.client import prisma
from app.schemas.playlist import (
    PlaylistCollaboratorCreate,
    PlaylistCollaboratorUpdate,
    PlaylistCreate,
    PlaylistItemCreate,
    PlaylistModerationDecision,
    PlaylistPublic,
    PlaylistUpdate,
)
from app.services.playlist_policy import (
    can_add_audio_to_playlist,
    can_edit_playlist_items,
    can_manage_playlist,
    can_read_playlist,
    playlist_role_for_user,
)
from prisma.models import User

router = APIRouter()
audit_logger = logging.getLogger("audit.admin")
playlist_audit_logger = logging.getLogger("audit.playlists")

PLAYLIST_INCLUDE = {
    "items": {"include": {"audio": True}},
    "collaborators": {"include": {"user": True}},
}


async def _get_playlist_or_404(playlist_id: str):
    playlist = await prisma.playlist.find_unique(where={"id": playlist_id}, include=PLAYLIST_INCLUDE)
    if playlist is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Playlist no encontrada")
    if getattr(playlist, "items", None):
        playlist.items.sort(key=lambda item: item.position)
    return playlist


def _role_for_response(playlist, user: User | None) -> str:
    if user is None:
        return "PUBLIC"
    role = playlist_role_for_user(playlist, user)
    return "PUBLIC" if role == "NONE" else role


def _playlist_out(playlist, user: User | None = None) -> PlaylistPublic:
    return PlaylistPublic.from_orm_playlist(playlist, role=_role_for_response(playlist, user))


@router.post("", response_model=PlaylistPublic, status_code=status.HTTP_201_CREATED)
async def create_playlist(
    payload: PlaylistCreate,
    current_user: User = Depends(get_current_user),
) -> PlaylistPublic:
    playlist = await prisma.playlist.create(
        data={
            "title": payload.title,
            "description": payload.description,
            "ownerId": current_user.id,
            "visibility": payload.visibility,
            "isApproved": False,
        }
    )
    return _playlist_out(await _get_playlist_or_404(playlist.id), current_user)


@router.get("/mine", response_model=list[PlaylistPublic])
async def list_my_playlists(current_user: User = Depends(get_current_user)) -> list[PlaylistPublic]:
    owned = await prisma.playlist.find_many(
        where={"ownerId": current_user.id},
        include=PLAYLIST_INCLUDE,
        order={"updatedAt": "desc"},
    )
    collaborated = await prisma.playlist.find_many(
        where={"collaborators": {"some": {"userId": current_user.id}}},
        include=PLAYLIST_INCLUDE,
        order={"updatedAt": "desc"},
    )
    playlists = {playlist.id: playlist for playlist in [*owned, *collaborated]}
    return [_playlist_out(playlist, current_user) for playlist in playlists.values()]


@router.get("/public", response_model=list[PlaylistPublic])
async def list_public_playlists(skip: int = 0, limit: int = 50) -> list[PlaylistPublic]:
    playlists = await prisma.playlist.find_many(
        where={"visibility": "PUBLIC", "isApproved": True},
        skip=skip,
        take=min(limit, 100),
        include=PLAYLIST_INCLUDE,
        order={"updatedAt": "desc"},
    )
    return [_playlist_out(playlist) for playlist in playlists]


@router.get("/public/{playlist_id}", response_model=PlaylistPublic)
async def get_public_playlist(playlist_id: str) -> PlaylistPublic:
    playlist = await _get_playlist_or_404(playlist_id)
    if playlist.visibility != "PUBLIC" or not playlist.isApproved:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Playlist pública no encontrada")
    return _playlist_out(playlist)


@router.get("/moderation/queue", response_model=list[PlaylistPublic])
async def list_playlist_moderation_queue(
    skip: int = 0,
    limit: int = 50,
    admin: User = Depends(require_superadmin),
) -> list[PlaylistPublic]:
    playlists = await prisma.playlist.find_many(
        where={"visibility": "PUBLIC", "isApproved": False},
        skip=skip,
        take=min(limit, 100),
        include=PLAYLIST_INCLUDE,
        order={"updatedAt": "asc"},
    )
    return [_playlist_out(playlist, admin) for playlist in playlists]


@router.patch("/{playlist_id}/moderate", response_model=PlaylistPublic)
async def moderate_playlist(
    playlist_id: str,
    payload: PlaylistModerationDecision,
    admin: User = Depends(require_superadmin),
) -> PlaylistPublic:
    playlist = await _get_playlist_or_404(playlist_id)
    if payload.approve:
        await prisma.playlist.update(where={"id": playlist.id}, data={"isApproved": True})
    else:
        await prisma.playlist.update(
            where={"id": playlist.id}, data={"isApproved": False, "visibility": "PRIVATE"}
        )
    audit_logger.info(
        "ADMIN %s %s playlist %s (%s): %s",
        admin.email,
        "aprobó" if payload.approve else "rechazó",
        playlist.id,
        playlist.title,
        payload.reason or "sin motivo",
    )
    return _playlist_out(await _get_playlist_or_404(playlist.id), admin)


@router.get("/{playlist_id}", response_model=PlaylistPublic)
async def get_playlist(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
) -> PlaylistPublic:
    playlist = await _get_playlist_or_404(playlist_id)
    if not can_read_playlist(playlist, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin acceso a esta playlist")
    return _playlist_out(playlist, current_user)


@router.patch("/{playlist_id}", response_model=PlaylistPublic)
async def update_playlist(
    playlist_id: str,
    payload: PlaylistUpdate,
    current_user: User = Depends(get_current_user),
) -> PlaylistPublic:
    playlist = await _get_playlist_or_404(playlist_id)
    if not can_manage_playlist(playlist, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin permiso para gestionar esta playlist")

    data: dict = {}
    if payload.title is not None:
        data["title"] = payload.title
    if payload.description is not None:
        data["description"] = payload.description
    if payload.visibility is not None and payload.visibility != playlist.visibility:
        data["visibility"] = payload.visibility
        data["isApproved"] = False
    if data:
        await prisma.playlist.update(where={"id": playlist.id}, data=data)
    return _playlist_out(await _get_playlist_or_404(playlist.id), current_user)


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(
    playlist_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    playlist = await _get_playlist_or_404(playlist_id)
    if not can_manage_playlist(playlist, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin permiso para eliminar esta playlist")
    await prisma.playlist.delete(where={"id": playlist.id})


@router.post("/{playlist_id}/items", response_model=PlaylistPublic, status_code=status.HTTP_201_CREATED)
async def add_playlist_item(
    playlist_id: str,
    payload: PlaylistItemCreate,
    current_user: User = Depends(get_current_user),
) -> PlaylistPublic:
    playlist = await _get_playlist_or_404(playlist_id)
    if not can_edit_playlist_items(playlist, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin permiso para editar esta playlist")

    audio = await prisma.audio.find_unique(where={"id": payload.audio_id})
    if audio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Audio no encontrado")
    if not can_add_audio_to_playlist(audio, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin acceso a este audio")

    existing = await prisma.playlistitem.find_first(
        where={"playlistId": playlist.id, "audioId": audio.id}
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="El audio ya está en la playlist")

    last_items = await prisma.playlistitem.find_many(
        where={"playlistId": playlist.id},
        order={"position": "desc"},
        take=1,
    )
    position = (last_items[0].position + 1) if last_items else 0
    await prisma.playlistitem.create(
        data={
            "playlistId": playlist.id,
            "audioId": audio.id,
            "addedById": current_user.id,
            "position": position,
        }
    )
    return _playlist_out(await _get_playlist_or_404(playlist.id), current_user)


@router.delete("/{playlist_id}/items/{audio_id}", response_model=PlaylistPublic)
async def remove_playlist_item(
    playlist_id: str,
    audio_id: str,
    current_user: User = Depends(get_current_user),
) -> PlaylistPublic:
    playlist = await _get_playlist_or_404(playlist_id)
    if not can_edit_playlist_items(playlist, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin permiso para editar esta playlist")
    item = await prisma.playlistitem.find_first(where={"playlistId": playlist.id, "audioId": audio_id})
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Audio no encontrado en playlist")
    await prisma.playlistitem.delete(where={"id": item.id})
    return _playlist_out(await _get_playlist_or_404(playlist.id), current_user)


@router.post("/{playlist_id}/collaborators", response_model=PlaylistPublic)
async def upsert_playlist_collaborator(
    playlist_id: str,
    payload: PlaylistCollaboratorCreate,
    current_user: User = Depends(get_current_user),
) -> PlaylistPublic:
    playlist = await _get_playlist_or_404(playlist_id)
    if not can_manage_playlist(playlist, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin permiso para gestionar colaboradores")
    target = await prisma.user.find_unique(where={"email": payload.email.lower()})
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    if target.id == playlist.ownerId:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="El dueño ya tiene acceso total")

    existing = await prisma.playlistcollaborator.find_first(
        where={"playlistId": playlist.id, "userId": target.id}
    )
    if existing:
        await prisma.playlistcollaborator.update(where={"id": existing.id}, data={"role": payload.role})
        playlist_audit_logger.info(
            "USER %s changed collaborator %s to %s on playlist %s (%s)",
            current_user.email,
            target.email,
            payload.role,
            playlist.id,
            playlist.title,
        )
    else:
        await prisma.playlistcollaborator.create(
            data={
                "playlistId": playlist.id,
                "userId": target.id,
                "role": payload.role,
                "invitedById": current_user.id,
            }
        )
        playlist_audit_logger.info(
            "USER %s invited collaborator %s as %s on playlist %s (%s)",
            current_user.email,
            target.email,
            payload.role,
            playlist.id,
            playlist.title,
        )
    return _playlist_out(await _get_playlist_or_404(playlist.id), current_user)


@router.patch("/{playlist_id}/collaborators/{user_id}", response_model=PlaylistPublic)
async def update_playlist_collaborator(
    playlist_id: str,
    user_id: str,
    payload: PlaylistCollaboratorUpdate,
    current_user: User = Depends(get_current_user),
) -> PlaylistPublic:
    playlist = await _get_playlist_or_404(playlist_id)
    if not can_manage_playlist(playlist, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin permiso para gestionar colaboradores")
    collaborator = await prisma.playlistcollaborator.find_first(
        where={"playlistId": playlist.id, "userId": user_id}
    )
    if collaborator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Colaborador no encontrado")
    await prisma.playlistcollaborator.update(where={"id": collaborator.id}, data={"role": payload.role})
    playlist_audit_logger.info(
        "USER %s changed collaborator user_id=%s to %s on playlist %s (%s)",
        current_user.email,
        user_id,
        payload.role,
        playlist.id,
        playlist.title,
    )
    return _playlist_out(await _get_playlist_or_404(playlist.id), current_user)


@router.delete("/{playlist_id}/collaborators/{user_id}", response_model=PlaylistPublic)
async def remove_playlist_collaborator(
    playlist_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
) -> PlaylistPublic:
    playlist = await _get_playlist_or_404(playlist_id)
    if not can_manage_playlist(playlist, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Sin permiso para gestionar colaboradores")
    collaborator = await prisma.playlistcollaborator.find_first(
        where={"playlistId": playlist.id, "userId": user_id}
    )
    if collaborator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Colaborador no encontrado")
    await prisma.playlistcollaborator.delete(where={"id": collaborator.id})
    playlist_audit_logger.info(
        "USER %s revoked collaborator user_id=%s from playlist %s (%s)",
        current_user.email,
        user_id,
        playlist.id,
        playlist.title,
    )
    return _playlist_out(await _get_playlist_or_404(playlist.id), current_user)
