# HU-041 — Añadir y quitar de la comparación desde la ficha y desde favoritos

## Contexto

Fase 2/3. Depende de HU-040 (la cesta).

Hoy la ficha tiene dos botones distintos según de dónde se venga (HU-031):

- Desde `/buscar` o cualquier otro sitio: «Comparar este curso», que lleva a
  `/buscar?preseleccionado=<id>` y **sustituye** lo que se tenía marcado (reproducido
  el 2026-09-11).
- Desde `/comparar`: «Añadir a la comparación», gracias al parámetro `comparando` que
  lleva la URL de la ficha.

Ninguno sabe si el curso ya está en la comparación, y no hay forma de quitarlo desde la
ficha. Favoritos no permite comparar nada, y comparar lo que se ha guardado es
probablemente el uso más natural de esa lista.

Con la cesta de HU-040, la ficha ya no necesita saber de dónde se viene: le basta con
mirar la cesta.

## Como visitante quiero añadir o quitar un curso de mi comparación desde su ficha y desde mis favoritos para no tener que volver al buscador a marcarlo

## Criterios de aceptación

- **Given** la ficha de un curso que no está en la cesta **When** pulso «Añadir a la
  comparación» **Then** entra en la cesta, sin salir de la ficha, y el botón pasa a
  «Quitar de la comparación»
- **Given** la ficha de un curso que ya está en la cesta **When** la abro **Then** el
  botón dice «Quitar de la comparación», y al pulsarlo sale de la cesta
- **Given** que he marcado un curso en `/buscar` **When** entro en la ficha de otro y lo
  añado **Then** la cesta tiene los dos (el fallo reportado de «Comparar este curso»)
- **Given** que la cesta ya tiene `MAX_COMPARADOS` cursos **When** abro la ficha de otro
  **Then** el botón no está activo y se explica que hay que quitar uno antes (desde la
  barra)
- **Given** mis favoritos **When** miro cada tarjeta **Then** tiene el mismo botón de
  añadir/quitar de la comparación, con el mismo comportamiento que en la ficha
- **Given** que tengo entre 2 y `MAX_COMPARADOS` favoritos **When** miro la página de
  favoritos **Then** hay un enlace «Comparar mis favoritos» que lleva a su comparación
  directamente (funciona sin JavaScript y sin tocar la cesta)
- **Given** que tengo más de `MAX_COMPARADOS` favoritos **When** miro la página **Then**
  no se ofrece «Comparar mis favoritos»; se usan los botones de cada tarjeta
- **Given** que navego sin JavaScript **When** pulso el botón de la ficha **Then** llego
  a `/buscar?preseleccionado=<id>` con ese curso marcado (el comportamiento anterior no
  empeora)
- **Given** una URL antigua `/curso/<id>?comparando=…` (enlaces compartidos antes de
  esta historia) **When** la abro **Then** la ficha carga con normalidad; el parámetro
  se ignora

## Fuera de alcance

- Botón de comparar en las tarjetas de la portada (sigue descartado desde HU-031).
- Cambios en `/comparar` (HU-042).
- Botón de favorito dentro de `/buscar` o de la barra de la cesta.

## Diseño

- **Un único componente** `BotonCesta` («use client») usado en la ficha y en
  favoritos. Se pinta en el servidor como enlace a `/buscar?preseleccionado=<id>` (base
  sin JavaScript); con JavaScript intercepta el clic y alterna la cesta. Su texto y
  estado (`aria-pressed`) salen de la cesta tras hidratar.
- **Se retira de HU-031**: el parámetro `comparando` en la ficha,
  `puedeAnadirseAComparacion` y `hrefAnadirAComparacion` si dejan de usarse, y el
  `?comparando=` de los enlaces de las cabeceras de `/comparar`. Sus tests se
  sustituyen por los de esta historia, que cubren el mismo comportamiento con la cesta:
  no se borran sin reemplazo.
- **«Comparar mis favoritos»**: enlace SSR a `/comparar?ids=<favoritos>`, construido
  con los ids que devuelve la propia lista (ya leídos con RLS de la sesión).

## Cuidados

- **Favoritos es privado**: el enlace «Comparar mis favoritos» lleva ids de cursos
  públicos en la URL, no nada del usuario. Aun así, `/comparar` sigue con
  `robots: noindex`.
