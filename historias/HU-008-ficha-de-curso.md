# HU-008 — Ficha de curso

## Contexto

Fase 1. Página de detalle a la que se llega desde un resultado del buscador (`HU-007`). Es también la base visual que reutilizará el comparador en Fase 2.

## Como visitante quiero ver el detalle completo de un curso para decidir si me interesa antes de ir a comprarlo a la plataforma original

## Criterios de aceptación

- **Given** un resultado de búsqueda **When** hago clic en un curso **Then** llego a su ficha con título, descripción completa, precio, valoración, nivel, idioma, instructor, fuente e imagen.
- **Given** la ficha de un curso **When** reviso el botón de acción principal **Then** enlaza a `affiliate_url` (el enlace de afiliado de la fuente correspondiente, Udemy o Coursera) y no a la URL genérica del curso.
- **Given** un curso cuyo precio bajó respecto a una ingesta anterior **When** veo la ficha **Then** se muestra el precio anterior tachado junto al nuevo, usando `course_price_history`.
- **Given** una URL de ficha con un identificador de curso que no existe **When** se visita **Then** se muestra una página de "curso no encontrado", no un error sin manejar.

## Fuera de alcance

Guardar como favorito o comparar desde la ficha — llegan en Fase 2 y 3, aunque el diseño de la ficha puede dejar hueco visual para esos botones.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: función que decide si mostrar precio anterior tachado (según si hay bajada real en el histórico)
- [ ] Integración: la ruta de ficha devuelve los datos completos de un curso real de test, incluyendo su histórico de precio
- [ ] E2E: navegar desde un resultado de búsqueda hasta la ficha y comprobar que el botón principal apunta a la URL de afiliado correcta; visitar una ficha inexistente y ver la página de "no encontrado"
- [ ] `/security-review`: el identificador de curso en la URL se valida antes de consultar la base de datos (evitar inyección o enumeración con efectos secundarios)

## Estado

Bloqueada — depende de HU-004, HU-005/HU-006 (datos) y HU-007 (punto de entrada desde el buscador)
