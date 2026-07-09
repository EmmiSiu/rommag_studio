from pathlib import Path
import sys

import pytest

np = pytest.importorskip("numpy")
wavfile = pytest.importorskip("scipy.io.wavfile")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from audio_services.analysis.musical import analyze_wav  # noqa: E402


def _write_click_track(path: Path, bpm: int = 120, sample_rate: int = 22050, seconds: int = 8) -> None:
    samples = np.zeros(sample_rate * seconds, dtype=np.float32)
    beat_interval = int(sample_rate * 60 / bpm)
    click_len = int(sample_rate * 0.035)
    click = np.hanning(click_len).astype(np.float32) * 0.9
    for start in range(0, samples.size - click_len, beat_interval):
        samples[start : start + click_len] += click
    wavfile.write(path, sample_rate, np.clip(samples, -1, 1))


def _write_c_major_tone(path: Path, sample_rate: int = 22050, seconds: int = 3) -> None:
    t = np.linspace(0, seconds, sample_rate * seconds, endpoint=False)
    notes = [261.63, 329.63, 392.0]
    signal = sum(np.sin(2 * np.pi * note * t) for note in notes) / len(notes)
    wavfile.write(path, sample_rate, (signal * 0.4).astype(np.float32))


def test_bpm_energy_and_loudness_from_click_fixture(tmp_path: Path) -> None:
    wav_path = tmp_path / "click-120.wav"
    _write_click_track(wav_path)

    analysis = analyze_wav(wav_path)

    assert analysis.bpm is not None
    assert analysis.bpm == pytest.approx(120, abs=4)
    assert analysis.energy > 0
    assert -60 < analysis.loudness_db < 0


def test_key_estimate_from_c_major_fixture(tmp_path: Path) -> None:
    wav_path = tmp_path / "c-major.wav"
    _write_c_major_tone(wav_path)

    analysis = analyze_wav(wav_path)

    assert analysis.musical_key is not None
    assert analysis.musical_key.startswith("C")
