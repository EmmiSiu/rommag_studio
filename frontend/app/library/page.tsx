"use client";

/**
 * Biblioteca pública: audios aprobados por moderación. Listado sin sesión;
 * para escuchar se requiere iniciar sesión (el streaming es autenticado).
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatDuration } from "@/components/audio-card";
import { Nav } from "@/components/nav";
import { ApiError, getStreamUrl, listPublicLibrary, type AudioPublic } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const PAGE_SIZE = 20;

export default function PublicLibraryPage() {
  const { user } = useAuth();
  const [audios, setAudios] = useState<AudioPublic[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const loadPage = useCallback(async (skip: number) => {
    setLoading(true);
    setError(null);
    try {
      const page = await listPublicLibrary(skip, PAGE_SIZE);
      setAudios((prev) => (skip === 0 ? page : [...prev, ...page]));
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setError("No se pudo cargar la biblioteca pública");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  const play = async (audio: AudioPublic) => {
    setError(null);
    try {
      const { url } = await getStreamUrl(audio.id, "auto");
      setPlaying({ id: audio.id, url });
      requestAnimationFrame(() => void audioRef.current?.play().catch(() => undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo reproducir");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-8 pb-28">
        <h1 className="text-2xl font-bold">Biblioteca pública</h1>
        <p className="mt-1 text-slate-400">
          Audios mejorados y espacializados por la comunidad.
        </p>

        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {!loading && audios.length === 0 && !error ? (
          <p className="mt-16 text-center text-slate-400">
            Todavía no hay audios públicos. ¡Sé el primero en compartir uno!
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {audios.map((audio) => (
              <article
                key={audio.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{audio.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    🎧 Audio 3D · {formatDuration(audio.duration_seconds)}
                  </p>
                </div>
                {user ? (
                  <button
                    onClick={() => void play(audio)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      playing?.id === audio.id
                        ? "bg-violet-600 text-white"
                        : "border border-slate-700 text-slate-300 hover:border-violet-500/60"
                    }`}
                  >
                    {playing?.id === audio.id ? "Sonando" : "▶ Escuchar"}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="shrink-0 rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:border-violet-500/60"
                  >
                    Entra para escuchar
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}

        {loading && <p className="mt-6 text-center text-slate-400">Cargando…</p>}
        {hasMore && !loading && (
          <button
            onClick={() => loadPage(audios.length)}
            className="mt-6 w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:border-slate-500"
          >
            Cargar más
          </button>
        )}
      </main>

      {/* Reproductor fijo inferior */}
      {playing && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto max-w-5xl">
            <audio ref={audioRef} controls src={playing.url} className="w-full">
              Tu navegador no soporta el elemento de audio.
            </audio>
          </div>
        </div>
      )}
    </div>
  );
}
