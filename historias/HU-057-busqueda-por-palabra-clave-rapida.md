# HU-057 — Que buscar por palabra clave no falle por lento

## Contexto

Fase 6 (2026-09-15). Investigando fallos de e2e durante HU-054 y HU-056 apareció en el
registro del servidor:

    Fallo al buscar cursos: canceling statement due to statement timeout

en `/buscar?keyword=python&orden=precio-asc&pagina=2`. La persona ve «This page couldn't
load». No es un fallo de los tests: es la web.

Lo medido contra la base de desarrollo (15.395 cursos, 49 MB):

- La búsqueda por palabra clave filtra con
  `title ILIKE '%python%' OR description ILIKE '%python%'`. Un ILIKE con comodín delante
  no puede usar un índice normal, y la tabla no tiene ninguno que sirva: **cada consulta
  recorre la tabla entera** (`Seq Scan`, descarta 14.772 filas) y tarda **~0,7 s**.
- Las descripciones miden de media 2.354 caracteres (hasta 57.805).
- Una búsqueda hace **varias** consultas: la ordenada, resultados y recuento exacto; la
  de por defecto, lo mismo **por cada plataforma**.
- El rol `anon`, con el que lee la web, tiene **`statement_timeout = 3s`** (comprobado en
  `pg_roles`).
- A nivel de página, sin carga: `/buscar?keyword=python` tarda ~1,7 s y
  `/buscar` ~0,27 s. Bajo carga pasó de los 3 s y se canceló.

En producción el límite de `anon` en Supabase Cloud es el mismo por defecto, así que el
riesgo es real para cualquier visitante en un momento de carga.

## Como visitante quiero que buscar por palabra clave responda rápido para no encontrarme con un error

## Criterios de aceptación

- **Given** una búsqueda por palabra clave de tres letras o más **When** la base la
  ejecuta **Then** usa un índice en vez de recorrer la tabla entera
- **Given** una búsqueda por palabra clave **When** se ejecuta **Then** encuentra
  exactamente los mismos cursos que antes: el índice acelera, no cambia resultados
- **Given** `/buscar?keyword=python` **When** se carga sin carga en el servidor **Then**
  tarda claramente menos que antes (medido antes y después y anotado aquí)

### Lo que apareció al medir los casos límite, con los índices ya puestos

- **Palabras clave de una o dos letras**: `pg_trgm` necesita al menos tres, así que
  siguen leyendo la tabla entera. `/buscar?keyword=ab` tarda **~2,6 s** (cuatro consultas
  de ~0,7 s). Y no sirven de mucho en la descripción: `ab` aparece en **12.952 de 15.395
  cursos** (84 %) y `go` en 8.628, casi siempre dentro de otra palabra. Buscando solo en
  el título, la misma consulta tarda ~50 ms. Pero hay búsquedas cortas legítimas («Go»,
  «UX», «IA», «R»), así que no se pueden prohibir.
- **Los comodines de la persona no se escapaban**: `%` y `_` llegaban tal cual al ILIKE.
  `keyword=%%%` devuelve los 15.395 cursos, y no puede usar el índice. Es a la vez un
  resultado absurdo y una forma de pedir la consulta más cara a propósito.

## Criterios de aceptación añadidos tras medir

- **Given** una palabra clave de menos de tres caracteres **When** se busca **Then** se
  busca solo en el título, y responde en lo que tarda una búsqueda normal
- **Given** una palabra clave con `%` o `_` **When** se busca **Then** se buscan como
  caracteres literales, no como comodines

## Fuera de alcance

- **Búsqueda por texto completo** (raíces de palabras, sin tildes, relevancia): cambia
  qué se encuentra y cómo se ordena; merece su propia historia.
- **Subir el `statement_timeout` de `anon`**: escondería el problema y dejaría una
  consulta cara abierta a cualquiera.

## Diseño

- Migración `0010`: extensión `pg_trgm` en el esquema `extensions` (el de Supabase; se
  crea si no existe, para la base de test) e índices GIN de trigramas sobre `title` y
  `description`. **Sin tocar la consulta**: el planificador usa los índices para el
  mismo ILIKE.
- Coste a vigilar: el tamaño de los índices, porque el plan gratuito de Supabase tiene
  500 MB de base. Se mide al aplicarla.
- **En producción**: aplicar `0010` en Supabase Cloud antes de desplegar (igual que
  `0009`, HU-052). Crear un índice GIN sobre 15.000 descripciones tarda unos segundos y
  bloquea escrituras en `courses` mientras dura: hacerlo fuera de la hora de la ingesta.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: patrón de la palabra clave (escapado de `%`, `_`, barra, coma y
      paréntesis; cuándo se busca solo en el título, contando letras y números)
- [x] Integración: la migración crea los índices en la base de test; con datos sembrados,
      el plan de la búsqueda por palabra clave usa el índice y los resultados son los
      mismos que sin él; por el camino real (PostgREST), `%` literal y palabra corta solo
      en el título
