"""Mejora de audio con IA: separación de fuentes (Demucs) y reducción de ruido.

Módulo puro de procesamiento: recibe y devuelve rutas de archivos locales.
Los modelos se cachean en ~/.cache (volumen `model_cache` en Docker).
"""

from pathlib import Path


def separate_sources(input_path: Path, output_dir: Path, model: str = "htdemucs") -> dict[str, Path]:
    """Separa un audio en stems (vocals, drums, bass, other) con Demucs.

    Args:
        input_path: Archivo de audio de entrada.
        output_dir: Directorio donde escribir los stems.
        model: Modelo Demucs a usar (htdemucs es el default recomendado).

    Returns:
        Mapa nombre-de-stem -> ruta del archivo generado.
    """
    # TODO(demucs): invocar demucs.separate (API Python) o subprocess
    #   `python -m demucs --two-stems=vocals -n {model} -o {output_dir} {input_path}`
    #   y devolver las rutas de los stems generados.
    raise NotImplementedError("Separación con Demucs pendiente de implementación")


def reduce_noise(input_path: Path, output_path: Path) -> Path:
    """Aplica reducción de ruido al audio completo.

    Returns:
        Ruta del audio limpio.
    """
    # TODO(denoise): implementar con noisereduce o el stem "other" de Demucs.
    raise NotImplementedError("Reducción de ruido pendiente de implementación")
