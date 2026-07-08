# Feature Roadmap

Este mapa baja los features del README a sprints futuros, cada uno con una
prueba de salida esperada.

```mermaid
timeline
    title Roadmap de capacidades
    Stage 8 : Playlists : Biblioteca avanzada : Colaboracion
    Stage 9 : Reproductor 3D : Stems interactivos : Three.js + WebAudio
    Stage 10 : DJ mode : Beat matching : Recomendaciones IA
    Stage 11 : API publica : Webhooks : Dolby/DTS:X
    Stage 12 : Perfiles : Social graph : Comunidad
```

## Dependencias entre Features

```mermaid
flowchart LR
    stems["Stems persistidos"] --> player3d["Reproductor 3D interactivo"]
    player3d --> dj["DJ mode"]
    library["Biblioteca"] --> playlists["Playlists colaborativas"]
    playlists --> social["Social features"]
    metrics["Metrics y auditoria"] --> api["API publica"]
    pipeline["Pipeline estable"] --> exports["Dolby/DTS:X"]
    api --> integrations["Integraciones externas"]
    social --> recommendations["Recomendaciones IA"]
```

## Definition of Ready por Sprint Futuro

- Contrato de datos documentado.
- Harness o prueba de aceptacion definida antes de implementar.
- Estados de error y permisos definidos.
- Impacto en PWA/mobile revisado.
