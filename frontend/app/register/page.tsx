"use client";

/** Registro con validación en cliente (espejo de UserCreate del backend). */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Nav } from "@/components/nav";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      await register(email, password, displayName);
      router.push("/studio/library");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
      setSubmitting(false);
    }
  };

  const inputClasses =
    "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-violet-500";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Nav />
      <main className="mx-auto flex max-w-5xl justify-center px-6 py-16">
        <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
          <h1 className="text-2xl font-bold">Crear cuenta</h1>
          <label className="flex flex-col gap-1 text-sm">
            Nombre visible
            <input
              type="text"
              required
              minLength={2}
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Contraseña (mínimo 8 caracteres)
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Confirmar contraseña
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClasses}
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
            {submitting ? "Creando cuenta…" : "Crear cuenta"}
          </button>
          <p className="text-sm text-slate-400">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-violet-400 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
