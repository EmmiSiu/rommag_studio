"""Lightweight musical analysis for normalized WAV files.

The goal is Stage 10 metadata, not studio-grade MIR. The implementation stays
dependency-light because the worker already ships NumPy/SciPy for spatial audio.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.io import wavfile


@dataclass(frozen=True)
class MusicalAnalysis:
    bpm: float | None
    musical_key: str | None
    energy: float
    loudness_db: float


_KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def analyze_wav(path: Path) -> MusicalAnalysis:
    sample_rate, data = wavfile.read(path)
    mono = _to_mono_float(data)
    if mono.size == 0:
        return MusicalAnalysis(bpm=None, musical_key=None, energy=0.0, loudness_db=-120.0)

    energy = float(np.sqrt(np.mean(np.square(mono))))
    loudness_db = float(20 * np.log10(max(energy, 1e-6)))
    bpm = _estimate_bpm(mono, sample_rate)
    musical_key = _estimate_key(mono, sample_rate)
    return MusicalAnalysis(
        bpm=round(bpm, 2) if bpm is not None else None,
        musical_key=musical_key,
        energy=round(energy, 6),
        loudness_db=round(loudness_db, 2),
    )


def _to_mono_float(data: np.ndarray) -> np.ndarray:
    array = np.asarray(data)
    if array.ndim == 2:
        array = array.mean(axis=1)
    if np.issubdtype(array.dtype, np.integer):
        max_value = float(np.iinfo(array.dtype).max)
        return np.clip(array.astype(np.float64) / max_value, -1.0, 1.0)
    return np.clip(array.astype(np.float64), -1.0, 1.0)


def _estimate_bpm(mono: np.ndarray, sample_rate: int) -> float | None:
    frame_size = 1024
    hop = 512
    if mono.size < frame_size * 4:
        return None

    usable = mono[: ((mono.size - frame_size) // hop) * hop + frame_size]
    frames = np.lib.stride_tricks.sliding_window_view(usable, frame_size)[::hop]
    envelope = np.sqrt(np.mean(np.square(frames), axis=1))
    envelope = np.maximum(0, np.diff(envelope, prepend=envelope[0]))
    envelope -= envelope.mean()
    if float(np.max(np.abs(envelope))) < 1e-8:
        return None

    autocorr = np.correlate(envelope, envelope, mode="full")[envelope.size - 1 :]
    min_bpm = 60
    max_bpm = 200
    min_lag = max(1, int((60 * sample_rate) / (max_bpm * hop)))
    max_lag = min(autocorr.size - 1, int((60 * sample_rate) / (min_bpm * hop)))
    if max_lag <= min_lag:
        return None

    lag = int(np.argmax(autocorr[min_lag : max_lag + 1]) + min_lag)
    bpm = 60 * sample_rate / (lag * hop)
    while bpm < 90:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    return float(bpm)


def _estimate_key(mono: np.ndarray, sample_rate: int) -> str | None:
    # Limit work and avoid transients dominating the estimate.
    max_samples = min(mono.size, sample_rate * 45)
    segment = mono[:max_samples]
    if segment.size < sample_rate // 2 or float(np.sqrt(np.mean(np.square(segment)))) < 1e-5:
        return None

    window = np.hanning(segment.size)
    spectrum = np.abs(np.fft.rfft(segment * window))
    frequencies = np.fft.rfftfreq(segment.size, d=1 / sample_rate)
    mask = (frequencies >= 55) & (frequencies <= 1760)
    if not np.any(mask):
        return None

    chroma = np.zeros(12, dtype=np.float64)
    for frequency, magnitude in zip(frequencies[mask], spectrum[mask], strict=False):
        if magnitude <= 0:
            continue
        midi = int(round(69 + 12 * np.log2(frequency / 440.0)))
        chroma[midi % 12] += float(magnitude)
    if float(chroma.sum()) <= 0:
        return None
    chroma /= chroma.sum()

    major_profile = _MAJOR_PROFILE / _MAJOR_PROFILE.sum()
    minor_profile = _MINOR_PROFILE / _MINOR_PROFILE.sum()
    best_key = None
    best_score = -np.inf
    for root in range(12):
        major_score = float(np.dot(chroma, np.roll(major_profile, root)))
        minor_score = float(np.dot(chroma, np.roll(minor_profile, root)))
        if major_score > best_score:
            best_score = major_score
            best_key = f"{_KEY_NAMES[root]} major"
        if minor_score > best_score:
            best_score = minor_score
            best_key = f"{_KEY_NAMES[root]} minor"
    return best_key
