import type { Metadata, Viewport } from "next";
import "./globals.css";

import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: {
    default: "Audio Inmersivo",
    template: "%s · Audio Inmersivo",
  },
  description:
    "Plataforma auto-alojada para mejorar audio con IA y convertirlo a 3D inmersivo (binaural, Ambisonics).",
  manifest: "/manifest.json",
  // iOS ignora el manifest para el icono de "Añadir a pantalla de inicio"
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Audio Inmersivo",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0a1e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
