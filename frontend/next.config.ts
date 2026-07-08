import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build standalone: imagen Docker mínima (solo lo necesario para `node server.js`)
  output: "standalone",
  // Raíz explícita del workspace: evita que Next infiera una equivocada
  // si existen otros lockfiles fuera del repo.
  outputFileTracingRoot: __dirname,
  // TODO(pwa): integrar @serwist/next para service worker con caché offline.
  // El manifest.json ya está enlazado desde app/layout.tsx.
};

export default nextConfig;
