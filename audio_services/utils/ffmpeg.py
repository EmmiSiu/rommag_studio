"""Utilidades FFmpeg: conversión de formatos y lectura de metadatos.

Todas las llamadas usan subprocess con lista de argumentos (nunca
shell=True) para evitar inyección de comandos.
"""

import json
import subprocess
from pathlib import Path


def convert_to_wav(input_path: Path, output_path: Path, sample_rate: int = 44100) -> Path:
    """Normaliza cualquier formato de entrada a WAV PCM (entrada del pipeline de IA)."""
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(input_path),
            "-ar", str(sample_rate),
            "-ac", "2",
            "-c:a", "pcm_s16le",
            str(output_path),
        ],
        check=True,
        capture_output=True,
    )
    return output_path


def probe_metadata(input_path: Path) -> dict:
    """Lee duración, sample rate y formato con ffprobe.

    Returns:
        Dict con claves: duration_seconds (float), sample_rate (int), format (str).
    """
    result = subprocess.run(
        [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format", "-show_streams",
            str(input_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    data = json.loads(result.stdout)
    audio_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})
    return {
        "duration_seconds": float(data.get("format", {}).get("duration", 0.0)),
        "sample_rate": int(audio_stream.get("sample_rate", 0)),
        "format": data.get("format", {}).get("format_name", "unknown"),
    }
