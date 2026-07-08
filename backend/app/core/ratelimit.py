"""Limitador de tasa compartido (slowapi, keyed por IP).

Instancia única importada por main.py (registro) y los endpoints (decorador).
Almacenamiento in-memory: suficiente con un solo proceso de API; migrar a
Redis (`storage_uri`) si se escala horizontalmente.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
