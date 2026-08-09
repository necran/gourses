# HU-007 — Buscador de cursos con filtros

## Contexto

Fase 1. Primera pantalla real de la web: lee de la tabla `courses` (ya poblada por `HU-006`, y por `HU-005` cuando esté disponible) y permite buscar y filtrar. Nunca llama a las APIs externas en caliente — eso es justo lo que evita la ingesta desacoplada.

Desbloqueada con datos de una sola fuente (Coursera, vía `HU-006`): `HU-005` (Udemy) sigue pendiente de aprobación externa del programa de afiliados, sin trabajo de código bloqueado por nuestra parte. Cuando se apruebe e ingiera, sus cursos aparecerán mezclados en el buscador sin cambios aquí.

## Como visitante quiero buscar cursos por palabra clave y filtrarlos para encontrar rápido opciones relevantes sin visitar cada plataforma por separado

## Criterios de aceptación

- **Given** la página de búsqueda **When** escribo una palabra clave y confirmo **Then** veo una lista de cursos cuyo título o descripción coincide, con su fuente, precio, valoración e imagen.
- **Given** resultados de búsqueda **When** aplico un filtro de precio máximo **Then** la lista se actualiza mostrando solo cursos dentro de ese precio.
- **Given** resultados de búsqueda **When** aplico un filtro de valoración mínima o idioma **Then** la lista respeta todos los filtros activos combinados (AND, no OR).
- **Given** una búsqueda sin resultados **When** se ejecuta **Then** se muestra un mensaje claro de "sin resultados", nunca una lista vacía sin explicación ni un error.
- **Given** la página de búsqueda **When** carga inicialmente sin ningún filtro **Then** muestra un listado por defecto (ej. más recientes o mejor valorados) en vez de una pantalla vacía.

## Fuera de alcance

- Filtro de categoría: no existe columna de categoría en el esquema común (`courses`, `HU-004`); ni Udemy ni Coursera la normalizan hoy. Se retoma en una historia posterior si se decide añadir esa columna y mapearla desde alguna fuente.
- Selección múltiple y comparador (`Fase 2`). Guardar en favoritos (`Fase 3`) — en esta historia no hay usuario autenticado todavía.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: función de construcción/saneado de filtros (combina palabra clave + precio + valoración + idioma correctamente, rechaza valores inválidos) (`src/lib/courses/search-filters.test.ts`, `src/lib/courses/search-courses.test.ts`)
- [x] Integración: la ruta de búsqueda devuelve resultados reales combinando filtros (`tests/integration/courses-search.test.ts`) — ver excepción documentada abajo
- [x] E2E: buscar por palabra clave y ver resultados; aplicar un filtro de precio y comprobar que la lista cambia; buscar algo inexistente y ver el mensaje de "sin resultados"; carga inicial con listado por defecto (`e2e/buscar.spec.ts`)
- [x] `/security-review`: sin hallazgos — filtro de palabra clave escapado correctamente antes de embeberse en `.or()` de PostgREST, resto de filtros parametrizados vía supabase-js, RLS de lectura pública sin cambios

## Notas de implementación

- Acceso a datos desde la web: Supabase JS + `NEXT_PUBLIC_SUPABASE_ANON_KEY` vía PostgREST, respetando la RLS pública de lectura ya definida en `HU-004` (`courses_public_read`). `DATABASE_URL` sigue reservado solo para scripts de migración/ingesta.
- **Excepción documentada a la regla de testing** (ver `.claude/rules/testing.md`): el NAS solo tiene una instancia de Supabase/PostgREST, sirviendo la base de dev — no existe una segunda instancia para `gourses_test`. El test de integración de esta historia siembra filas marcadas (`source_id` con prefijo `test-`) en dev vía `DATABASE_URL`, consulta por el mismo camino que producción (supabase-js/anon, RLS real) y las borra en un `finally`. Válida solo mientras no exista una segunda instancia de Supabase para test.

## Estado

Cerrada.
