# HU-061 — Buscar sin tildes

## Contexto

Fase 6 (2026-09-15). Mucha gente escribe sin tildes, sobre todo en el móvil, y la búsqueda
por palabra clave compara el texto tal cual. Medido en la base de desarrollo, buscando en
título o descripción:

| Se escribe | Cursos | Con tilde | Cursos |
|---|---|---|---|
| «programacion» | 7 | «programación» | 332 |
| «diseno» | 2 | «diseño» | 537 |
| «informatica» | 2 | «informática» | 35 |
| «fotografia» | 18 | «fotografía» | 109 |
| «ingles» | 40 | «inglés» | 62 |

Quien busca «diseno» ve dos cursos y concluye que el catálogo no tiene diseño.

La extensión `unaccent` de Postgres existe en desarrollo y en Supabase. Comprobado dentro de
una transacción deshecha: «Programación, DISEÑO, pingüino, Ñandú, café, naïve, œuvre» →
«Programacion, DISENO, pinguino, Nandu, cafe, naive, oeuvre», y deja `%` y `#` intactos.

## Como visitante quiero encontrar los cursos aunque escriba sin tildes para no perderme la mitad del catálogo

## Criterios de aceptación

- **Given** cursos con «Diseño» en el título **When** busco «diseno» **Then** aparecen, igual
  que buscando «diseño»
- **Given** una búsqueda con tildes **When** la hago **Then** encuentra también los cursos
  escritos sin ellas (buscar «programación» encuentra «Programacion»)
- **Given** cualquier búsqueda por palabra clave **When** se ejecuta **Then** sigue usando un
  índice (HU-057) y no vuelve a recorrer la tabla entera
- **Given** las reglas de HU-057 **When** se busca **Then** se mantienen: `%` y `_` literales,
  menos de tres letras o números solo en el título, y los signos del filtro `.or()` protegidos

## Fuera de alcance

- **Búsqueda por texto completo** (plurales, raíces, relevancia).
- **Quitar tildes al mostrar**: los títulos se enseñan como los escribe la plataforma.
- **Páginas de tema y categorías**: no buscan por palabra clave.

## Diseño

- **Columnas generadas** `titulo_busqueda` y `descripcion_busqueda`, calculadas por Postgres
  con `unaccent`, e índices de trigramas sobre ellas. Se mantienen solas: ni la ingesta ni
  un relleno tienen que acordarse de calcularlas.
- `unaccent` no es inmutable (depende de un diccionario), y una columna generada lo exige: se
  envuelve en una función inmutable con el diccionario fijado, en el esquema `extensions`
  para que PostgREST no la ofrezca como llamada.
- **Los índices de HU-057** sobre `title` y `description` dejan de usarse y se eliminan, para
  que la base no crezca el doble. Coste esperado: unos 35 MB más de columna (la base de
  desarrollo mide 124 MB; el plan gratuito de Supabase, 500 MB).
- **La palabra clave** se normaliza en TypeScript de la misma forma (descomponer y quitar las
  marcas diacríticas, más las ligaduras que `unaccent` convierte) y se busca en las columnas
  nuevas. Un test de integración compara la normalización de TypeScript con la de la base.
- **En producción**: añadir una columna generada reescribe la tabla y bloquea escrituras
  mientras dura. Aplicar fuera de la hora de la ingesta.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: quitar tildes (vocales, ñ, ü, mayúsculas, ligaduras, signos intactos) y que
      el patrón de HU-057 se construye sobre el texto normalizado
- [x] Integración: por PostgREST, «diseno» encuentra «Diseño» y al revés; el plan usa los
      índices nuevos; TypeScript y `unaccent` normalizan igual una lista de palabras reales
- [x] E2E: un test por criterio de aceptación (el del índice, en integración: es el plan de
      la consulta, no algo que se vea en el navegador)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Antes y después, en desarrollo

| Búsqueda | Antes | Después |
|---|---|---|
| «diseno» / «diseño» | 2 / 537 | 541 / 541 |
| «programacion» / «programación» | 7 / 332 | 338 / 338 |
| «informatica» | 2 | 37 |

Tiempos de página sin carga: 0,3–0,6 s. Con datos reales, «diseno» usa los dos índices
nuevos (`BitmapOr`) y la consulta tarda 74 ms.

### Coste

- La migración `0014` tardó **61 s** en desarrollo: añadir columnas generadas reescribe la
  tabla. **En producción, aplicarla fuera de la hora de la ingesta.**
- La base de desarrollo pasó de 124 a 122 MB: las columnas nuevas ocupan, pero se quitan los
  índices de HU-057 sobre `title` y `description`, que ya no usa ninguna búsqueda.

### Tests que cambiaron

- `busqueda-trigramas.test.ts` (HU-057) comprobaba los índices por nombre y la consulta sobre
  `title`/`description`. Se actualizó a las columnas e índices nuevos: lo que comprueba (que
  existen, que la búsqueda puede usarlos y que dan los mismos resultados) no cambia.

### Resultado de los tests

- Unitarios (`npm test`): 754 pasan, 6 nuevos.
- Integración (`npm run test:integration`): 142 pasan, 2 nuevos.
- E2E (`npx playwright test`): 242 pasan, 3 nuevos, en 2,2 min.

### Revisión de seguridad

Sin hallazgos críticos ni altos:

- **Función `sin_tildes`**: en el esquema `extensions`, que PostgREST no expone; no se puede
  llamar desde fuera. Solo transforma texto.
- **Columnas generadas**: las calcula Postgres a partir de datos que ya estaban; no hay
  entrada nueva.
- **Palabra clave**: se quitan las tildes antes del escapado de HU-057 y del filtro con
  comillas del arreglo de HU-059, que siguen igual.
