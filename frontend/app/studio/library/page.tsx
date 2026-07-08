"use client";

/** Biblioteca privada: todos los audios del usuario, con paginación incremental. */

import Link from "next/link";
import { ArrowRight, Headphones, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AudioCard } from "@/components/audio-card";
import { ApiError, listMyLibrary, type AudioPublic } from "@/lib/api";

const PAGE_SIZE = 20;

export default function MyLibraryPage() {
  const [audios, setAudios] = useState<AudioPublic[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (skip: number) => {
    setLoading(true);
    setError(null);
    try {
      const page = await listMyLibrary(skip, PAGE_SIZE);
      setAudios((prev) => (skip === 0 ? page : [...prev, ...page]));
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la biblioteca");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi biblioteca</h1>
        <Link
          href="/studio/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo audio
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && audios.length === 0 ? (
        <div className="mt-16 text-center text-slate-400">
          <Headphones className="mx-auto h-10 w-10" aria-hidden />
          <p className="mt-4">Aún no tienes audios.</p>
          <Link href="/studio/new" className="mt-2 inline-flex items-center gap-1.5 text-violet-400 hover:underline">
            Procesa tu primer audio
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {audios.map((audio) => (
            <AudioCard key={audio.id} audio={audio} />
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
    </div>
  );
}
