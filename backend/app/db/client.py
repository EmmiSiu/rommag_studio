"""Cliente Prisma compartido (singleton por proceso).

El resto de la app importa `prisma` desde aquí; nunca instanciar
`Prisma()` en otro módulo (una sola conexión por proceso).
"""

from prisma import Prisma

prisma = Prisma()
