/**
 * Cliente de la API de Audio Inmersivo.
 *
 * Estrategia de sesión (ver stages.md Sprint 3.1):
 * - Access token SOLO en memoria (nunca en localStorage: mitiga XSS).
 * - Refresh token en localStorage (rotado en cada refresh por el backend).
 * - Cookie ligera `ai_session=1` (sin token) para que el middleware de
 *   Next.js pueda proteger rutas sin acceso al almacenamiento del cliente.
 * - Ante un 401, un único refresh en vuelo (single-flight) y reintento.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE = `${API_URL}/api/v1`;

const REFRESH_KEY = "ai_refresh_token";
export const SESSION_COOKIE = "ai_session";

// --- Tipos (espejo de los schemas Pydantic del backend) ---------------------

export type UserPublic = {
  id: string;
  email: string;
  display_name: string;
  role: "USER" | "SUPERADMIN";
  is_active: boolean;
  created_at: string;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type AudioStatus =
  | "PENDING"
  | "DOWNLOADING"
  | "ENHANCING"
  | "SPATIALIZING"
  | "COMPLETED"
  | "FAILED";

export type AudioPublic = {
  id: string;
  title: string;
  owner_id: string;
  source_type: "YOUTUBE" | "UPLOAD";
  status: AudioStatus;
  visibility: "PUBLIC" | "PRIVATE";
  is_approved: boolean;
  duration_seconds: number | null;
  format: string | null;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  loudness_db: number | null;
  analyzed_at: string | null;
  error_message: string | null;
  has_stems: boolean;
  has_ambisonics: boolean;
  created_at: string;
};

export type AudioStatusOut = {
  id: string;
  status: AudioStatus;
  error_message: string | null;
};

export type StreamVariant = "auto" | "binaural" | "ambisonics" | "enhanced" | "original";

export type StreamURL = { url: string; expires_in_seconds: number };
export type StemsOut = { stems: Record<string, string>; expires_in_seconds: number };

export type PlaylistRole = "OWNER" | "EDITOR" | "VIEWER" | "PUBLIC";

export type PlaylistItem = {
  id: string;
  audio_id: string;
  position: number;
  added_by_id: string;
  created_at: string;
  audio: AudioPublic | null;
};

export type PlaylistCollaborator = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: "EDITOR" | "VIEWER";
  created_at: string;
};

export type PlaylistPublic = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  visibility: "PUBLIC" | "PRIVATE";
  is_approved: boolean;
  items_count: number;
  role: PlaylistRole;
  created_at: string;
  updated_at: string;
  items: PlaylistItem[];
  collaborators: PlaylistCollaborator[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

// --- Gestión de sesión --------------------------------------------------------

let accessToken: string | null = null;

function setSession(tokens: TokenPair): void {
  accessToken = tokens.access_token;
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function clearSession(): void {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function hasStoredSession(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(REFRESH_KEY) !== null;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Renueva el par de tokens. Single-flight: N llamadas concurrentes → 1 request. */
async function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const stored = localStorage.getItem(REFRESH_KEY);
    if (!stored) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: stored }),
      });
      if (!res.ok) {
        clearSession();
        return false;
      }
      setSession((await res.json()) as TokenPair);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Garantiza un access token utilizable (para peticiones fuera de `api`, como XHR). */
export async function ensureAccessToken(): Promise<string | null> {
  if (!accessToken && hasStoredSession()) await tryRefresh();
  return accessToken;
}

// --- Fetch base -----------------------------------------------------------------

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

async function parseDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    return JSON.stringify(data.detail ?? data);
  } catch {
    return `Error ${res.status}`;
  }
}

