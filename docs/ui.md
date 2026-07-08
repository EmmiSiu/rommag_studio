# UI System

La interfaz debe sentirse como una herramienta profesional de audio: precisa,
confiable y visualmente memorable sin depender de decoracion gratuita.

## Principios

- Sin emojis en UI publica: usar iconos profesionales y texto claro.
- Landing con producto visible en el primer viewport.
- Paleta con base oscura y acentos balanceados: cyan, verde, ambar y violeta en dosis controladas.
- Tarjetas solo para elementos repetidos, paneles de herramienta o modales.
- Mobile primero: sin overflow horizontal a 375px.

## Landing

```mermaid
flowchart TB
    hero["Hero full-bleed\nmarca, promesa, CTA, mockup"]
    rail["Word rail\nIA, stems, binaural, privacy"]
    proof["Proof strip\nmetricas y capacidades"]
    pipeline["Pipeline visual\ninput, enhance, spatialize, publish"]
    showcase["Showcase\nlibrary, player, admin, PWA"]
    cta["CTA final\nregistro y biblioteca publica"]

    hero --> rail --> proof --> pipeline --> showcase --> cta
```

## Componentes Esperados

```mermaid
mindmap
  root((Audio Inmersivo UI))
    Navigation
      Logo profesional
      CTA primario
      Estados auth
    Landing
      Hero
      Product mockup
      Feature cards
      Metrics
    Studio
      Uploader
      Library
      Player
      Admin
```
