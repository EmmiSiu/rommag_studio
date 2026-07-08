import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Gauge,
  Headphones,
  Library,
  Lock,
  Radio,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";

import { Nav } from "@/components/nav";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const WORD_RAIL = ["INGESTA", "DENOISE", "STEMS", "BINAURAL", "AMBIX", "PRIVACY", "PWA"];

const CAPABILITIES: Feature[] = [
  {
    icon: Upload,
    title: "Ingesta flexible",
    description: "YouTube o archivos locales con validación real de contenido, límites por streaming y claves UUID.",
  },
  {
    icon: Cpu,
    title: "Mejora con IA",
    description: "Denoise conservador y separación de fuentes con Demucs para voces, batería, bajo y otros stems.",
  },
  {
    icon: Headphones,
    title: "Audio espacial",
    description: "Render binaural para audífonos y Ambisonics AmbiX para flujos de escucha avanzados.",
  },
  {
    icon: ShieldCheck,
    title: "Control propio",
    description: "Stack auto-alojado con PostgreSQL, Redis, MinIO, JWT rotado y moderación de contenido público.",
  },
];

const PIPELINE = [
  { label: "Input", detail: "URL o upload", icon: Upload },
  { label: "Enhance", detail: "IA + stems", icon: SlidersHorizontal },
  { label: "Spatial", detail: "Binaural + AmbiX", icon: Waves },
  { label: "Library", detail: "Privado o público", icon: Library },
] satisfies Array<{ label: string; detail: string; icon: LucideIcon }>;

const METRICS = [
  { value: "6", label: "servicios Docker" },
  { value: "4", label: "stems por pista" },
  { value: "2", label: "renders 3D" },
  { value: "100%", label: "self-hosted" },
] as const;

const SHOWCASE = [
  {
    title: "Studio workflow",
    copy: "Sube, observa cada etapa del pipeline y reproduce el mejor render disponible sin tocar la API a mano.",
    icon: Gauge,
  },
  {
    title: "Moderación real",
    copy: "La biblioteca pública solo muestra contenido aprobado, con panel superadmin y auditoría mínima.",
    icon: Users,
  },
  {
    title: "Operación privada",
    copy: "DB y Redis permanecen internos; MinIO entrega URLs prefirmadas con expiración controlada.",
    icon: Lock,
  },
] satisfies Array<{ title: string; copy: string; icon: LucideIcon }>;

function ProductScene() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
      <div className="absolute left-1/2 top-24 h-[560px] w-[920px] -translate-x-1/2 rounded-[48px] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(17,24,39,0.18)_44%,rgba(16,185,129,0.12))] shadow-2xl shadow-cyan-950/30" />
      <div className="absolute left-1/2 top-36 grid w-[min(980px,92vw)] -translate-x-1/2 grid-cols-12 gap-3 opacity-80">
        <div className="col-span-12 rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-2xl shadow-black/40 md:col-span-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Processing desk</p>
              <p className="mt-1 text-sm text-white">midnight-session.wav</p>
            </div>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
              COMPLETED
            </span>
          </div>
          <div className="mt-5 flex h-36 items-end gap-1.5">
            {Array.from({ length: 42 }).map((_, index) => (
              <span
                key={index}
                className="flex-1 rounded-full bg-cyan-200/70"
                style={{ height: `${18 + ((index * 29) % 78)}%` }}
              />
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {["vocals", "drums", "bass", "other"].map((stem, index) => (
              <div key={stem} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>{stem}</span>
                  <span>{index === 0 ? "front" : index === 1 ? "rear" : "wide"}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-200 to-emerald-200"
                    style={{ width: `${58 + index * 10}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-2xl shadow-black/30 md:col-span-4 md:block">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-200/70">Spatial map</p>
          <div className="relative mt-5 aspect-square rounded-full border border-cyan-200/20 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:18px_18px]">
            {[
              ["V", "left-[46%] top-[18%] bg-cyan-200"],
              ["D", "left-[22%] top-[58%] bg-emerald-200"],
              ["B", "left-[50%] top-[48%] bg-amber-200"],
              ["O", "left-[70%] top-[35%] bg-fuchsia-200"],
            ].map(([label, classes]) => (
              <span
                key={label}
                className={`absolute flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-slate-950 ${classes}`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#070914] text-slate-100">
      <Nav />

      <section className="relative isolate flex min-h-[calc(100vh-65px)] items-center overflow-hidden px-5 py-16 sm:px-6 md:py-20">
        <ProductScene />
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
          <div className="mb-8 flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 shadow-xl shadow-black/20 backdrop-blur">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-md object-contain"
            />
            <span>AI audio mastering, spatial rendering and private deployment</span>
          </div>
          <h1 className="max-w-5xl text-5xl font-semibold leading-[0.95] tracking-normal text-white sm:text-7xl lg:text-8xl">
            Immersive audio studio for self-hosted creators.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Clean noise, split stems and render spatial audio from YouTube or local files.
            Keep the full pipeline in your own infrastructure, from ingestion to playback.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:bg-cyan-200"
            >
              Crear cuenta
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-5 py-3 font-semibold text-white backdrop-blur transition hover:border-white/30"
            >
              Explorar biblioteca
              <Radio className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-white/10 bg-white/[0.03] py-4">
        <div className="ai-word-rail-track flex w-max gap-10 text-sm font-semibold uppercase tracking-[0.45em] text-slate-400">
          {[...WORD_RAIL, ...WORD_RAIL, ...WORD_RAIL].map((word, index) => (
            <span key={`${word}-${index}`}>{word}</span>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-4xl font-semibold text-white">{metric.value}</p>
            <p className="mt-2 text-sm text-slate-400">{metric.label}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">Capabilities</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
            Production workflow without surrendering your audio.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {CAPABILITIES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <Icon className="h-6 w-6 text-cyan-200" aria-hidden />
                <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 leading-7 text-slate-400">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(15,23,42,0.72),rgba(16,185,129,0.10))] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-emerald-200">Pipeline</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold text-white sm:text-5xl">
                From raw source to spatial master in one observable flow.
              </h2>
            </div>
            <Server className="h-10 w-10 text-emerald-200" aria-hidden />
          </div>
          <div className="mt-10 grid gap-3 lg:grid-cols-4">
            {PIPELINE.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="relative rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-cyan-200" aria-hidden />
                    <span className="text-xs text-slate-500">0{index + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-white">{step.label}</h3>
                  <p className="mt-1 text-sm text-slate-400">{step.detail}</p>
                  <CheckCircle2 className="mt-6 h-5 w-5 text-emerald-200" aria-hidden />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-4 lg:grid-cols-3">
          {SHOWCASE.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <Icon className="h-6 w-6 text-amber-200" aria-hidden />
                <h3 className="mt-5 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 leading-7 text-slate-400">{item.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center sm:px-10">
          <Database className="mx-auto h-9 w-9 text-cyan-200" aria-hidden />
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold text-white sm:text-5xl">
            Own the pipeline. Publish only what you approve.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400">
            Audio Inmersivo is built for creators, studios and communities that need AI audio tools
            with operational control, privacy and professional playback.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100"
            >
              Empezar ahora
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:border-white/35"
            >
              Entrar al studio
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-slate-500">
        Audio Inmersivo. Open source spatial audio infrastructure.
      </footer>
    </main>
  );
}
