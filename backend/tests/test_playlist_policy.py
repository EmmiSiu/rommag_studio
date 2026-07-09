"""Unit tests for playlist collaboration permissions."""

from types import SimpleNamespace

from app.services.playlist_policy import (
    can_add_audio_to_playlist,
    can_edit_playlist_items,
    can_manage_playlist,
    can_read_playlist,
    playlist_role_for_user,
)


def user(user_id: str, role: str = "USER") -> SimpleNamespace:
    return SimpleNamespace(id=user_id, role=role)


def collaborator(user_id: str, role: str) -> SimpleNamespace:
    return SimpleNamespace(userId=user_id, role=role)


def playlist(
    owner_id: str = "owner",
    visibility: str = "PRIVATE",
    is_approved: bool = False,
    collaborators: list[SimpleNamespace] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        ownerId=owner_id,
        visibility=visibility,
        isApproved=is_approved,
        collaborators=collaborators or [],
    )


def audio(
    owner_id: str = "owner",
    visibility: str = "PRIVATE",
    is_approved: bool = False,
    status: str = "COMPLETED",
) -> SimpleNamespace:
    return SimpleNamespace(
        ownerId=owner_id,
        visibility=visibility,
        isApproved=is_approved,
        status=status,
    )


def test_owner_can_manage_and_edit_items():
    current = user("owner")
    target = playlist(owner_id="owner")

    assert playlist_role_for_user(target, current) == "OWNER"
    assert can_read_playlist(target, current)
    assert can_manage_playlist(target, current)
    assert can_edit_playlist_items(target, current)


def test_editor_can_edit_items_but_not_manage_playlist():
    current = user("editor")
    target = playlist(collaborators=[collaborator("editor", "EDITOR")])

    assert playlist_role_for_user(target, current) == "EDITOR"
    assert can_read_playlist(target, current)
    assert not can_manage_playlist(target, current)
    assert can_edit_playlist_items(target, current)


def test_viewer_can_read_but_not_mutate():
    current = user("viewer")
    target = playlist(collaborators=[collaborator("viewer", "VIEWER")])

    assert playlist_role_for_user(target, current) == "VIEWER"
    assert can_read_playlist(target, current)
    assert not can_manage_playlist(target, current)
    assert not can_edit_playlist_items(target, current)


def test_public_approved_playlist_is_readable_without_session():
    target = playlist(visibility="PUBLIC", is_approved=True)

    assert can_read_playlist(target, None)


def test_public_pending_playlist_is_not_publicly_readable():
    target = playlist(visibility="PUBLIC", is_approved=False)

    assert not can_read_playlist(target, None)


def test_superadmin_has_owner_level_access():
    current = user("admin", role="SUPERADMIN")
    target = playlist(owner_id="other")

    assert playlist_role_for_user(target, current) == "OWNER"
    assert can_manage_playlist(target, current)


def test_audio_addition_allows_owned_audio():
    assert can_add_audio_to_playlist(audio(owner_id="u1"), user("u1"))


def test_audio_addition_allows_public_approved_completed_audio():
    assert can_add_audio_to_playlist(
        audio(owner_id="other", visibility="PUBLIC", is_approved=True, status="COMPLETED"),
        user("u1"),
    )


def test_audio_addition_rejects_private_audio_from_other_user():
    assert not can_add_audio_to_playlist(audio(owner_id="other"), user("u1"))


def test_audio_addition_rejects_public_unapproved_audio():
    assert not can_add_audio_to_playlist(
        audio(owner_id="other", visibility="PUBLIC", is_approved=False),
        user("u1"),
    )
