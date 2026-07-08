"use client";

/**
 * Detalle de un audio: estado del pipeline en vivo (polling a /status),
 * reproductor por variante, descargas (binaural/Ambisonics/stems) y gestión
 * (título, visibilidad, borrado).
 */

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { StatusBadge, formatDuration } from "@/components/audio-card";
import {
  ApiError,
  deleteAudio,
  getAudio,
  getAudioStatus,
  getStems,
  getStreamUrl,
  updateAudio,
  type AudioPublic,
  type StreamVariant,
} from "@/lib/api";

const POLL_INTERVAL_MS = 3000;

const PIPELINE_STEPS = [
  { key: "DOWNLOADING", label: "Descargando" },
  { key: "ENHANCING", label: "Mejorando con IA" },
  { key: "SPATIALIZING", label: "Espacializando" },
  { key: "COMPLETED", label: "Listo" },
] as const;

const STEP_ORDER: Record<string, number> = {
  PENDING: 0,
  DOWNLOADING: 1,
  ENHANCING: 2,
  SPATIALIZING: 3,
  COMPLETED: 4,
};

const STREAM_VARIANTS = [
  { key: "auto", label: "Mejor disponible" },
  { key: "binaural", label: "Binaural 3D" },
  { key: "enhanced", label: "Mejorado" },
  { key: "original", label: "Original" },
] satisfies Array<{ key: StreamVariant; label: string }>;

const MEDIA_SESSION_ACTIONS: MediaSessionAction[] = [
  "play",
  "pause",
  "seekbackward",
  "seekforward",
  "seekto",
  "stop",
];

function getVariantLabel(variant: StreamVariant): string {
  return STREAM_VARIANTS.find((item) => item.key === variant)?.label ?? "Audio";
}

function clampPosition(value: number, duration: number): number {
  return Math.max(0, Math.min(value, duration));
}

function setMediaSessionAction(
  mediaSession: MediaSession,
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
) {
  try {
    mediaSession.setActionHandler(action, handler);
  } catch {
    /* Acción no soportada por el navegador actual. */
  }
}