- **Sin cambios en la seguridad del favorito**: quitar de favoritos sigue siendo su
  Server Action (HU-019); el botón de la cesta no toca el servidor.
- **Mismo texto y mismo estilo** en ficha y favoritos (los botones de la ficha se
  rediseñaron el 2026-09-10: se reutiliza ese estilo, no se inventa otro).

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: construcción del enlace «Comparar mis favoritos» (0, 1, 2–4 y más de
      4 favoritos) en `compare.test.ts`. El estado del botón (en cesta / fuera / llena)
      es `estaEnCesta`/`estaLlena`/`anadir`/`quitar`, ya cubiertos en
      `cesta-comparar.test.ts` (HU-040); el componente solo los combina
- [x] Integración: no hace falta: «Comparar mis favoritos» reutiliza `listarFavoritos`
      sin consulta nueva
- [x] E2E: un test por criterio de aceptación, incluido sin JavaScript —
      `e2e/cesta-ficha-y-favoritos.spec.ts` (9 tests)
- [x] E2E: los de HU-031 sustituidos por su equivalente con cesta (ver abajo)
- [x] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Cerrada`

### Resultado de los tests

- Unitarios (`npx vitest run`): 455 pasan, 107 omitidos. Uno menos que en HU-040:
  salen los 5 de `puedeAnadirseAComparacion`/`hrefAnadirAComparacion` (funciones
  retiradas) y entran 4 de `hrefCompararFavoritos`.
- Integración (`npm run test:integration`): 107 pasan (22 ficheros).
- E2E (`npx playwright test`): 131 de 131.

### Tests de HU-031 sustituidos, no borrados sin más

De `comparar-desde-cualquier-sitio.spec.ts` salen tres tests cuyo comportamiento ya
no existe (el botón de la ficha llevaba la comparación en la URL). Cada uno tiene su
equivalente en `cesta-ficha-y-favoritos.spec.ts`:

| HU-031 | HU-041 |
|---|---|
| «Comparar este curso» lleva a `/buscar` con el curso marcado | Sin JavaScript, el botón de la ficha lleva a `/buscar?preseleccionado=` marcado; con JavaScript, lo añade sin salir |
| Desde `/comparar`, «Añadir a la comparación» sin perder los demás | Lo marcado en el buscador y lo añadido desde otra ficha se suman |
| Comparación al máximo: no se ofrece añadir y se explica | Con la cesta llena, el botón no está activo y se explica |

Se queda el de enlaces autocontenidos (`/buscar?preseleccionado=`), que sigue siendo
cierto.

### Revisión de seguridad

Sin hallazgos:

- **Menos superficie que antes**: la ficha deja de leer `?comparando=` de la URL
  (entrada externa que había que sanear) y `/comparar` deja de fabricarlo.
- **El botón no toca el servidor**: solo escribe en la cesta, que ya se valida al
  leerla (HU-040). Quitar de favoritos sigue siendo su Server Action, sin cambios.
- **«Comparar mis favoritos»** se construye con los ids que devuelve
  `listarFavoritos` (RLS de la sesión: solo los de la propia persona), codificados con
  `encodeURIComponent`, y `/comparar` los vuelve a sanear. En la URL solo van ids de
  cursos públicos; `/comparar` sigue con `noindex`.
- **El enlace sin JavaScript** a `/buscar?preseleccionado=` usa un id que ya ha pasado
  por `getCourseById` y va codificado; `/buscar` lo valida con `isValidCourseId`.

### Qué cambió respecto al diseño previsto

- **Sin `aria-pressed`**: el texto del botón ya cambia («Añadir» / «Quitar de la
  comparación»), y combinar las dos cosas hace que un lector de pantalla anuncie un
  estado contradictorio («Quitar…, pulsado»). Basta el texto, más el anuncio de la
  barra (HU-040).
- **Enlace antes de hidratar, botón después** (`useHidratado`): así no hay desajuste de
  hidratación y, sin JavaScript, el enlace funciona.
- **`alternar`** no hizo falta finalmente: el botón ya sabe si el curso está en la
  cesta y llama a `anadir` o a `quitar`.

### Visto de paso, fuera de esta historia

En la ficha, a 400 px de ancho, el título se sale por la derecha (imagen y título van
en fila y no se apilan). Mismo tipo de fallo que el de `/buscar` en móvil anotado en
HU-040: anterior a esta historia, queda para una incidencia aparte.
