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

- [x] Unitarios: función de normalización Coursera → esquema común (`src/lib/ingesta/coursera/normalize.test.ts`, caso completo + campos ausentes)
- [x] Unitarios: manejo de un cambio de forma en la respuesta de la API (`fetch-catalog.test.ts` — falta `elements`; distinto de un curso individual mal formado, que solo genera un fallo puntual, ver `job.test.ts`)
- [x] Integración: ejecución del job contra la Catalog API real y la BD de test (`tests/integration/coursera-ingest.test.ts`, contra `gourses_test`)
- [x] Integración: test que confirma que un curso de Udemy y uno de Coursera conviven en la misma tabla sin colisión de `(source, source_id)`
- [x] `/security-review`: sin hallazgos — parametrización correcta en todas las queries, sin credenciales hardcodeadas, `next` de paginación de la API nunca puede cambiar host/protocolo de la siguiente petición

## Notas de implementación

- La Catalog API de Coursera no expone precio por curso individual (el catálogo se monetiza mayormente por suscripción, no compra unitaria) — `price_amount`/`price_currency` quedan a `null` para estos cursos, campos ya nullable desde HU-004.
- El enlace de afiliado vía Impact.com sigue sin confirmarse (ver `docs/checklist-alta-afiliados.md`), así que `affiliate_url` guarda de momento el enlace directo al curso en Coursera — se sustituirá por el enlace de tracking de Impact cuando se confirme el formato, sin tocar el resto del esquema.
- Lógica de upsert + histórico de precio extraída a `src/lib/ingesta/upsert-course.ts`, pensada para reutilizarse tal cual en HU-005 (Udemy) cuando llegue la clave de API.
- Job ejecutado manualmente con `npm run ingest:coursera` contra la base de dev del NAS: 100 cursos reales guardados correctamente.
- Se detectó y corrigió durante esta historia que `TEST_DATABASE_URL`/`DATABASE_URL` apuntaban al puerto del *pooler* de Supavisor (no válido para conexión directa) — ver la nota ya añadida en `HU-004` y `docs/nas-supabase-setup.md`.

## Estado

Cerrada.
