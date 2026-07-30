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

## Estado

Bloqueada — depende de HU-004 (esquema) y de tener la clave de Udemy Affiliate API (ver `docs/checklist-alta-afiliados.md`)
