import type { Metadata } from "next";

import { PublicPlaylistClient } from "./playlist-client";

type PublicPlaylistMetadata = {
  title: string;
  description: string | null;
  items_count: number;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

async function fetchPlaylistMetadata(id: string): Promise<PublicPlaylistMetadata | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const response = await fetch(`${apiUrl}/api/v1/playlists/public/${id}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicPlaylistMetadata;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const playlist = await fetchPlaylistMetadata(id);
  if (!playlist) {
    return {
      title: "Colección pública | Audio Inmersivo",
      description: "Playlist pública moderada en Audio Inmersivo.",
    };
  }

  const description =
    playlist.description ?? `${playlist.items_count} audios espacializados en una colección pública moderada.`;

  return {
    title: `${playlist.title} | Audio Inmersivo`,
    description,
    openGraph: {
      title: playlist.title,
      description,
      type: "music.playlist",
    },
  };
}

export default function PublicPlaylistPage() {
  return <PublicPlaylistClient />;
}
