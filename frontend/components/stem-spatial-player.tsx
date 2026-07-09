"use client";

import { Download, Loader2, Pause, Play, RotateCcw, SlidersHorizontal, Square, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SpatialScene } from "@/components/spatial-scene";
import { ApiError, getStems } from "@/lib/api";
import {
  BUILT_IN_SPATIAL_PRESETS,
  DEFAULT_STEM_ORDER,
  createDefaultPreset,
  effectiveGains,
  mergePresetWithStems,
  migratePreset,
  normalizeStemSettings,
  presetStorageKey,
  serializePreset,
  type SpatialPresetV1,
} from "@/lib/spatial-presets";

type StemSpatialPlayerProps = {
  audioId: string;
  audioTitle: string;
  enabled: boolean;
};

type PlayerStatus = "idle" | "loading" | "ready" | "error";

type StemAudioNode = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: PannerNode;
};

type WebAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const STEM_LABELS: Record<string, string> = {
  vocals: "Voces",
  drums: "Batería",
  bass: "Bajo",
  other: "Otros",
};

const STEM_SWATCHES: Record<string, string> = {
  vocals: "bg-cyan-300",
  drums: "bg-amber-300",
  bass: "bg-emerald-300",
  other: "bg-violet-300",
};

const POSITION_LIMIT = 2;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function sortStemNames(names: string[]): string[] {
  const order = new Map<string, number>(DEFAULT_STEM_ORDER.map((stemName, index) => [stemName, index]));
  return [...names].sort((a, b) => {
    const aOrder = order.get(a) ?? 99;
    const bOrder = order.get(b) ?? 99;
    return aOrder === bOrder ? a.localeCompare(b) : aOrder - bOrder;
  });
}

function labelForStem(stemName: string): string {
  return STEM_LABELS[stemName] ?? stemName;
}

function swatchForStem(stemName: string): string {
  return STEM_SWATCHES[stemName] ?? "bg-sky-300";
}