function useAudioMediaSession({
  audio,
  audioRef,
  streamSrc,
  variant,
}: {
  audio: AudioPublic | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  streamSrc: string | null;
  variant: StreamVariant;
}) {
  useEffect(() => {
    if (!audio || !streamSrc || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    const player = audioRef.current;
    if (!player) return;

    const mediaSession = navigator.mediaSession;
    if (typeof MediaMetadata !== "undefined") {
      mediaSession.metadata = new MediaMetadata({
        title: audio.title,
        artist: "Audio Inmersivo",
        album: getVariantLabel(variant),
        artwork: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
    }

    const syncPlaybackState = () => {
      mediaSession.playbackState = player.paused ? "paused" : "playing";
    };

    const syncPositionState = () => {
      if (!Number.isFinite(player.duration) || player.duration <= 0) return;
      if (typeof mediaSession.setPositionState !== "function") return;
      try {
        mediaSession.setPositionState({
          duration: player.duration,
          playbackRate: player.playbackRate || 1,
          position: clampPosition(player.currentTime, player.duration),
        });
      } catch {
        /* Algunos navegadores rechazan estados intermedios durante el cambio de src. */
      }
    };

    const seekBy = (offset: number) => {
      if (!Number.isFinite(player.duration) || player.duration <= 0) return;
      player.currentTime = clampPosition(player.currentTime + offset, player.duration);
      syncPositionState();
    };

    setMediaSessionAction(mediaSession, "play", () => void player.play().catch(() => undefined));
    setMediaSessionAction(mediaSession, "pause", () => player.pause());
    setMediaSessionAction(mediaSession, "seekbackward", (details) => seekBy(-(details.seekOffset ?? 10)));
    setMediaSessionAction(mediaSession, "seekforward", (details) => seekBy(details.seekOffset ?? 10));
    setMediaSessionAction(mediaSession, "seekto", (details) => {
      if (details.seekTime === undefined || !Number.isFinite(player.duration)) return;
      const nextTime = clampPosition(details.seekTime, player.duration);
      if (details.fastSeek && typeof player.fastSeek === "function") {
        player.fastSeek(nextTime);
      } else {
        player.currentTime = nextTime;
      }
      syncPositionState();
    });
    setMediaSessionAction(mediaSession, "stop", () => {
      player.pause();
      if (Number.isFinite(player.duration) && player.duration > 0) {
        player.currentTime = 0;
        syncPositionState();
      }
    });

    const markEnded = () => {
      mediaSession.playbackState = "none";
      syncPositionState();
    };

    player.addEventListener("play", syncPlaybackState);
    player.addEventListener("pause", syncPlaybackState);
    player.addEventListener("loadedmetadata", syncPositionState);
    player.addEventListener("durationchange", syncPositionState);
    player.addEventListener("ratechange", syncPositionState);
    player.addEventListener("timeupdate", syncPositionState);
    player.addEventListener("ended", markEnded);

    syncPlaybackState();
    syncPositionState();

    return () => {
      player.removeEventListener("play", syncPlaybackState);
      player.removeEventListener("pause", syncPlaybackState);
      player.removeEventListener("loadedmetadata", syncPositionState);
      player.removeEventListener("durationchange", syncPositionState);
      player.removeEventListener("ratechange", syncPositionState);
      player.removeEventListener("timeupdate", syncPositionState);
      player.removeEventListener("ended", markEnded);
      MEDIA_SESSION_ACTIONS.forEach((action) => {
        setMediaSessionAction(mediaSession, action, null);
      });
      mediaSession.metadata = null;
      mediaSession.playbackState = "none";
    };
  }, [audio, audioRef, streamSrc, variant]);
}

function PipelineProgress({ status }: { status: string }) {
  const current = STEP_ORDER[status] ?? 0;
  return (
    <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-0">
      {PIPELINE_STEPS.map((step, index) => {
        const stepNumber = index + 1;
        const done = current > stepNumber || status === "COMPLETED";
        const active = current === stepNumber && status !== "COMPLETED";
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2 sm:flex-col sm:gap-1">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? "bg-emerald-500 text-slate-950"
                  : active
                    ? "animate-pulse bg-violet-500 text-white"
                    : "bg-slate-800 text-slate-500"
              }`}
            >
              {done ? "✓" : stepNumber}
            </span>
            <span className={`text-xs ${done || active ? "text-slate-200" : "text-slate-500"}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function AudioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [audio, setAudio] = useState<AudioPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [variant, setVariant] = useState<StreamVariant>("auto");
  const [streamSrc, setStreamSrc] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useAudioMediaSession({ audio, audioRef, streamSrc, variant });

  const isProcessing =
    audio !== null && audio.status !== "COMPLETED" && audio.status !== "FAILED";

  const refresh = useCallback(async () => {
    try {
      setAudio(await getAudio(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el audio");
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Polling del pipeline mientras está en curso (Sprint 3.2)
  useEffect(() => {
    if (!isProcessing) return;
    const timer = setInterval(async () => {
      try {
        const status = await getAudioStatus(id);
        if (status.status === "COMPLETED" || status.status === "FAILED") {
          clearInterval(timer);
          await refresh();
          setNotice(
            status.status === "COMPLETED"
              ? "🎉 Tu audio 3D está listo"
              : null,
          );
        } else {
          setAudio((prev) => (prev ? { ...prev, status: status.status } : prev));
        }
      } catch {
        /* transitorio: el siguiente tick reintenta */
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [id, isProcessing, refresh]);

  const play = async (selected: StreamVariant) => {
    setVariant(selected);
    setError(null);
    try {
      const { url } = await getStreamUrl(id, selected);
      setStreamSrc(url);
      // src cambia de forma asíncrona: reproducir tras el render
      requestAnimationFrame(() => void audioRef.current?.play().catch(() => undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo obtener el stream");
    }
  };

  const download = async (kind: "binaural" | "ambisonics" | "stems") => {
    setError(null);
    try {
      if (kind === "stems") {
        const { stems } = await getStems(id);
        // Abrir cada stem (el navegador los descarga desde MinIO)
        Object.values(stems).forEach((url) => window.open(url, "_blank", "noopener"));
      } else {
        const { url } = await getStreamUrl(id, kind);
        window.open(url, "_blank", "noopener");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo generar la descarga");
    }
  };

  const toggleVisibility = async () => {
    if (!audio) return;
    setWorking(true);
    try {
      setAudio(
        await updateAudio(id, {
          visibility: audio.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la visibilidad");
    } finally {
      setWorking(false);
    }
  };

  const removeAudio = async () => {
    if (!confirm("¿Eliminar este audio y todos sus archivos? Esta acción no se puede deshacer.")) {
      return;
    }
    setWorking(true);
    try {
      await deleteAudio(id);
      router.push("/studio/library");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar");
      setWorking(false);
    }
  };

  if (!audio) {
    return <p className="py-16 text-center text-slate-400">{error ?? "Cargando…"}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{audio.title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {audio.source_type === "YOUTUBE" ? "🎬 YouTube" : "📁 Archivo"} ·{" "}
            {formatDuration(audio.duration_seconds)} ·{" "}
            {audio.visibility === "PUBLIC"
              ? audio.is_approved
                ? "🌐 Pública"
                : "🌐 En moderación"
              : "🔒 Privado"}
          </p>
        </div>
        <StatusBadge status={audio.status} />
      </div>

      {/* Pipeline en vivo */}
      {audio.status !== "FAILED" && <PipelineProgress status={audio.status} />}

      {audio.status === "FAILED" && (
        <div role="alert" className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4">
          <p className="font-semibold text-red-300">El procesamiento falló</p>
          <p className="mt-1 text-sm text-red-200/80">
            {audio.error_message ?? "Error desconocido"}
          </p>
        </div>
      )}

      {notice && (
        <p className="mt-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Reproductor */}
      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="font-semibold">Escuchar</h2>
        <p className="mt-1 text-xs text-slate-500">
          El render binaural está pensado para audífonos 🎧
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STREAM_VARIANTS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => void play(key)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                variant === key && streamSrc
                  ? "bg-violet-600 text-white"
                  : "border border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              ▶ {label}
            </button>
          ))}
        </div>
        {streamSrc && (
          <audio ref={audioRef} controls src={streamSrc} className="mt-4 w-full">
            Tu navegador no soporta el elemento de audio.
          </audio>
        )}
      </section>

      {/* Descargas */}
      {audio.status === "COMPLETED" && (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="font-semibold">Descargas</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <button
              onClick={() => void download("binaural")}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500"
            >
              ⬇ Binaural (audífonos)
            </button>
            {audio.has_ambisonics && (
              <button
                onClick={() => void download("ambisonics")}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500"
              >
                ⬇ Ambisonics (altavoces)
              </button>
            )}
            {audio.has_stems && (
              <button
                onClick={() => void download("stems")}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500"
              >
                ⬇ Stems (voces, batería, bajo, otros)
              </button>
            )}
          </div>
        </section>
      )}

      {/* Gestión */}
      <section className="mt-6 flex flex-wrap gap-2 text-sm">
        <button
          onClick={() => void toggleVisibility()}
          disabled={working}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500 disabled:opacity-50"
        >
          {audio.visibility === "PUBLIC" ? "🔒 Hacer privado" : "🌐 Hacer público"}
        </button>
        <button
          onClick={() => void removeAudio()}
          disabled={working}
          className="rounded-lg border border-red-500/40 px-3 py-1.5 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          🗑 Eliminar
        </button>
      </section>
    </div>
  );
}
