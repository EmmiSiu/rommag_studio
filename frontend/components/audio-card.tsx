"use client";

/** Tarjeta de audio para las bibliotecas (privada y pública). */

import Link from "next/link";

import type { AudioPublic, AudioStatus } from "@/lib/api";

const STATUS_LABELS: Record<AudioStatus, { label: string; classes: string }> = {
  PENDING: { label: "En cola", classes: "bg-slate-700/50 text-slate-300" },
  DOWNLOADING: { label: "Descargando", classes: "bg-sky-500/15 text-sky-300" },
  ENHANCING: { label: "Mejorando con IA", classes: "bg-violet-500/15 text-violet-300" },
  SPATIALIZING: { label: "Espacializando", classes: "bg-fuchsia-500/15 text-fuchsia-300" },
  COMPLETED: { label: "Listo", classes: "bg-emerald-500/15 text-emerald-300" },
  FAILED: { label: "Falló", classes: "bg-red-500/15 text-red-300" },
};

export function StatusBadge({ status }: { status: AudioStatus }) {
  const { label, classes } = STATUS_LABELS[status];
  const inProgress = status !== "COMPLETED" && status !== "FAILED";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {inProgress && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      )}
      {label}
    </span>
  );
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioCard({ audio }: { audio: AudioPublic }) {
  return (
    <Link
      href={`/studio/audio/${audio.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition hover:border-violet-500/40"
    >
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{audio.title}</h3>
        <p className="mt-1 text-sm text-slate-400">
          {audio.source_type === "YOUTUBE" ? "🎬 YouTube" : "📁 Archivo"} ·{" "}
          {formatDuration(audio.duration_seconds)}
          {audio.visibility === "PUBLIC" && (
            <span className="ml-2 text-cyan-400">{audio.is_approved ? "Pública" : "En moderación"}</span>
          )}
        </p>
      </div>
      <StatusBadge status={audio.status} />
    </Link>
  );
}
