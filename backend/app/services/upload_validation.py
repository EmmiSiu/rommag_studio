"""Validación de archivos de audio subidos (seguridad en la ingesta).

Valida el contenido REAL del archivo (magic bytes), no solo la extensión:
un .exe renombrado a .mp3 debe ser rechazado. Sin dependencia de libmagic
(KISS): las firmas de los formatos soportados son estables y conocidas.
"""


def sniff_audio_format(header: bytes) -> str | None:
    """Detecta el formato de audio a partir de los primeros bytes del archivo.

    Args:
        header: Al menos los primeros 12 bytes del archivo.

    Returns:
        Nombre canónico del formato (coincide con ALLOWED_AUDIO_FORMATS),
        o None si no es un formato de audio reconocido.
    """
    if len(header) < 12:
        return None

    if header[:4] == b"RIFF" and header[8:12] == b"WAVE":
        return "wav"
    if header[:4] == b"fLaC":
        return "flac"
    if header[:4] == b"OggS":
        # Contenedor Ogg: puede ser Vorbis u Opus; ambos aceptados como "ogg"
        return "ogg"
    if header[:3] == b"ID3":
        return "mp3"
    if header[0] == 0xFF and (header[1] & 0xE0) == 0xE0:
        # Frame sync MPEG: mp3 sin tag ID3, o AAC ADTS ((b1 & 0xF6) == 0xF0)
        return "aac" if (header[1] & 0xF6) == 0xF0 else "mp3"
    if header[4:8] == b"ftyp":
        # Contenedor MP4/M4A (el brand exacto varía: M4A, mp42, isom...)
        return "m4a"
    if header[:4] == bytes([0x30, 0x26, 0xB2, 0x75]):
        # ASF (Windows Media)
        return "wma"
    return None


def sanitize_title(filename: str, max_length: int = 200) -> str:
    """Deriva un título seguro desde el nombre de archivo del usuario.

    Elimina rutas y caracteres de control; el filename NUNCA se usa como
    clave de almacenamiento (esas son UUIDs del servidor), solo como título.
    """
    stem = filename.replace("\\", "/").rsplit("/", 1)[-1].rsplit(".", 1)[0]
    clean = "".join(ch for ch in stem if ch.isprintable()).strip()
    return clean[:max_length] or "Audio sin título"
