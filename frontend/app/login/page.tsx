"use client";

/** Login con manejo de errores legibles (credenciales, cuenta desactivada, rate limit). */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Nav } from "@/components/nav";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : "/studio/library");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Demasiados intentos; espera un minuto y vuelve a probar");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se pudo conectar con el servidor");
      }
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-violet-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-violet-500"
        />
      </label>
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
        {submitting ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-sm text-slate-400">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-violet-400 hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Nav />
      <main className="mx-auto flex max-w-5xl justify-center px-6 py-16">
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
