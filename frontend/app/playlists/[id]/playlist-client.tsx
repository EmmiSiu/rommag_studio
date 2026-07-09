"use client";

/** Public approved playlist view. */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Headphones, ListMusic, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { StatusBadge, formatDuration } from "@/components/audio-card";
import { Nav } from "@/components/nav";
import { ApiError, getPublicPlaylist, type PlaylistPublic } from "@/lib/api";

export function PublicPlaylistClient() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<PlaylistPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlaylist(await getPublicPlaylist(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la playlist pública");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/library" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a biblioteca pública
        </Link>

        {loading ? (
          <p className="py-16 text-center text-slate-400">Cargando playlist…</p>
        ) : error || !playlist ? (
          <p role="alert" className="mt-8 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error ?? "Playlist no disponible"}
          </p>
        ) : (
          <>
            <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
              <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
                <ListMusic className="h-4 w-4" aria-hidden />
                Colección pública
              </p>
              <h1 className="mt-4 text-3xl font-bold">{playlist.title}</h1>
              {playlist.description && <p className="mt-3 max-w-2xl text-slate-400">{playlist.description}</p>}
              <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Headphones className="h-4 w-4" aria-hidden />
                  {playlist.items_count} audios
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-4 w-4" aria-hidden />
                  Streaming con sesión
                </span>
              </div>
            </section>

            <section className="mt-6 grid gap-3">
              {playlist.items.length === 0 ? (
                <p className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center text-slate-400">
                  Esta colección aún no tiene audios publicados.
                </p>
              ) : (
                playlist.items.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">{item.audio?.title ?? "Audio no disponible"}</h2>
                        {item.audio && (
                          <p className="mt-1 text-sm text-slate-400">
                            {formatDuration(item.audio.duration_seconds)}
                          </p>
                        )}
                      </div>
                      {item.audio && <StatusBadge status={item.audio.status} />}
                    </div>
                  </article>
                ))
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
