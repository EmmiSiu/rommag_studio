import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build standalone: imagen Docker mínima (solo lo necesario para `node server.js`)
  output: "standalone",
  // TODO(pwa): integrar @serwist/next para service worker con caché offline.
  // El manifest.json ya está enlazado desde app/layout.tsx.
};

export default nextConfig;
