"""Mejora de audio con IA: separación de fuentes (Demucs) y reducción de ruido.

Módulo puro de procesamiento: recibe y devuelve rutas de archivos locales.
Los modelos se cachean en ~/.cache (volumen `model_cache` en Docker).

Los imports pesados (demucs/torch, noisereduce) ocurren DENTRO de las
funciones: este módulo puede importarse desde la API (que no instala
requirements-audio.txt) sin arrastrar PyTorch.
"""

from pathlib import Path


def separate_sources(input_path: Path, output_dir: Path, model: str = "htdemucs") -> dict[str, Path]:
    """Separa un audio en stems (vocals, drums, bass, other) con Demucs.

    Args:
        input_path: Archivo de audio de entrada (WAV normalizado).
        output_dir: Directorio donde escribir los stems.
        model: Modelo Demucs a usar (htdemucs es el default recomendado).

    Returns:
        Mapa nombre-de-stem -> ruta del archivo WAV generado.

    Raises:
        RuntimeError: si Demucs no produce ningún stem.
    """
    from demucs import separate as demucs_separate

    output_dir.mkdir(parents=True, exist_ok=True)
    demucs_separate.main(
        [
            "-n", model,
            "-o", str(output_dir),
            "--filename", "{stem}.{ext}",
            str(input_path),
        ]
    )

    # Demucs escribe en <output_dir>/<model>/<stem>.wav
    stems_dir = output_dir / model
    stems = {p.stem: p for p in sorted(stems_dir.glob("*.wav"))}
    if not stems:
        raise RuntimeError(f"Demucs no generó stems en {stems_dir}")
    return stems


def reduce_noise(input_path: Path, output_path: Path, prop_decrease: float = 0.5) -> Path:
    """Aplica reducción de ruido espectral conservadora al audio completo.

    `prop_decrease=0.5` atenúa el ruido a la mitad en vez de eliminarlo:
    la reducción agresiva introduce artefactos audibles en música.

    Returns:
        Ruta del audio limpio (mismo sample rate y canales que la entrada).
    """
    import noisereduce as nr
    import soundfile as sf

    data, sample_rate = sf.read(input_path, always_2d=True)
    # noisereduce espera (canales, muestras); soundfile entrega (muestras, canales)
    reduced = nr.reduce_noise(
        y=data.T,
        sr=sample_rate,
        stationary=True,
        prop_decrease=prop_decrease,
    )
    sf.write(output_path, reduced.T, sample_rate)
    return output_path
