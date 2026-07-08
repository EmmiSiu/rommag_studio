import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // En dev el SW estorba (cachea en caliente); solo activo en producción
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Build standalone: imagen Docker mínima (solo lo necesario para `node server.js`)
  output: "standalone",
  // Raíz explícita del workspace: evita que Next infiera una equivocada
  // si existen otros lockfiles fuera del repo.
  outputFileTracingRoot: __dirname,
};

export default withSerwist(nextConfig);
