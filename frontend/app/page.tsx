import Link from "next/link";

import { Nav } from "@/components/nav";

/**
 * Landing page pública de Audio Inmersivo.
 * Server Component: no necesita estado ni interactividad de cliente.
 */

const FEATURES = [
  {
    icon: "🎬",
    title: "YouTube o archivos locales",
    description:
      "Pega una URL de YouTube o sube tu audio en cualquier formato: mp3, wav, flac, m4a, ogg y más.",
  },
  {
    icon: "🤖",
    title: "Mejora con IA",
    description:
      "Reducción de ruido y separación de fuentes con Demucs: voces, batería, bajo e instrumentos por separado.",
  },
  {
    icon: "🎧",
    title: "Audio 3D inmersivo",
    description:
      "Convierte cualquier pista a binaural para audífonos o Ambisonics para altavoces. Sonido que te rodea.",
  },
  {
    icon: "📚",
    title: "Tu biblioteca, tus reglas",
    description:
      "Guarda tus audios en privado o compártelos con la comunidad en la biblioteca pública moderada.",
  },
] as const;

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Nav />
      {/* Hero */}
      <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 pt-24 pb-16 text-center">
        <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-1 text-sm text-violet-300">
          100% auto-alojado · Sin límites · Sin nube
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Tu música, mejorada con IA y en{" "}
          <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            audio 3D
          </span>
        </h1>
        <p className="max-w-2xl text-lg text-slate-400">
          Audio Inmersivo limpia, separa y espacializa cualquier audio desde
          YouTube o tus archivos. Todo procesado en tu propio servidor.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-violet-600 px-6 py-3 font-semibold transition hover:bg-violet-500"
          >
            Crear cuenta
          </Link>
          <Link
            href="/library"
            className="rounded-lg border border-slate-700 px-6 py-3 font-semibold transition hover:border-slate-500"
          >
            Explorar biblioteca pública
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-violet-500/40"
          >
            <span className="text-3xl" aria-hidden>
              {feature.icon}
            </span>
            <h2 className="mt-3 text-xl font-semibold">{feature.title}</h2>
            <p className="mt-2 text-slate-400">{feature.description}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        Audio Inmersivo · Código abierto · Hecho con ❤️ para la comunidad
      </footer>
    </main>
  );
}
