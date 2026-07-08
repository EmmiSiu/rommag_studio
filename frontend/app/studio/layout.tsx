"use client";

/**
 * Shell de las pantallas privadas. El middleware ya bloquea sin cookie;
 * este guard cubre el caso de sesión expirada/revocada (defensa en capas).
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        {loading || !user ? (
          <p className="py-16 text-center text-slate-400">Cargando sesión…</p>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
