/** Página de cortesía servida por el service worker cuando no hay conexión. */

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span aria-hidden className="text-6xl">📡</span>
      <h1 className="text-2xl font-bold">Sin conexión</h1>
      <p className="max-w-sm text-slate-400">
        No hay internet ahora mismo. Tu biblioteca y tus audios siguen a salvo —
        vuelve a intentarlo cuando recuperes la conexión.
      </p>
    </main>
  );
}
