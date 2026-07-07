"""Espacialización de audio: binaural y Ambisonics (spaudiopy).

Módulo puro de procesamiento: recibe y devuelve rutas de archivos locales.
"""

from pathlib import Path


def to_binaural(input_path: Path, output_path: Path) -> Path:
    """Convierte un audio (idealmente stems separados) a binaural para audífonos.

    Estrategia inicial: posicionar cada stem en el campo sonoro (voz al
    frente, batería atrás, etc.) y renderizar con HRTF vía spaudiopy.

    Returns:
        Ruta del archivo binaural (WAV estéreo).
    """
    # TODO(spatial): implementar con spaudiopy (decodificación HRTF).
    #   Evaluar USAT para traducción entre formatos espaciales.
    raise NotImplementedError("Render binaural pendiente de implementación")


def to_ambisonics(input_path: Path, output_path: Path, order: int = 1) -> Path:
    """Codifica el audio a Ambisonics de orden N (para altavoces).

    Returns:
        Ruta del archivo Ambisonics (WAV multicanal, formato AmbiX).
    """
    # TODO(spatial): codificación B-format con spaudiopy.
    raise NotImplementedError("Codificación Ambisonics pendiente de implementación")
