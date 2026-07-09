"use client";

/** Personal and collaborative playlist library. */

import Link from "next/link";
import { Globe2, ListMusic, Lock, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  ApiError,
  createPlaylist,
  listMyPlaylists,
  type PlaylistPublic,
} from "@/lib/api";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<PlaylistPublic[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlaylists(await listMyPlaylists());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las playlists");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createPlaylist({
        title,
        description: description || undefined,
        visibility,
      });
      setTitle("");
      setDescription("");
      setVisibility("PRIVATE");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la playlist");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section>
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
            <ListMusic className="h-4 w-4" aria-hidden />
            Playlists
          </p>
          <h1 className="mt-3 text-2xl font-bold">Biblioteca avanzada</h1>
          <p className="mt-1 text-slate-400">
            Organiza audios propios y públicos aprobados en colecciones personales o colaborativas.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-slate-400">Cargando playlists…</p>
        ) : playlists.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
            <ListMusic className="mx-auto h-10 w-10" aria-hidden />
            <p className="mt-4">Aún no tienes playlists.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {playlists.map((playlist) => {
              const VisibilityIcon = playlist.visibility === "PUBLIC" ? Globe2 : Lock;
              return (
                <Link
                  key={playlist.id}
                  href={`/studio/playlists/${playlist.id}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-cyan-300/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{playlist.title}</h2>
                      {playlist.description && <p className="mt-1 truncate text-sm text-slate-400">{playlist.description}</p>}
                    </div>
                    <span className="rounded-full border border-cyan-300/20 px-2.5 py-1 text-xs text-cyan-200">
                      {playlist.role}
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <ListMusic className="h-4 w-4" aria-hidden />
                      {playlist.items_count} audios
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4" aria-hidden />
                      {playlist.collaborators.length} colaboradores
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <VisibilityIcon className="h-4 w-4" aria-hidden />
                      {playlist.visibility === "PUBLIC"
                        ? playlist.is_approved
                          ? "Pública"
                          : "En moderación"
                        : "Privada"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <aside className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Plus className="h-4 w-4" aria-hidden />
          Nueva playlist
        </h2>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Título
            <input
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-300"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Descripción
            <textarea
              maxLength={500}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-300"
            />
          </label>
          <fieldset className="grid gap-2 text-sm">
            <legend className="mb-1">Visibilidad</legend>
            {(["PRIVATE", "PUBLIC"] as const).map((option) => {
              const Icon = option === "PUBLIC" ? Globe2 : Lock;
              return (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === option}
                    onChange={() => setVisibility(option)}
                  />
                  <Icon className="h-4 w-4 text-slate-400" aria-hidden />
                  {option === "PUBLIC" ? "Pública (requiere moderación)" : "Privada"}
                </label>
              );
            })}
          </fieldset>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-cyan-300 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
          >
            {submitting ? "Creando…" : "Crear playlist"}
          </button>
        </form>
      </aside>
    </div>
  );
}
