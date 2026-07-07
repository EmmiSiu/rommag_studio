"""Instancia de Celery: broker y backend en Redis.

Las tareas viven en `app/workers/tasks/` y se autodescubren.
Arranque del worker: celery -A app.workers.celery_app worker --loglevel=info
"""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "audio_inmersivo",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks.audio_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # El procesamiento de audio es largo: confirmar la tarea solo al terminar
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Límite duro por tarea (evita jobs zombis): 30 minutos
    task_time_limit=1800,
)
