"use client";

/** Playlist detail: items and collaboration controls. */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Globe2, ListMusic, Lock, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { StatusBadge, formatDuration } from "@/components/audio-card";
import {
  ApiError,
  addPlaylistItem,
  getPlaylist,
  listMyLibrary,
  removePlaylistCollaborator,
  removePlaylistItem,
  updatePlaylist,
  updatePlaylistCollaborator,
  upsertPlaylistCollaborator,
  type AudioPublic,
  type PlaylistPublic,
} from "@/lib/api";

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<PlaylistPublic | null>(null);
  const [audios, setAudios] = useState<AudioPublic[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaboratorRole, setCollaboratorRole] = useState<"EDITOR" | "VIEWER">("VIEWER");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [playlistData, library] = await Promise.all([getPlaylist(id), listMyLibrary(0, 100)]);
      setPlaylist(playlistData);
      setAudios(library);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la playlist");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = playlist?.role === "OWNER";
  const canEditItems = playlist?.role === "OWNER" || playlist?.role === "EDITOR";
  const itemAudioIds = useMemo(
    () => new Set(playlist?.items.map((item) => item.audio_id) ?? []),
    [playlist],
  );
  const addableAudios = audios.filter((audio) => !itemAudioIds.has(audio.id));

  const mutate = async (action: () => Promise<PlaylistPublic>) => {
    setWorking(true);
    setError(null);
    try {
      setPlaylist(await action());
      setSelectedAudioId("");
      setCollaboratorEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La acción no se pudo completar");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <p className="py-16 text-center text-slate-400">Cargando playlist…</p>;
  }

  if (!playlist) {
    return <p className="py-16 text-center text-slate-400">{error ?? "Playlist no disponible"}</p>;
  }

  const VisibilityIcon = playlist.visibility === "PUBLIC" ? Globe2 : Lock;

  return (
    <div>
      <Link href="/studio/playlists" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a playlists
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
            <ListMusic className="h-4 w-4" aria-hidden />
            {playlist.role}
          </p>
          <h1 className="mt-3 text-3xl font-bold">{playlist.title}</h1>
          {playlist.description && <p className="mt-2 max-w-2xl text-slate-400">{playlist.description}</p>}
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-400">
            <VisibilityIcon className="h-4 w-4" aria-hidden />
            {playlist.visibility === "PUBLIC"
              ? playlist.is_approved
                ? "Pública aprobada"
                : "Pública en moderación"
              : "Privada"}
          </p>
        </div>

        {canManage && (
          <button
            disabled={working}
            onClick={() =>
              void mutate(() =>
                updatePlaylist(playlist.id, {
                  visibility: playlist.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
                }),
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-cyan-300/50 disabled:opacity-50"
          >
            {playlist.visibility === "PUBLIC" ? <Lock className="h-4 w-4" aria-hidden /> : <Globe2 className="h-4 w-4" aria-hidden />}
            {playlist.visibility === "PUBLIC" ? "Hacer privada" : "Enviar a moderación pública"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">Audios</h2>
            <span className="text-sm text-slate-500">{playlist.items_count} total</span>
          </div>

          {playlist.items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
              <ListMusic className="mx-auto h-10 w-10" aria-hidden />
              <p className="mt-4">Esta playlist todavía no tiene audios.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {playlist.items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.audio?.title ?? "Audio no disponible"}</p>
                      {item.audio && (
                        <p className="mt-1 text-sm text-slate-400">
                          {formatDuration(item.audio.duration_seconds)} · {item.audio.visibility === "PUBLIC" ? "Público" : "Propio"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.audio && <StatusBadge status={item.audio.status} />}
                      {canEditItems && (
                        <button
                          disabled={working}
                          onClick={() => void mutate(() => removePlaylistItem(playlist.id, item.audio_id))}
                          className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                          title="Quitar de playlist"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="grid gap-4">
          {canEditItems && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Plus className="h-4 w-4" aria-hidden />
                Agregar audio
              </h2>
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (selectedAudioId) void mutate(() => addPlaylistItem(playlist.id, selectedAudioId));
                }}
              >
                <select
                  value={selectedAudioId}
                  onChange={(event) => setSelectedAudioId(event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300"
                >
                  <option value="">Selecciona desde tu biblioteca</option>
                  {addableAudios.map((audio) => (
                    <option key={audio.id} value={audio.id}>
                      {audio.title}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={working || !selectedAudioId}
                  className="rounded-lg bg-cyan-300 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
                >
                  Agregar
                </button>
              </form>
            </section>
          )}

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" aria-hidden />
              Colaboradores
            </h2>
            <div className="mt-4 grid gap-2">
              {playlist.collaborators.length === 0 ? (
                <p className="text-sm text-slate-500">Sin colaboradores todavía.</p>
              ) : (
                playlist.collaborators.map((collaborator) => (
                  <div key={collaborator.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{collaborator.display_name || collaborator.email}</p>
                        <p className="truncate text-xs text-slate-500">{collaborator.email}</p>
                      </div>
                      <span className="text-xs text-cyan-200">{collaborator.role}</span>
                    </div>
                    {canManage && (
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={working}
                          onClick={() =>
                            void mutate(() =>
                              updatePlaylistCollaborator(
                                playlist.id,
                                collaborator.user_id,
                                collaborator.role === "EDITOR" ? "VIEWER" : "EDITOR",
                              ),
                            )
                          }
                          className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 disabled:opacity-50"
                        >
                          {collaborator.role === "EDITOR" ? "Hacer viewer" : "Hacer editor"}
                        </button>
                        <button
                          disabled={working}
                          onClick={() => void mutate(() => removePlaylistCollaborator(playlist.id, collaborator.user_id))}
                          className="rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Revocar
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {canManage && (
              <form
                className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (collaboratorEmail) {
                    void mutate(() =>
                      upsertPlaylistCollaborator(playlist.id, {
                        email: collaboratorEmail,
                        role: collaboratorRole,
                      }),
                    );
                  }
                }}
              >
                <label className="flex flex-col gap-1 text-sm">
                  Email
                  <input
                    type="email"
                    value={collaboratorEmail}
                    onChange={(event) => setCollaboratorEmail(event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-300"
                  />
                </label>
                <select
                  value={collaboratorRole}
                  onChange={(event) => setCollaboratorRole(event.target.value as "EDITOR" | "VIEWER")}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="EDITOR">Editor</option>
                </select>
                <button
                  type="submit"
                  disabled={working || !collaboratorEmail}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-300/40 px-4 py-2.5 font-semibold text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Invitar
                </button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