export async function api<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  if (auth) await ensureAccessToken();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry && (await tryRefresh())) {
    return api<T>(path, options, false);
  }
  if (!res.ok) throw new ApiError(res.status, await parseDetail(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Auth -----------------------------------------------------------------------

export async function login(email: string, password: string): Promise<UserPublic> {
  const tokens = await api<TokenPair>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setSession(tokens);
  return api<UserPublic>("/auth/me");
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<UserPublic> {
  await api<UserPublic>("/auth/register", {
    method: "POST",
    body: { email, password, display_name: displayName },
    auth: false,
  });
  return login(email, password);
}

export function fetchMe(): Promise<UserPublic> {
  return api<UserPublic>("/auth/me");
}

// --- Audios -----------------------------------------------------------------------

export function createFromYouTube(
  title: string,
  url: string,
  visibility: "PUBLIC" | "PRIVATE",
): Promise<AudioPublic> {
  return api<AudioPublic>("/audios/youtube", { method: "POST", body: { title, url, visibility } });
}

export function listMyLibrary(skip = 0, limit = 20): Promise<AudioPublic[]> {
  return api<AudioPublic[]>(`/audios/library/mine?skip=${skip}&limit=${limit}`);
}

export function listPublicLibrary(skip = 0, limit = 20): Promise<AudioPublic[]> {
  return api<AudioPublic[]>(`/audios/library/public?skip=${skip}&limit=${limit}`, { auth: false });
}

export function getAudio(id: string): Promise<AudioPublic> {
  return api<AudioPublic>(`/audios/${id}`);
}

export function getAudioStatus(id: string): Promise<AudioStatusOut> {
  return api<AudioStatusOut>(`/audios/${id}/status`);
}

export function getStreamUrl(id: string, variant: StreamVariant = "auto"): Promise<StreamURL> {
  return api<StreamURL>(`/audios/${id}/stream?variant=${variant}`);
}

export function getStems(id: string): Promise<StemsOut> {
  return api<StemsOut>(`/audios/${id}/stems`);
}

export function updateAudio(
  id: string,
  data: { title?: string; visibility?: "PUBLIC" | "PRIVATE" },
): Promise<AudioPublic> {
  return api<AudioPublic>(`/audios/${id}`, { method: "PATCH", body: data });
}

export function deleteAudio(id: string): Promise<void> {
  return api<void>(`/audios/${id}`, { method: "DELETE" });
}

// --- Playlists ------------------------------------------------------------------

export function createPlaylist(data: {
  title: string;
  description?: string;
  visibility: "PUBLIC" | "PRIVATE";
}): Promise<PlaylistPublic> {
  return api<PlaylistPublic>("/playlists", { method: "POST", body: data });
}

export function listMyPlaylists(): Promise<PlaylistPublic[]> {
  return api<PlaylistPublic[]>("/playlists/mine");
}

export function listPublicPlaylists(skip = 0, limit = 20): Promise<PlaylistPublic[]> {
  return api<PlaylistPublic[]>(`/playlists/public?skip=${skip}&limit=${limit}`, { auth: false });
}

export function getPublicPlaylist(id: string): Promise<PlaylistPublic> {
  return api<PlaylistPublic>(`/playlists/public/${id}`, { auth: false });
}

export function getPlaylist(id: string): Promise<PlaylistPublic> {
  return api<PlaylistPublic>(`/playlists/${id}`);
}

export function updatePlaylist(
  id: string,
  data: { title?: string; description?: string; visibility?: "PUBLIC" | "PRIVATE" },
): Promise<PlaylistPublic> {
  return api<PlaylistPublic>(`/playlists/${id}`, { method: "PATCH", body: data });
}

export function deletePlaylist(id: string): Promise<void> {
  return api<void>(`/playlists/${id}`, { method: "DELETE" });
}

export function addPlaylistItem(id: string, audioId: string): Promise<PlaylistPublic> {
  return api<PlaylistPublic>(`/playlists/${id}/items`, { method: "POST", body: { audio_id: audioId } });
}

export function removePlaylistItem(id: string, audioId: string): Promise<PlaylistPublic> {
  return api<PlaylistPublic>(`/playlists/${id}/items/${audioId}`, { method: "DELETE" });
}

export function upsertPlaylistCollaborator(
  id: string,
  data: { email: string; role: "EDITOR" | "VIEWER" },
): Promise<PlaylistPublic> {
  return api<PlaylistPublic>(`/playlists/${id}/collaborators`, { method: "POST", body: data });
}

export function updatePlaylistCollaborator(
  id: string,
  userId: string,
  role: "EDITOR" | "VIEWER",
): Promise<PlaylistPublic> {
  return api<PlaylistPublic>(`/playlists/${id}/collaborators/${userId}`, {
    method: "PATCH",
    body: { role },
  });
}

export function removePlaylistCollaborator(id: string, userId: string): Promise<PlaylistPublic> {
  return api<PlaylistPublic>(`/playlists/${id}/collaborators/${userId}`, { method: "DELETE" });
}

// --- Admin (solo SUPERADMIN; el backend rechaza cualquier otro rol) -------------

export type SystemMetrics = {
  total_users: number;
  active_users: number;
  audios_by_status: Record<string, number>;
  pending_moderation: number;
  pending_playlist_moderation: number;
  total_audio_seconds: number;
};

export function getMetrics(): Promise<SystemMetrics> {
  return api<SystemMetrics>("/admin/metrics");
}

export function listUsers(skip = 0, limit = 50): Promise<UserPublic[]> {
  return api<UserPublic[]>(`/users?skip=${skip}&limit=${limit}`);
}

export function updateUser(
  id: string,
  data: { role?: "USER" | "SUPERADMIN"; is_active?: boolean },
): Promise<UserPublic> {
  return api<UserPublic>(`/users/${id}`, { method: "PATCH", body: data });
}

export function deleteUser(id: string): Promise<void> {
  return api<void>(`/users/${id}`, { method: "DELETE" });
}

export function listModerationQueue(skip = 0, limit = 50): Promise<AudioPublic[]> {
  return api<AudioPublic[]>(`/audios/moderation/queue?skip=${skip}&limit=${limit}`);
}

export function moderateAudio(
  id: string,
  approve: boolean,
  reason?: string,
): Promise<AudioPublic> {
  return api<AudioPublic>(`/audios/${id}/moderate`, {
    method: "PATCH",
    body: { approve, reason },
  });
}

export function listPlaylistModerationQueue(skip = 0, limit = 50): Promise<PlaylistPublic[]> {
  return api<PlaylistPublic[]>(`/playlists/moderation/queue?skip=${skip}&limit=${limit}`);
}

export function moderatePlaylist(
  id: string,
  approve: boolean,
  reason?: string,
): Promise<PlaylistPublic> {
  return api<PlaylistPublic>(`/playlists/${id}/moderate`, {
    method: "PATCH",
    body: { approve, reason },
  });
}

/**
 * Subida de archivo con progreso. fetch aún no expone progreso de upload
 * de forma portable, por eso XMLHttpRequest.
 */
export async function uploadAudio(
  file: File,
  options: { title?: string; visibility: "PUBLIC" | "PRIVATE"; onProgress?: (pct: number) => void },
): Promise<AudioPublic> {
  const token = await ensureAccessToken();
  if (!token) throw new ApiError(401, "Sesión expirada; vuelve a iniciar sesión");

  const form = new FormData();
  form.append("file", file);
  if (options.title) form.append("title", options.title);
  form.append("visibility", options.visibility);

  return new Promise<AudioPublic>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/audios/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as AudioPublic);
      } else {
        let detail = `Error ${xhr.status}`;
        try {
          detail = JSON.parse(xhr.responseText).detail ?? detail;
        } catch {
          /* respuesta no JSON */
        }
        reject(new ApiError(xhr.status, detail));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Error de red durante la subida"));
    xhr.send(form);
  });
}
