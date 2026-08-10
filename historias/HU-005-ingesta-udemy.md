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

- [x] Unitarios: función de normalización Udemy → esquema común, cubriendo un caso completo y uno con campos ausentes (`src/lib/ingesta/udemy/normalize.test.ts`)
- [x] Unitarios: lógica de detección de cambio de precio (dispara o no inserción en histórico) (`src/lib/ingesta/upsert-course.test.ts`, reutilizada; verificada extremo a extremo en `tests/integration/udemy-ingest.test.ts`)
- [x] Integración: ejecución del job contra la API real de Udemy y contra la BD de test, verificando que los datos quedan guardados correctamente (`tests/integration/udemy-ingest.test.ts`)
- [x] Integración: caso de error de API simulado (fallo/cuota excedida) y comprobación de que el job se detiene sin dejar datos parciales (mismo fichero: caso 429 y caso de cambio de contrato)
- [x] `/security-review`: sin hallazgos — credenciales solo en el entrypoint del job (nunca bajo `src/app/`), escritura con SQL parametrizado, y la URL de paginación que devuelve la API se valida contra el mismo origen antes de seguirla (`resolveApiUrl`, con tests propios)

## Notas de implementación

La ingesta tiene dos pasos, porque el listado no trae precio (ver la tabla de endpoints en `docs/checklist-alta-afiliados.md`):

1. **Descubrimiento**: recorrer categorías (`/api-2.0/course-categories/`) y, opcionalmente, sus subcategorías; para cada ámbito, paginar su unidad de cursos de `/api-2.0/discovery-units/`. De aquí salen ID, título, valoración, nivel, idioma, instructor e imagen.
2. **Detalle**: por cada ID, `GET /api-2.0/courses/{id}/` para obtener `price_detail` (importe + moneda), que es lo que alimenta `course_price_history`.

Ojo: el listado clásico `/api-2.0/courses/` devuelve 403 con credenciales válidas — no es un fallo de configuración, esa ruta ya no está disponible para afiliados. No perder tiempo depurándolo.

Decisiones que conviene no reaprender:

- **No se replican a mano los parámetros internos de `discovery-units`** (`fl`, `sos`, `fft`…): cambian según el ámbito (`fl=cat` en categoría, `fl=scat` en subcategoría). Se sigue la URL que la propia API devuelve en cada unidad, añadiéndole `source_page`, `page` y `page_size`. Como esa URL viene de un tercero, `resolveApiUrl` exige que resuelva al mismo origen antes de seguirla — si no, las credenciales Basic viajarían a otro host.
- **Un fallo del endpoint de detalle no descarta el curso**: se guarda con precio `null` y se anota en `failedCourses`. Perder un curso del catálogo es peor que no tener su precio en esa pasada.
- **Deduplicación en memoria**: las unidades de distintas categorías se solapan, así que se lleva un `Set` de IDs vistos para no repetir la llamada de detalle.
- Se reutiliza tal cual `src/lib/ingesta/upsert-course.ts` de `HU-006`, que se escribió justamente para esto.
- `affiliate_url` guarda de momento la URL directa del curso, igual que en `HU-006`, a la espera de confirmar el formato del enlace de afiliado.

Ejecución real (`npm run ingest:udemy`) contra la base de dev: 13 ámbitos, **312 cursos guardados, 0 fallos**, todos con precio, valoración, nivel, idioma e instructor.

### Efectos colaterales detectados al tener por fin dos fuentes con datos

- **Defecto de producto corregido**: el buscador ordenaba por valoración, y como Coursera no expone valoraciones (verificado: su API no tiene ese campo ni ninguna ruta de ratings), sus 100 cursos quedaban fuera de la primera página **en la portada y en toda búsqueda**. `searchCourses` ahora consulta una vez por fuente e intercala los resultados. Un comparador tiene que enseñar las dos plataformas.
- **Tests de integración en serie**: `coursera-ingest` y `udemy-ingest` comparten `gourses_test` y limpian tablas entre casos; en paralelo se pisaban y provocaban fallos intermitentes (probablemente la causa de la "flakiness" que en `HU-006` se atribuyó a la beta de Coursera). `npm run test:integration` usa ahora `--no-file-parallelism`.
- **Dos tests de `HU-007` estaban mal planteados** y solo se sostenían con un catálogo pequeño: uno asumía que las filas sembradas entraban en los 50 primeros resultados; otro, que filtrar por precio reduce el número de resultados (con 412 cursos ambas listas llegan al límite de página). Corregidos para comprobar lo que de verdad exige el criterio.
- **CSS del buscador**: los metadatos usaban colores fijos sobre fondo claro y eran ilegibles en modo oscuro; además las descripciones de Coursera (texto completo del curso) hacían fichas de varias pantallas. Ahora la paleta sigue el tema del sistema y la descripción se recorta a 3 líneas.

Pendiente para una historia futura: la API de Coursera sí expone `instructorIds`, `domainTypes` (categoría) y `workload` (duración), que hoy no se aprovechan — rellenarían el instructor (ahora `null`) y permitirían recuperar el filtro por categoría que se dejó fuera de `HU-007`.

## Estado

Cerrada.
