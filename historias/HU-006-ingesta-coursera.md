# HU-006 — Ingesta de catálogo desde Coursera

## Contexto

Fase 1. Segundo adaptador de ingesta, reutilizando el mismo patrón que `HU-005` pero contra la Catalog API pública de Coursera (`build.coursera.org`), que está en beta y puede cambiar sin aviso — el adaptador debe ser tolerante a eso.

## Como sistema quiero traer periódicamente el catálogo de Coursera a mi base de datos para que el buscador combine cursos de más de una fuente

## Criterios de aceptación

- **Given** la Catalog API de Coursera **When** ejecuto el job de ingesta **Then** los cursos devueltos quedan guardados en `courses` con `source = 'coursera'`, usando el mismo esquema común que Udemy.
- **Given** un curso ya existente de una ingesta anterior **When** su precio cambia **Then** se actualiza igual que en `HU-005` (mismo comportamiento de histórico de precios).
- **Given** que la API está en beta **When** cambia su forma de respuesta de manera incompatible **Then** el job falla de forma controlada, con un mensaje que deje claro que es un cambio de la API externa y no un bug interno — no debe romper silenciosamente ni corromper datos.
- **Given** el buscador con cursos de ambas fuentes **When** se consulta **Then** los cursos de Udemy y Coursera aparecen mezclados sin que el usuario note diferencia estructural entre ellos.

## Fuera de alcance

Cualquier lógica del programa de afiliados de Coursera vía Impact que no sea generar el enlace de tracking guardado en `affiliate_url`.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: función de normalización Coursera → esquema común
- [ ] Unitarios: manejo de un cambio de forma en la respuesta de la API (test con un payload deliberadamente distinto al esperado)
- [ ] Integración: ejecución del job contra la Catalog API real y Supabase de test
- [ ] Integración: test que confirma que un curso de Udemy y uno de Coursera conviven en la misma tabla sin colisión de `(source, source_id)`
- [ ] `/security-review`: revisar que no se asuma nunca la estabilidad del contrato de una API en beta sin manejo de error explícito

## Estado

Bloqueada — depende de HU-004 (esquema) y de la validación del enlace de afiliado de Coursera vía Impact (ver `docs/checklist-alta-afiliados.md`)
