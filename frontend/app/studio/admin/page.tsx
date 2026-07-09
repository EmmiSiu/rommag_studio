"use client";

/**
 * Panel de superadmin: métricas, gestión de usuarios y cola de moderación.
 * El rol se verifica en el backend en cada request; el check de UI solo
 * evita renderizar un panel que devolvería 403.
 */

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, ListMusic, Play, Users, type LucideIcon } from "lucide-react";

import { StatusBadge, formatDuration } from "@/components/audio-card";
import {
  ApiError,
  deleteUser,
  getMetrics,
  getStreamUrl,
  listModerationQueue,
  listPlaylistModerationQueue,
  listUsers,
  moderateAudio,
  moderatePlaylist,
  updateUser,
  type AudioPublic,
  type PlaylistPublic,
  type SystemMetrics,
  type UserPublic,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Tab = "metrics" | "users" | "moderation";

const ADMIN_TABS = [
  { key: "metrics", label: "Métricas", icon: BarChart3 },
  { key: "users", label: "Usuarios", icon: Users },
  { key: "moderation", label: "Moderación", icon: CheckCircle2 },
] satisfies Array<{ key: Tab; label: string; icon: LucideIcon }>;

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("metrics");
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [queue, setQueue] = useState<AudioPublic[]>([]);
  const [playlistQueue, setPlaylistQueue] = useState<PlaylistPublic[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [m, u, q, pq] = await Promise.all([
        getMetrics(),
        listUsers(),
        listModerationQueue(),
        listPlaylistModerationQueue(),
      ]);
      setMetrics(m);
      setUsers(u);
      setQueue(q);
      setPlaylistQueue(pq);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el panel");
    }
  }, []);

  useEffect(() => {
    if (user?.role === "SUPERADMIN") void load();
  }, [user, load]);

  if (user && user.role !== "SUPERADMIN") {
    return <p className="py-16 text-center text-slate-400">Este panel requiere rol SUPERADMIN.</p>;
  }

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La acción falló");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Panel de administración</h1>

      <div className="mt-6 flex rounded-lg border border-slate-800 p-1 text-sm font-medium">
        {ADMIN_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 transition ${
              tab === key ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
            {key === "moderation" && queue.length + playlistQueue.length > 0
              ? ` (${queue.length + playlistQueue.length})`
              : null}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Métricas */}
      {tab === "metrics" && metrics && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Usuarios" value={`${metrics.active_users} / ${metrics.total_users}`} hint="activos / total" />
          <MetricCard label="Audios listos" value={String(metrics.audios_by_status.COMPLETED ?? 0)} hint="COMPLETED" />
          <MetricCard
            label="En proceso"
            value={String(
              (metrics.audios_by_status.PENDING ?? 0) +
                (metrics.audios_by_status.DOWNLOADING ?? 0) +
                (metrics.audios_by_status.ENHANCING ?? 0) +
                (metrics.audios_by_status.SPATIALIZING ?? 0),
            )}
            hint="cola del pipeline"
          />
          <MetricCard label="Fallidos" value={String(metrics.audios_by_status.FAILED ?? 0)} hint="FAILED" />
          <MetricCard label="Pendientes de moderar" value={String(metrics.pending_moderation)} hint="públicos sin aprobar" />
          <MetricCard
            label="Playlists por moderar"
            value={String(metrics.pending_playlist_moderation)}
            hint="colecciones públicas"
          />
          <MetricCard
            label="Audio procesado"
            value={`${Math.round(metrics.total_audio_seconds / 60)} min`}
            hint="duración acumulada"
          />
        </div>
      )}

      {/* Usuarios */}
      {tab === "users" && (
        <div className="mt-6 flex flex-col gap-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {u.display_name}{" "}
                  {u.role === "SUPERADMIN" && <span className="text-xs text-amber-400">ADMIN</span>}
                  {!u.is_active && <span className="text-xs text-red-400"> · desactivado</span>}
                </p>
                <p className="truncate text-sm text-slate-400">{u.email}</p>
              </div>
              {u.id !== user?.id && (
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => void act(() => updateUser(u.id, { is_active: !u.is_active }))}
                    className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-300 hover:border-slate-500"
                  >
                    {u.is_active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() =>
                      void act(() =>
                        updateUser(u.id, { role: u.role === "SUPERADMIN" ? "USER" : "SUPERADMIN" }),
                      )
                    }
                    className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-300 hover:border-slate-500"
                  >
                    {u.role === "SUPERADMIN" ? "Quitar admin" : "Hacer admin"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar a ${u.email} y todos sus audios?`)) {
                        void act(() => deleteUser(u.id));
                      }
                    }}
                    className="rounded-lg border border-red-500/40 px-2.5 py-1.5 text-red-300 hover:bg-red-500/10"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Moderación */}
      {tab === "moderation" && (
        <div className="mt-6 flex flex-col gap-2">
          {queue.length === 0 && playlistQueue.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No hay contenido pendiente de moderación.</p>
          ) : (
            <>
              {queue.length > 0 && <h2 className="mt-2 text-sm font-semibold text-slate-300">Audios</h2>}
              {queue.map((audio) => (
                <div
                  key={audio.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{audio.title}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {formatDuration(audio.duration_seconds)} · <StatusBadge status={audio.status} />
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() =>
                        void act(async () => {
                          const { url } = await getStreamUrl(audio.id, "auto");
                          window.open(url, "_blank", "noopener");
                        })
                      }
                      className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-300 hover:border-slate-500"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Play className="h-3.5 w-3.5" aria-hidden />
                        Escuchar
                      </span>
                    </button>
                    <button
                      onClick={() => void act(() => moderateAudio(audio.id, true))}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-500"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt("Motivo del rechazo (opcional):") ?? undefined;
                        void act(() => moderateAudio(audio.id, false, reason));
                      }}
                      className="rounded-lg border border-red-500/40 px-2.5 py-1.5 text-red-300 hover:bg-red-500/10"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}

              {playlistQueue.length > 0 && <h2 className="mt-4 text-sm font-semibold text-slate-300">Playlists</h2>}
              {playlistQueue.map((playlist) => (
                <div
                  key={playlist.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{playlist.title}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-400">
                      <ListMusic className="h-4 w-4" aria-hidden />
                      {playlist.items_count} audios
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => void act(() => moderatePlaylist(playlist.id, true))}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-500"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt("Motivo del rechazo (opcional):") ?? undefined;
                        void act(() => moderatePlaylist(playlist.id, false, reason));
                      }}
                      className="rounded-lg border border-red-500/40 px-2.5 py-1.5 text-red-300 hover:bg-red-500/10"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
