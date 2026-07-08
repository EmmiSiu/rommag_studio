"""Espacialización de audio: binaural (HRTF) y Ambisonics desde stems separados.

Módulo puro de procesamiento: recibe rutas de stems y devuelve rutas de
archivos locales. Los imports pesados (spaudiopy, scipy) ocurren dentro
de las funciones para no arrastrarlos a la API.

Escenario sonoro (staging): cada stem se coloca en el plano horizontal.
Convención de azimut: 0° = frente, positivo = antihorario (izquierda).
Un stem estéreo se trata como dos fuentes mono en azi ± spread.

Decisión documentada (Stage 2.3): USAT se descarta en v1 — no está en
PyPI y para FOA/binaural basta spaudiopy + codificación AmbiX manual.
"""

import math
from pathlib import Path

# stem -> (azimut°, apertura° entre canales L/R, ganancia)
STEM_STAGING: dict[str, tuple[float, float, float]] = {
    "vocals": (0.0, 15.0, 1.0),   # voz al frente, casi central
    "bass": (0.0, 5.0, 0.9),      # graves centrados (poco localizables)
    "drums": (180.0, 40.0, 0.9),  # batería detrás del oyente
    "other": (0.0, 70.0, 1.0),    # instrumentos abiertos a los lados
}
_DEFAULT_STAGING = (0.0, 30.0, 1.0)

_PEAK_TARGET = 0.9  # normalización de pico (evita clipping en 16/24-bit)


def _load_sources(stems: dict[str, Path]) -> tuple[list[tuple["object", float, float]], int]:
    """Convierte los stems en fuentes mono posicionadas.

    Returns:
        (fuentes, sample_rate) donde cada fuente es (señal mono, azimut_rad, ganancia).
    """
    import soundfile as sf

    sources = []
    sample_rate: int | None = None
    for name, path in stems.items():
        data, sr = sf.read(path, always_2d=True)
        if sample_rate is None:
            sample_rate = sr
        elif sr != sample_rate:
            raise ValueError(f"Sample rate inconsistente entre stems: {name} tiene {sr}, esperado {sample_rate}")

        azi_deg, spread_deg, gain = STEM_STAGING.get(name, _DEFAULT_STAGING)
        channels = data.shape[1]
        if channels == 1:
            sources.append((data[:, 0], math.radians(azi_deg), gain))
        else:
            # L/R del stem a cada lado de su azimut base
            for ch, sign in ((0, +1), (1, -1)):
                sources.append((data[:, ch], math.radians(azi_deg + sign * spread_deg), gain))
    if sample_rate is None:
        raise ValueError("No se recibió ningún stem")
    return sources, sample_rate


def _normalize(signal, peak: float = _PEAK_TARGET):
    import numpy as np

    max_abs = float(np.max(np.abs(signal)))
    return signal * (peak / max_abs) if max_abs > peak else signal


def to_binaural(stems: dict[str, Path], output_path: Path) -> Path:
    """Renderiza los stems a binaural (WAV estéreo) por convolución HRIR.

    Cada fuente se convoluciona con el par HRIR más cercano a su posición
    (set de HRIRs por defecto de spaudiopy, medido en cabeza artificial).

    Args:
        stems: Mapa nombre-de-stem -> ruta WAV (salida de Demucs).
        output_path: Ruta del WAV binaural a escribir.
    """
    import numpy as np
    import soundfile as sf
    import spaudiopy as spa
    from scipy.signal import fftconvolve

    sources, sample_rate = _load_sources(stems)
    hrirs = spa.io.load_hrirs(fs=sample_rate)

    zenith = math.pi / 2  # plano horizontal (elevación 0)
    left = right = None
    for signal, azimuth, gain in sources:
        h_left, h_right = hrirs.nearest_hrirs(azimuth, zenith)
        conv_l = fftconvolve(signal * gain, h_left)
        conv_r = fftconvolve(signal * gain, h_right)
        if left is None:
            left, right = conv_l, conv_r
        else:
            # Las convoluciones comparten longitud (misma HRIR length y señales iguales)
            n = max(len(left), len(conv_l))
            left = np.pad(left, (0, n - len(left))) + np.pad(conv_l, (0, n - len(conv_l)))
            right = np.pad(right, (0, n - len(right))) + np.pad(conv_r, (0, n - len(conv_r)))

    binaural = _normalize(np.stack([left, right], axis=1))
    sf.write(output_path, binaural, sample_rate)
    return output_path


def to_ambisonics(stems: dict[str, Path], output_path: Path, order: int = 1) -> Path:
    """Codifica los stems a Ambisonics de primer orden (WAV 4 canales, AmbiX).

    Formato AmbiX = orden de canales ACN (W, Y, Z, X) con normalización
    SN3D. Codificación en plano horizontal (Z queda en silencio):
        W = s · 1,  Y = s · sin(azi),  Z = 0,  X = s · cos(azi)

    Args:
        stems: Mapa nombre-de-stem -> ruta WAV (salida de Demucs).
        output_path: Ruta del WAV Ambisonics a escribir.
        order: Solo orden 1 soportado en v1.
    """
    import numpy as np
    import soundfile as sf

    if order != 1:
        raise NotImplementedError("Solo Ambisonics de orden 1 está soportado")

    sources, sample_rate = _load_sources(stems)
    n_samples = max(len(signal) for signal, _, _ in sources)
    w = np.zeros(n_samples)
    y = np.zeros(n_samples)
    z = np.zeros(n_samples)
    x = np.zeros(n_samples)

    for signal, azimuth, gain in sources:
        s = np.pad(signal * gain, (0, n_samples - len(signal)))
        w += s
        y += s * math.sin(azimuth)
        x += s * math.cos(azimuth)

    ambix = _normalize(np.stack([w, y, z, x], axis=1))
    sf.write(output_path, ambix, sample_rate)
    return output_path
