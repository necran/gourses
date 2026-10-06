# HU-074 — Subir el tope de tiempo de la ingesta de Udemy en español

## Contexto

Fase 6, fiabilidad de la ingesta (2026-10-06). Tras arreglar HU-073 (el secreto de la base de
datos estaba desactualizado), la ingesta de Udemy en español volvió a escribir de verdad en
producción — y entonces empezó a chocar con su propio tope de tiempo, puesto desde el
principio (HU-033) sin ninguna medición real, «por prudencia»:

| Ejecución | Resultado | Duración |
|---|---|---|
| 1 oct | cancelada por tiempo | 91,0 min |
| 2 oct | cancelada por tiempo | 90,4 min |
| 3 oct | **completada** | 84,7 min |
| 4 oct | cancelada por tiempo | 90,3 min |
| 5 oct | cancelada por tiempo | 90,4 min |

Solo 1 de 5 terminó dentro del tope de 90 minutos. Es el mismo patrón, con el mismo motivo,
que ya obligó a subir el tope de la ingesta en inglés en HU-023: un número puesto antes de
tener una medición real deja de servir en cuanto la ejecución empieza a hacer su trabajo de
verdad.

## Como responsable del sitio quiero que la ingesta en español termine dentro de su tope casi siempre, para no perder una pasada de cada cinco sin ningún motivo real

## Criterios de aceptación

- **Given** el tope de tiempo del workflow **When** se compara con las duraciones medidas
  **Then** deja margen de verdad sobre la única ejecución completa (84,7 min), no solo sobre
  el número anterior

## Fuera de alcance

- **Medir por qué tarda 85-91 min** (¿cuota de la API de Udemy, número de ámbitos,
  concurrencia?): sería optimizar antes de tener más datos. Con el tope nuevo hay margen para
  observarlo sin perder ejecuciones mientras tanto.
- **Unificar esta pasada con la de inglés**: siguen siendo catálogos independientes, por el
  mismo motivo que las separó HU-033.

## Diseño

`timeout-minutes: 90 → 150` en `ingesta-es.yml`, mismo criterio que `ingesta.yml` en HU-023:
margen generoso sobre la medición real, no el doble exacto.

## Checklist de tests (obligatorio antes de cerrar)

- [x] No aplica lógica de código; es un número de configuración
- [ ] Verificación: una ejecución real termina por debajo del tope nuevo (pendiente, pide
      esperar a la próxima pasada programada o lanzarla a mano)

## Estado

`En progreso`, en la rama `HU-074-tope-ingesta-espanol`, sin fusionar. Igual que HU-073: no
toca ninguna página de la web, se publica en el próximo lote.
