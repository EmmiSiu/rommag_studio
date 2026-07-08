"""Configuración centralizada vía variables de entorno (12-Factor: Config).

Ningún otro módulo debe leer `os.environ` directamente: siempre importar
`settings` desde aquí (Dependency Inversion sobre el entorno).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables de entorno tipadas y validadas al arranque."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # General
    APP_NAME: str = "Audio Inmersivo"
    APP_ENV: str = "development"
    CORS_ORIGINS: str = "http://localhost:3000"

    # Base de datos
    DATABASE_URL: str

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    # Endpoint que ve el NAVEGADOR (las URLs prefirmadas se firman contra este host)
    MINIO_PUBLIC_ENDPOINT: str = "localhost:9000"
    MINIO_ROOT_USER: str
    MINIO_ROOT_PASSWORD: str
    MINIO_BUCKET_AUDIO: str = "audios"
    MINIO_USE_SSL: bool = False

    # Seguridad / JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Superadmin inicial
    SUPERADMIN_EMAIL: str = "admin@example.com"
    SUPERADMIN_PASSWORD: str = ""

    # Límites de procesamiento
    MAX_UPLOAD_SIZE_MB: int = 200
    MAX_AUDIO_DURATION_SECONDS: int = 3600
    ALLOWED_AUDIO_FORMATS: str = "mp3,wav,flac,m4a,ogg,aac,opus,wma"

    # Pipeline de IA (solo lo usa el worker)
    DEMUCS_MODEL: str = "htdemucs"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def allowed_formats_list(self) -> list[str]:
        return [fmt.strip().lower() for fmt in self.ALLOWED_AUDIO_FORMATS.split(",") if fmt.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
