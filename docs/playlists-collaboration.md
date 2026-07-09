# Playlists and Collaboration

Stage 8 introduces playlists as first-class organization objects. A playlist can
contain owned audio or public approved audio, and can be shared with explicit
collaborator roles.

```mermaid
erDiagram
    USER ||--o{ PLAYLIST : owns
    USER ||--o{ PLAYLIST_COLLABORATOR : receives_access
    USER ||--o{ PLAYLIST_ITEM : adds
    PLAYLIST ||--o{ PLAYLIST_ITEM : contains
    AUDIO ||--o{ PLAYLIST_ITEM : appears_in
    PLAYLIST ||--o{ PLAYLIST_COLLABORATOR : grants

    PLAYLIST {
        uuid id PK
        string title
        string description
        uuid owner_id FK
        Visibility visibility
        boolean is_approved
    }

    PLAYLIST_ITEM {
        uuid id PK
        uuid playlist_id FK
        uuid audio_id FK
        uuid added_by_id FK
        int position
    }

    PLAYLIST_COLLABORATOR {
        uuid id PK
        uuid playlist_id FK
        uuid user_id FK
        PlaylistRole role "EDITOR | VIEWER"
    }
```

```mermaid
flowchart LR
    owner["Owner"]
    editor["Editor"]
    viewer["Viewer"]
    public["Public visitor"]
    playlist["Playlist"]
    item["Playlist item"]
    moderation["Moderation queue"]

    owner -->|"CRUD metadata, collaborators, items"| playlist
    editor -->|"add/remove items"| item
    viewer -->|"read only"| playlist
    owner -->|"sets PUBLIC"| moderation
    moderation -->|"approve"| public
    public -->|"read approved collection"| playlist
```

## Permission Rules

- Owner and superadmin have owner-level access.
- Editor can add/remove items but cannot manage visibility or collaborators.
- Viewer can read private shared playlists.
- Public visitors can read only approved public playlists.
- Playlist items can reference owned audio or public approved completed audio.

## Operational Evidence

- Collaboration changes emit `audit.playlists` logs for invite, role change and
  revoke actions.
- `npm.cmd run test:playlists` provides the live Stage 8 harness when
  `FRONTEND_URL` and `BACKEND_URL`/`API_URL` are available.
- Public playlist pages expose server-side metadata from the approved public
  endpoint; private or unapproved playlists fall back to generic metadata.
