"use client";

/** Barra de navegación global: refleja el estado de sesión. */

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";

export function Nav() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="font-bold tracking-tight">
          🎵 Audio<span className="text-violet-400">Inmersivo</span>
        </Link>
        <div className="flex items-center gap-2 text-sm sm:gap-4">
          <Link href="/library" className="rounded px-2 py-1 text-slate-300 hover:text-white">
            Biblioteca pública
          </Link>
          {loading ? null : user ? (
            <>
              <Link href="/studio/library" className="rounded px-2 py-1 text-slate-300 hover:text-white">
                Mi biblioteca
              </Link>
              {user.role === "SUPERADMIN" && (
                <Link href="/studio/admin" className="rounded px-2 py-1 text-amber-300 hover:text-amber-200">
                  Admin
                </Link>
              )}
              <Link
                href="/studio/new"
                className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold hover:bg-violet-500"
              >
                + Nuevo audio
              </Link>
              <button
                onClick={handleLogout}
                className="rounded px-2 py-1 text-slate-400 hover:text-white"
                title={user.email}
              >
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
                className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold hover:bg-violet-500"
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
