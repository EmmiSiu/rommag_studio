"""Permission helpers for playlists.

The functions are intentionally small and data-shape based so they can be unit
tested without a database. Endpoint code passes Prisma models; tests can pass
plain objects with the same attribute names.
"""

from typing import Literal

PlaylistAccess = Literal["OWNER", "EDITOR", "VIEWER", "NONE"]


def _attr(obj: object, name: str, default: object = None) -> object:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _collaborators(playlist: object) -> list[object]:
    value = _attr(playlist, "collaborators", [])
    return list(value or [])


def playlist_role_for_user(playlist: object, user: object) -> PlaylistAccess:
    """Return the effective playlist role for a user."""
    user_id = _attr(user, "id")
    if _attr(user, "role") == "SUPERADMIN":
        return "OWNER"
    if _attr(playlist, "ownerId") == user_id:
        return "OWNER"
    for collaborator in _collaborators(playlist):
        if _attr(collaborator, "userId") == user_id:
            return "EDITOR" if _attr(collaborator, "role") == "EDITOR" else "VIEWER"
    return "NONE"


def can_read_playlist(playlist: object, user: object | None) -> bool:
    """Private playlists require owner/admin/collaborator access."""
    is_public = _attr(playlist, "visibility") == "PUBLIC" and bool(_attr(playlist, "isApproved"))
    if is_public:
        return True
    if user is None:
        return False
    return playlist_role_for_user(playlist, user) != "NONE"


def can_edit_playlist_items(playlist: object, user: object) -> bool:
    """Owners, admins and editors can add/remove items."""
    return playlist_role_for_user(playlist, user) in {"OWNER", "EDITOR"}


def can_manage_playlist(playlist: object, user: object) -> bool:
    """Only owners and admins can edit metadata, visibility and collaborators."""
    return playlist_role_for_user(playlist, user) == "OWNER"


def can_add_audio_to_playlist(audio: object, user: object) -> bool:
    """A playlist item can reference own audios or public approved completed audio."""
    if _attr(user, "role") == "SUPERADMIN":
        return True
    if _attr(audio, "ownerId") == _attr(user, "id"):
        return True
    return (
        _attr(audio, "visibility") == "PUBLIC"
        and bool(_attr(audio, "isApproved"))
        and _attr(audio, "status") == "COMPLETED"
    )
