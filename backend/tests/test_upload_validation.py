"""Tests unitarios de la validación de subidas (sin DB ni servicios externos)."""

import pytest

from app.services.upload_validation import sanitize_title, sniff_audio_format


class TestSniffAudioFormat:
    def test_wav(self):
        assert sniff_audio_format(b"RIFF\x24\x08\x00\x00WAVEfmt ") == "wav"

    def test_flac(self):
        assert sniff_audio_format(b"fLaC" + b"\x00" * 8) == "flac"

    def test_ogg(self):
        assert sniff_audio_format(b"OggS" + b"\x00" * 8) == "ogg"

    def test_mp3_con_id3(self):
        assert sniff_audio_format(b"ID3\x04\x00\x00\x00\x00\x00\x00\x00\x00") == "mp3"

    def test_mp3_frame_sync(self):
        # 0xFF 0xFB: MPEG-1 Layer III sin tag ID3
        assert sniff_audio_format(b"\xff\xfb\x90\x00" + b"\x00" * 8) == "mp3"

    def test_aac_adts(self):
        # 0xFF 0xF1: ADTS AAC
        assert sniff_audio_format(b"\xff\xf1\x50\x80" + b"\x00" * 8) == "aac"

    def test_m4a(self):
        assert sniff_audio_format(b"\x00\x00\x00\x20ftypM4A " + b"\x00" * 4) == "m4a"

    def test_wma(self):
        assert sniff_audio_format(bytes([0x30, 0x26, 0xB2, 0x75]) + b"\x00" * 8) == "wma"

    def test_ejecutable_renombrado_rechazado(self):
        # Cabecera PE de Windows (un .exe renombrado a .mp3)
        assert sniff_audio_format(b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00") is None

    def test_texto_plano_rechazado(self):
        assert sniff_audio_format(b"hola mundo, esto no es audio") is None

    def test_cabecera_corta_rechazada(self):
        assert sniff_audio_format(b"RIFF") is None

    def test_vacio_rechazado(self):
        assert sniff_audio_format(b"") is None


class TestSanitizeTitle:
    def test_quita_extension(self):
        assert sanitize_title("cancion.mp3") == "cancion"

    def test_quita_rutas(self):
        assert sanitize_title("C:\\Users\\evil\\..\\cancion.mp3") == "cancion"
        assert sanitize_title("../../etc/passwd.mp3") == "passwd"

    def test_quita_caracteres_de_control(self):
        assert sanitize_title("can\x00cion\x1f.mp3") == "cancion"

    def test_trunca_a_max_length(self):
        assert len(sanitize_title("a" * 500 + ".mp3", max_length=200)) == 200

    def test_fallback_si_queda_vacio(self):
        assert sanitize_title("\x00\x01.mp3") == "Audio sin título"

    @pytest.mark.parametrize("filename", ["música é ñ.flac", "日本語タイトル.wav"])
    def test_conserva_unicode_imprimible(self, filename):
        assert sanitize_title(filename) != "Audio sin título"
