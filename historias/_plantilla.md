# HU-XXX — Título corto de la funcionalidad

## Contexto

Por qué existe esta historia y qué fase del roadmap cubre (ver `docs/analisis-y-estrategia.md`).

## Como [rol] quiero [acción] para [beneficio]

## Criterios de aceptación

- **Given** [estado inicial] **When** [acción] **Then** [resultado esperado]
- **Given** ... **When** ... **Then** ...

(Un criterio por comportamiento observable. Si no se puede escribir como Given/When/Then, probablemente la historia es demasiado grande — dividirla.)

## Fuera de alcance

Qué NO cubre esta historia explícitamente, para evitar ambigüedad al implementar.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: lógica cubierta, sin llamadas de red reales
- [ ] Integración: contra base de datos de test, no de desarrollo/producción
- [ ] E2E: un test por cada criterio de aceptación de arriba
- [ ] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Abierta` / `En progreso` / `Bloqueada (motivo)` / `Cerrada`

Una historia solo pasa a `Cerrada` cuando todos los checks de arriba están marcados. No se cierra con pendientes.
