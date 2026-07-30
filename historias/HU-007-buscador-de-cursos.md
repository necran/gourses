# HU-007 — Buscador de cursos con filtros

## Contexto

Fase 1. Primera pantalla real de la web: lee de la tabla `courses` (ya poblada por `HU-005`/`HU-006`) y permite buscar y filtrar. Nunca llama a las APIs externas en caliente — eso es justo lo que evita la ingesta desacoplada.

## Como visitante quiero buscar cursos por palabra clave y filtrarlos para encontrar rápido opciones relevantes sin visitar cada plataforma por separado

## Criterios de aceptación

- **Given** la página de búsqueda **When** escribo una palabra clave y confirmo **Then** veo una lista de cursos cuyo título o descripción coincide, con su fuente, precio, valoración e imagen.
- **Given** resultados de búsqueda **When** aplico un filtro de precio máximo **Then** la lista se actualiza mostrando solo cursos dentro de ese precio.
- **Given** resultados de búsqueda **When** aplico un filtro de categoría, valoración mínima o idioma **Then** la lista respeta todos los filtros activos combinados (AND, no OR).
- **Given** una búsqueda sin resultados **When** se ejecuta **Then** se muestra un mensaje claro de "sin resultados", nunca una lista vacía sin explicación ni un error.
- **Given** la página de búsqueda **When** carga inicialmente sin ningún filtro **Then** muestra un listado por defecto (ej. más recientes o mejor valorados) en vez de una pantalla vacía.

## Fuera de alcance

Selección múltiple y comparador (`Fase 2`). Guardar en favoritos (`Fase 3`) — en esta historia no hay usuario autenticado todavía.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: función de construcción de la query de filtros (combina palabra clave + precio + categoría + valoración + idioma correctamente)
- [ ] Integración: la ruta de búsqueda devuelve resultados reales contra la base de datos de test poblada con datos de ambas fuentes
- [ ] E2E: buscar por palabra clave y ver resultados; aplicar un filtro de precio y comprobar que la lista cambia; buscar algo inexistente y ver el mensaje de "sin resultados"
- [ ] `/security-review`: la entrada de búsqueda y filtros se valida y sanea antes de construir la consulta a la base de datos (evitar inyección)

## Estado

Bloqueada — depende de HU-004, HU-005 y HU-006 (necesita datos reales de al menos una fuente para ser útil)
