"use client";

/**
 * Ingesta de audio: tab YouTube (URL) o tab archivo (drag & drop + progreso).
 * Al registrar el audio se redirige a su detalle, donde se ve el pipeline en vivo.
 */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ApiError, createFromYouTube, uploadAudio } from "@/lib/api";

type Tab = "youtube" | "upload";
type Visibility = "PUBLIC" | "PRIVATE";

const inputClasses =
  "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-violet-500";

function VisibilityPicker({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  return (
    <fieldset className="flex gap-4 text-sm">
      <legend className="mb-1">Visibilidad</legend>
      {(
        [
          ["PRIVATE", "🔒 Privado (solo tú)"],
          ["PUBLIC", "🌐 Público (pasa por moderación)"],
        ] as const
      ).map(([option, label]) => (
        <label key={option} className="flex items-center gap-2">
          <input
            type="radio"
            name="visibility"
            checked={value === option}
            onChange={() => onChange(option)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

export default function NewAudioPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("youtube");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Tab YouTube
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  // Tab upload
  const [file, setFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fail = (err: unknown) => {
    setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    setSubmitting(false);
    setProgress(null);
  };

  const submitYouTube = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const audio = await createFromYouTube(title, url, visibility);
      router.push(`/studio/audio/${audio.id}`);
    } catch (err) {
      fail(err);
    }
  };

  const submitUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Selecciona o arrastra un archivo de audio");
      return;
    }
    setError(null);
    setSubmitting(true);
    setProgress(0);
    try {
      const audio = await uploadAudio(file, {
        title: uploadTitle || undefined,
        visibility,
        onProgress: setProgress,
      });
      router.push(`/studio/audio/${audio.id}`);
    } catch (err) {
      fail(err);
    }
  };

  const acceptFile = (candidate: File | undefined) => {
    if (candidate) {
      setFile(candidate);
      setError(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Nuevo audio</h1>
      <p className="mt-1 text-slate-400">
        Se mejorará con IA y se convertirá a audio 3D automáticamente.
      </p>

      {/* Tabs */}
      <div className="mt-6 flex rounded-lg border border-slate-800 p-1 text-sm font-medium">
        {(
          [
            ["youtube", "🎬 URL de YouTube"],
            ["upload", "📁 Subir archivo"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setError(null);
            }}
            className={`flex-1 rounded-md px-4 py-2 transition ${
              tab === key ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "youtube" ? (
        <form onSubmit={submitYouTube} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Título
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            URL de YouTube
            <input
              type="url"
              required
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={inputClasses}
            />
          </label>
          <VisibilityPicker value={visibility} onChange={setVisibility} />
          {error && (
            <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-violet-600 px-4 py-2.5 font-semibold transition hover:bg-violet-500 disabled:opacity-50"
          >
            {submitting ? "Registrando…" : "Procesar audio"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitUpload} className="mt-6 flex flex-col gap-4">
          <label
            htmlFor="audio-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptFile(e.dataTransfer.files[0]);
            }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging ? "border-violet-500 bg-violet-500/10" : "border-slate-700 hover:border-slate-500"
            }`}
          >
            <span className="text-3xl" aria-hidden>
              🎵
            </span>
            {file ? (
              <p className="font-medium">{file.name}</p>
            ) : (
              <p className="text-slate-400">
                Arrastra un archivo aquí o <span className="text-violet-400">haz clic para elegir</span>
              </p>
            )}
            <p className="text-xs text-slate-500">mp3, wav, flac, m4a, ogg, aac, opus, wma</p>
            <input
              id="audio-file"
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aac,.opus,.wma"
              className="sr-only"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Título (opcional; por defecto el nombre del archivo)
            <input
              type="text"
              maxLength={200}
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className={inputClasses}
            />
          </label>
          <VisibilityPicker value={visibility} onChange={setVisibility} />
          {progress !== null && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">Subiendo… {progress}%</p>
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !file}
            className="rounded-lg bg-violet-600 px-4 py-2.5 font-semibold transition hover:bg-violet-500 disabled:opacity-50"
          >
            {submitting ? "Subiendo…" : "Subir y procesar"}
          </button>
        </form>
      )}
    </div>
  );
}