function setPannerPosition(panner: PannerNode, x: number, z: number): void {
  const nextX = clamp(x, -POSITION_LIMIT, POSITION_LIMIT);
  const nextZ = clamp(z, -POSITION_LIMIT, POSITION_LIMIT);
  if (panner.positionX && panner.positionY && panner.positionZ) {
    panner.positionX.value = nextX;
    panner.positionY.value = 0;
    panner.positionZ.value = nextZ;
  } else {
    panner.setPosition(nextX, 0, nextZ);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "No se pudo cargar el reproductor 3D";
}

export function StemSpatialPlayer({ audioId, audioTitle, enabled }: StemSpatialPlayerProps) {
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stemNames, setStemNames] = useState<string[]>([...DEFAULT_STEM_ORDER]);
  const [preset, setPreset] = useState<SpatialPresetV1>(() => createDefaultPreset());
  const [activeStem, setActiveStem] = useState<string>(DEFAULT_STEM_ORDER[0]);
  const [buffers, setBuffers] = useState<Record<string, AudioBuffer> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Record<string, StemAudioNode>>({});
  const masterRef = useRef<GainNode | null>(null);
  const presetRef = useRef(preset);
  const buffersRef = useRef(buffers);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);
  const endTimerRef = useRef<number | null>(null);
  const persistenceReadyRef = useRef(false);

  const duration = useMemo(() => {
    if (!buffers) return 0;
    return Math.max(0, ...Object.values(buffers).map((buffer) => buffer.duration));
  }, [buffers]);

  const clearEndTimer = useCallback(() => {
    if (endTimerRef.current === null) return;
    window.clearTimeout(endTimerRef.current);
    endTimerRef.current = null;
  }, []);

  const stopGraph = useCallback(() => {
    clearEndTimer();
    Object.values(nodesRef.current).forEach(({ source, gain, panner }) => {
      try {
        source.stop();
      } catch {
        /* Already stopped. */
      }
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
    });
    nodesRef.current = {};
    masterRef.current?.disconnect();
    masterRef.current = null;
  }, [clearEndTimer]);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  useEffect(() => {
    buffersRef.current = buffers;
  }, [buffers]);

  useEffect(() => {
    if (!persistenceReadyRef.current) return;
    localStorage.setItem(presetStorageKey(audioId), serializePreset(preset));
  }, [audioId, preset]);

  useEffect(() => {
    const context = audioContextRef.current;
    const gains = effectiveGains(preset);
    Object.entries(nodesRef.current).forEach(([stemName, node]) => {
      const settings = preset.stems[stemName];
      if (!settings) return;
      const now = context?.currentTime ?? 0;
      node.gain.gain.setTargetAtTime(gains[stemName] ?? 0, now, 0.015);
      setPannerPosition(node.panner, settings.x, settings.z);
    });
  }, [preset]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const context = audioContextRef.current;
      if (context) {
        const current = clamp(context.currentTime - startedAtRef.current, 0, duration);
        offsetRef.current = current;
        setPosition(current);
      }
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(raf);
  }, [duration, isPlaying]);

  useEffect(() => {
    return () => {
      stopGraph();
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, [stopGraph]);

  const ensureAudioContext = useCallback((): AudioContext => {
    const AudioContextCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error("WebAudio no está disponible en este navegador");
    }
    audioContextRef.current ??= new AudioContextCtor();
    return audioContextRef.current;
  }, []);

  const loadStems = useCallback(async () => {
    if (!enabled) return null;
    if (buffersRef.current) return buffersRef.current;

    setStatus("loading");
    setError(null);

    try {
      const context = ensureAudioContext();
      const { stems } = await getStems(audioId);
      const names = sortStemNames(Object.keys(stems));
      if (names.length === 0) throw new Error("El audio no tiene stems disponibles");

      const decodedEntries = await Promise.all(
        names.map(async (stemName) => {
          const response = await fetch(stems[stemName]);
          if (!response.ok) {
            throw new Error(`No se pudo descargar ${labelForStem(stemName)}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
          return [stemName, buffer] as const;
        }),
      );

      const nextBuffers = Object.fromEntries(decodedEntries);
      const stored = localStorage.getItem(presetStorageKey(audioId));
      const nextPreset = migratePreset(stored, names);

      setStemNames(names);
      setActiveStem((current) => (names.includes(current) ? current : names[0]));
      setPreset(nextPreset);
      setBuffers(nextBuffers);
      buffersRef.current = nextBuffers;
      persistenceReadyRef.current = true;
      setStatus("ready");
      return nextBuffers;
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      setStatus("error");
      setIsPlaying(false);
      return null;
    }
  }, [audioId, enabled, ensureAudioContext]);

  const startGraph = useCallback(
    (nextBuffers: Record<string, AudioBuffer>, offset: number) => {
      const context = ensureAudioContext();
      stopGraph();

      const master = context.createGain();
      master.gain.value = 0.94;
      master.connect(context.destination);
      masterRef.current = master;

      const gains = effectiveGains(presetRef.current);
      const nextNodes: Record<string, StemAudioNode> = {};

      Object.entries(nextBuffers).forEach(([stemName, buffer]) => {
        const safeOffset = clamp(offset, 0, Math.max(0, buffer.duration - 0.001));
        const source = context.createBufferSource();
        const gain = context.createGain();
        const panner = context.createPanner();
        const settings = presetRef.current.stems[stemName];

        source.buffer = buffer;
        gain.gain.value = gains[stemName] ?? 0;
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 1;
        panner.maxDistance = 8;
        panner.rolloffFactor = 0.55;
        setPannerPosition(panner, settings?.x ?? 0, settings?.z ?? 0);

        source.connect(gain);
        gain.connect(panner);
        panner.connect(master);
        source.start(0, safeOffset);
        nextNodes[stemName] = { source, gain, panner };
      });

      nodesRef.current = nextNodes;
      startedAtRef.current = context.currentTime - offset;
      const remainingMs = Math.max(0, (duration - offset) * 1000);
      endTimerRef.current = window.setTimeout(() => {
        stopGraph();
        offsetRef.current = 0;
        setPosition(0);
        setIsPlaying(false);
      }, remainingMs + 50);
    },
    [duration, ensureAudioContext, stopGraph],
  );

  const play = async () => {
    const nextBuffers = buffersRef.current ?? (await loadStems());
    if (!nextBuffers) return;

    try {
      const context = ensureAudioContext();
      if (context.state === "suspended") await context.resume();
      const offset = offsetRef.current >= duration ? 0 : offsetRef.current;
      offsetRef.current = offset;
      setPosition(offset);
      startGraph(nextBuffers, offset);
      setIsPlaying(true);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
      setStatus("error");
      setIsPlaying(false);
    }
  };

  const pause = () => {
    const context = audioContextRef.current;
    if (context) {
      const current = clamp(context.currentTime - startedAtRef.current, 0, duration);
      offsetRef.current = current;
      setPosition(current);
    }
    stopGraph();
    setIsPlaying(false);
  };

  const stop = () => {
    stopGraph();
    offsetRef.current = 0;
    setPosition(0);
    setIsPlaying(false);
  };

  const seek = (nextPosition: number) => {
    const next = clamp(nextPosition, 0, duration);
    offsetRef.current = next;
    setPosition(next);
    if (isPlaying && buffersRef.current) {
      startGraph(buffersRef.current, next);
    }
  };

  const updateStem = (stemName: string, partial: Partial<SpatialPresetV1["stems"][string]>) => {
    setPreset((current) =>
      mergePresetWithStems(
        {
          version: 1,
          stems: {
            ...current.stems,
            [stemName]: normalizeStemSettings({
              ...current.stems[stemName],
              ...partial,
            }),
          },
        },
        stemNames,
      ),
    );
  };

  const applyBuiltInPreset = (presetName: string) => {
    const builtIn = BUILT_IN_SPATIAL_PRESETS.find((item) => item.name === presetName);
    if (!builtIn) return;
    setPreset(mergePresetWithStems(builtIn.create(stemNames), stemNames));
  };

  const resetPreset = () => {
    setPreset(createDefaultPreset(stemNames));
  };

  const exportPreset = () => {
    const blob = new Blob([serializePreset(preset)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${audioTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "audio"}-spatial-preset.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!enabled) return null;

  const ready = buffers !== null;
  const loading = status === "loading";

  return (
    <section
      className="mt-8"
      data-stage9-player
      data-stage9-ready={ready ? "true" : "false"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Stage 9</p>
          <h2 className="mt-1 text-xl font-semibold">Reproductor 3D interactivo</h2>
          <p className="mt-1 text-sm text-slate-400">
            {ready ? `${stemNames.length} stems cargados` : "Carga stems separados para mezclarlos en el navegador"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!ready && (
            <button
              onClick={() => void loadStems()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-300 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <SlidersHorizontal className="h-4 w-4" aria-hidden />}
              Cargar stems 3D
            </button>
          )}
          {ready && (
            <>
              <button
                onClick={() => (isPlaying ? pause() : void play())}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-300 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                {isPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                {isPlaying ? "Pausar" : "Reproducir"}
              </button>
              <button
                onClick={stop}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500"
              >
                <Square className="h-4 w-4" aria-hidden />
                Detener
              </button>
              <button
                onClick={exportPreset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500"
              >
                <Download className="h-4 w-4" aria-hidden />
                Exportar preset
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}. Puedes usar el reproductor de render como alternativa.
        </p>
      )}

      <div className="mt-5">
        <SpatialScene
          preset={preset}
          activeStem={activeStem}
          onActiveStemChange={setActiveStem}
          onPositionChange={(stemName, positionChange) => updateStem(stemName, positionChange)}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {ready && (
            <label className="block rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <span className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>{formatTime(position)}</span>
                <span>{formatTime(duration)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0.01)}
                step={0.05}
                value={position}
                onChange={(event) => seek(Number(event.target.value))}
                className="mt-2 w-full accent-cyan-300"
                aria-label="Posición de reproducción 3D"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            {BUILT_IN_SPATIAL_PRESETS.map((item) => (
              <button
                key={item.name}
                onClick={() => applyBuiltInPreset(item.name)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-cyan-300 hover:text-cyan-100"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={resetPreset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reiniciar
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {stemNames.map((stemName) => {
            const settings = preset.stems[stemName];
            if (!settings) return null;
            const active = activeStem === stemName;
            return (
              <div
                key={stemName}
                className={`rounded-lg border p-3 transition ${
                  active ? "border-cyan-300/70 bg-cyan-300/10" : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setActiveStem(stemName)}
                    className="inline-flex min-w-0 items-center gap-2 text-left text-sm font-semibold text-slate-100"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${swatchForStem(stemName)}`} aria-hidden />
                    <span className="truncate">{labelForStem(stemName)}</span>
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateStem(stemName, { muted: !settings.muted })}
                      title={settings.muted ? "Activar stem" : "Silenciar stem"}
                      className={`rounded-md p-1.5 transition ${
                        settings.muted ? "bg-red-500/20 text-red-200" : "text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {settings.muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                      <span className="sr-only">{settings.muted ? "Activar" : "Silenciar"}</span>
                    </button>
                    <button
                      onClick={() => updateStem(stemName, { solo: !settings.solo })}
                      title={settings.solo ? "Quitar solo" : "Solo"}
                      className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                        settings.solo ? "bg-amber-300 text-slate-950" : "text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      S
                    </button>
                  </div>
                </div>

                <label className="mt-3 block text-xs text-slate-400">
                  Volumen
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={settings.volume}
                    onChange={(event) => updateStem(stemName, { volume: Number(event.target.value) })}
                    className="mt-1 w-full accent-cyan-300"
                  />
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block text-xs text-slate-400">
                    X
                    <input
                      type="range"
                      min={-POSITION_LIMIT}
                      max={POSITION_LIMIT}
                      step={0.05}
                      value={settings.x}
                      onChange={(event) => updateStem(stemName, { x: Number(event.target.value) })}
                      className="mt-1 w-full accent-cyan-300"
                    />
                  </label>
                  <label className="block text-xs text-slate-400">
                    Z
                    <input
                      type="range"
                      min={-POSITION_LIMIT}
                      max={POSITION_LIMIT}
                      step={0.05}
                      value={settings.z}
                      onChange={(event) => updateStem(stemName, { z: Number(event.target.value) })}
                      className="mt-1 w-full accent-cyan-300"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
