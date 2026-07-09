"use client";

/** Barra de navegación global: refleja el estado de sesión. */

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ListMusic, LogOut, Plus } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

export function Nav() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070914]/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-contain"
          />
          <span>Audio Inmersivo</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm sm:gap-3">
          <Link href="/library" className="rounded px-2 py-1 text-slate-300 transition hover:text-white">
            Biblioteca pública
          </Link>
          {loading ? null : user ? (
            <>
              <Link href="/studio/library" className="rounded px-2 py-1 text-slate-300 transition hover:text-white">
                Mi biblioteca
              </Link>
              <Link href="/studio/playlists" className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-300 transition hover:text-white">
                <ListMusic className="h-4 w-4" aria-hidden />
                Playlists
              </Link>
              {user.role === "SUPERADMIN" && (
                <Link href="/studio/admin" className="rounded px-2 py-1 text-amber-300 transition hover:text-amber-200">
                  Admin
                </Link>
              )}
              <Link
                href="/studio/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-300 px-3 py-1.5 font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Nuevo audio
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-slate-400 transition hover:text-white"
                title={user.email}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded px-2 py-1 text-slate-300 hover:text-white">
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-cyan-300 px-3 py-1.5 font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
