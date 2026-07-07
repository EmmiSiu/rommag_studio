"""Servicio de almacenamiento de objetos (MinIO, S3-compatible).

Único punto de contacto con MinIO (Dependency Inversion: si mañana se
migra a AWS S3, solo cambia este módulo).
"""

from datetime import timedelta
from pathlib import Path

from minio import Minio

from app.core.config import settings


class StorageService:
    """Wrapper tipado sobre el cliente MinIO para el bucket de audios."""

    def __init__(self) -> None:
        self._client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ROOT_USER,
            secret_key=settings.MINIO_ROOT_PASSWORD,
            secure=settings.MINIO_USE_SSL,
        )
        self._bucket = settings.MINIO_BUCKET_AUDIO

    def ensure_bucket(self) -> None:
        """Crea el bucket de audios si no existe (idempotente)."""
        if not self._client.bucket_exists(self._bucket):
            self._client.make_bucket(self._bucket)

    def upload_file(self, local_path: Path, object_key: str, content_type: str = "audio/mpeg") -> str:
        """Sube un archivo local y devuelve su clave de objeto."""
        self._client.fput_object(self._bucket, object_key, str(local_path), content_type=content_type)
        return object_key

    def download_file(self, object_key: str, local_path: Path) -> Path:
        """Descarga un objeto a disco (usado por los workers)."""
        self._client.fget_object(self._bucket, object_key, str(local_path))
        return local_path

    def get_presigned_url(self, object_key: str, expires_hours: int = 1) -> str:
        """URL firmada temporal para streaming/descarga desde el frontend."""
        return self._client.presigned_get_object(
            self._bucket, object_key, expires=timedelta(hours=expires_hours)
        )


def get_storage() -> StorageService:
    """Factory para inyección de dependencias en endpoints y tareas."""
    return StorageService()