- [x] E2E: la búsqueda por palabra clave sigue funcionando (suites existentes de HU-007,
      HU-025, HU-027, HU-028)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Antes y después, medido en desarrollo (15.395 cursos)

Mismos cursos exactos antes y después para «python», «excel», «marketing digital»,
«diseño» y «sql» (comparados id a id).

| | Antes | Después |
|---|---|---|
| Consulta en la base (cinco palabras) | 707–1.007 ms | 36–134 ms |
| Plan | `Seq Scan`, descarta 14.772 filas | `BitmapOr` sobre los dos índices, 26 ms |
| `/buscar?keyword=python` | 1,5–1,7 s | ~0,3 s |
| `keyword=python`, por precio, página 2 | 1,6–1,7 s | ~0,3 s |
| `/buscar?keyword=marketing` | ~1,5 s | 0,5–0,6 s |
| `/buscar?keyword=ab` | ~2,6 s (12.952 cursos) | ~0,3–0,5 s (799, en el título) |
| `/buscar?keyword=%%%` ordenado | 15.395 cursos (comodín) | 0,15 s, ninguno |
| `/buscar?keyword=C++` | — | ~0,3 s, 33 cursos |

La pasada e2e completa bajó a 1,9 min (221/221). La búsqueda `keyword=a` de un test de
HU-042 recorría antes todas las descripciones; probablemente contribuía a los tiempos
agotados de pasadas anteriores.

### Coste

- Índices: 28 MB (descripción) y 2,9 MB (título). La base de desarrollo pasó de 68 a
  99 MB, lejos de los 500 MB del plan gratuito de Supabase.
- Crear los índices tardó 14 s en desarrollo.

### Decisiones tomadas al medir

- **La regla de «solo en el título» cuenta letras y números, no caracteres.** La primera
  versión contaba caracteres y `%%%` (tres caracteres, cero letras) seguía tardando
  1,4 s: los trigramas solo se forman con letras y números.
- **El escape de `%` y `_` se comprobó antes de escribirlo**, contra el PostgREST real:
  una barra invertida (`\%`) en `.or()` y en `.ilike()` devuelve los mismos cursos que la
  consulta SQL directa (1.393 y 26); dos barras devuelven otra cosa.
- **Se retiró un falso positivo propio**: un script de medida marcó `%%%` como página de
  error, pero el registro del servidor tenía 200 sin errores; lo que coincidía era
  «couldn't» dentro de la descripción de un curso.

### En producción

Aplicar `0010` en Supabase Cloud **antes** de desplegar, fuera de la hora de la ingesta
(crear los índices bloquea escrituras en `courses` unos segundos). Y con ella, `0009`
(HU-052).

### Resultado de los tests

- Unitarios (`npm test`): 649 pasan, 7 nuevos.
- Integración (`npm run test:integration`): 130 pasan, 6 nuevos.
- E2E (`npx playwright test`): 221 pasan.

### Revisión de seguridad

Sin hallazgos críticos ni altos, y se cierra uno que había:

- **Comodines de la persona** (antes): `%` y `_` llegaban al ILIKE y permitían pedir la
  consulta más cara a propósito (`%%%`, todo el catálogo, leyendo la tabla). Ahora se
  escapan y, sin letras suficientes, la búsqueda va solo al título, que es barato.
- **Filtro `.or()` de PostgREST**: se sigue escapando coma y paréntesis, y la barra
  invertida se escapa antes, para que un `\` de la persona no pueda deshacer esos escapes.
- **Migración**: `create extension` e índices, sin cambios de permisos ni de RLS.

### Corrección posterior: buscar un título con paréntesis daba 500 (2026-09-15)

Visto durante HU-059: un e2e buscó un curso por su título completo, «Godot 4 Intermediate
Game Development Course (2026)», y la página dio **HTTP 500** («LIKE pattern must not end
with escape character»). El fallo **venía de HU-007**, no de esta historia: el valor del
filtro `.or()` de PostgREST se protegía escapando coma y paréntesis con barra invertida,
y con paréntesis eso nunca funcionó. No se había visto porque ningún test buscaba por el
camino real un texto con paréntesis, y hasta ese día el primer curso de `/buscar` no los
tenía.

Arreglo, comprobado contra el PostgREST real antes de escribirlo (cada caso da los mismos
cursos que la consulta SQL equivalente):

- `patronPalabraClave` devuelve solo el patrón de LIKE (`%`, `_` y `\` escapados).
- `valorFiltroOr` lo mete **entre comillas dobles**, que es la forma documentada para
  valores con comas o paréntesis, escapando `\` y `"`. Dentro de las comillas PostgREST quita
  una barra, así que un `%` literal viaja como `\\%`: con una sola barra daba 1.324 cursos en
  vez de 738.
- La búsqueda solo por título (`.ilike`) no pasa por el analizador de `.or()` y usa el patrón
  tal cual.
- `escapeOrFilterValue`, el escapado que fallaba, se elimina.

Tests: unitarios de `valorFiltroOr` (comillas, barra, comilla, intento de colar otra
condición) y de integración por PostgREST con un título que tiene comilla, coma, paréntesis
y barra, por los dos caminos.
