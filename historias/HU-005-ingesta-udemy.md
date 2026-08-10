# HU-005 — Ingesta de catálogo desde Udemy

## Contexto

Fase 1. Primer adaptador de ingesta real: llama a la Udemy Affiliate API, normaliza los datos al esquema común de `HU-004` y los guarda en Supabase. Es la referencia de cómo debe comportarse cualquier adaptador futuro (ver `.claude/rules/ingesta-fuentes.md`).

## Como sistema quiero traer periódicamente el catálogo de Udemy a mi base de datos para que el buscador tenga cursos reales sin llamar a Udemy en cada búsqueda

## Criterios de aceptación

- **Given** una clave de API de Udemy válida en variables de entorno **When** ejecuto el job de ingesta **Then** los cursos devueltos por la API quedan guardados en la tabla `courses` con `source = 'udemy'`.
- **Given** un curso que ya existe de una ingesta anterior **When** vuelvo a ejecutar el job y su precio ha cambiado **Then** se actualiza el registro en `courses` y se añade una fila nueva en `course_price_history`.
- **Given** la API de Udemy devuelve un error o excede el límite de cuota **When** ocurre durante la ingesta **Then** el job registra el error, se detiene de forma controlada y no deja datos a medio normalizar en la base de datos.
- **Given** un curso de Udemy con campos ausentes o inesperados **When** se normaliza **Then** el adaptador no rompe el job completo por un único curso mal formado — lo registra como fallo puntual y continúa con el resto.

## Fuera de alcance

Ingesta de Coursera (`HU-006`). Programación del job como cron recurrente en producción — en esta historia se ejecuta manualmente o bajo demanda; la recurrencia automática se revisa en Fase 6.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: función de normalización Udemy → esquema común, cubriendo un caso completo y uno con campos ausentes
- [ ] Unitarios: lógica de detección de cambio de precio (dispara o no inserción en histórico)
- [ ] Integración: ejecución del job contra la API real de Udemy (o su entorno de sandbox si lo ofrece) y contra Supabase de test, verificando que los datos quedan guardados correctamente
- [ ] Integración: caso de error de API simulado (mock de fallo/cuota excedida) y comprobación de que el job se detiene sin dejar datos parciales
- [ ] `/security-review`: la clave de API de Udemy solo se usa en el job (server-side), nunca llega al cliente/frontend

## Notas de implementación (pendiente)

Acceso a catálogo verificado el 2026-08-10 con las credenciales aprobadas (ver la tabla de endpoints en `docs/checklist-alta-afiliados.md`). La ingesta tendrá dos pasos, porque el listado no trae precio:

1. **Descubrimiento**: recorrer categorías (`/api-2.0/course-categories/`) y sus subcategorías, y para cada una paginar la unidad `bestseller` de `/api-2.0/discovery-units/`. De aquí salen ID, título, valoración, nivel, idioma, instructor e imagen.
2. **Detalle**: por cada ID, `GET /api-2.0/courses/{id}/` para obtener `price_detail` (importe + moneda), que es lo que alimenta `course_price_history`.

Ojo: el endpoint de listado clásico `/api-2.0/courses/` devuelve 403 con credenciales válidas — no es un fallo de configuración, es que esa ruta concreta ya no está disponible para afiliados. No perder tiempo depurándolo.

Se reutiliza tal cual `src/lib/ingesta/upsert-course.ts` (upsert + histórico de precio) de `HU-006`, que se escribió justamente para esto.

## Estado

Desbloqueada, pendiente de implementar — HU-004 (esquema) cerrada y credenciales de Udemy verificadas.
