"""Extracción de audio desde YouTube con yt-dlp.

Módulo puro de procesamiento: no conoce la base de datos ni la API.
Recibe rutas/URLs y devuelve rutas de archivos locales.
"""

from pathlib import Path

import yt_dlp


def download_audio(url: str, output_dir: Path) -> Path:
    """Descarga el mejor audio disponible de una URL de YouTube.

    Args:
        url: URL del video (ya validada como dominio de YouTube por la API).
        output_dir: Directorio de trabajo temporal del worker.

    Returns:
        Ruta al archivo de audio extraído (formato original del stream).

    Raises:
        yt_dlp.utils.DownloadError: video no disponible, privado o geo-bloqueado.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    options = {
        "format": "bestaudio/best",
        "outtmpl": str(output_dir / "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=True)
        return Path(ydl.prepare_filename(info))
