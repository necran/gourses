# HU-042 — Gestionar la comparación desde `/comparar` y volver sin perder la búsqueda

## Contexto

Fase 2. Depende de HU-040 (la cesta).

En `/comparar` hoy no se puede quitar una columna ni añadir otro curso: hay que volver a
empezar. Además, «Volver a la búsqueda» (en `/comparar` y en la ficha) lleva a
`/buscar` a secas y pierde la palabra clave, los filtros, el orden y la página
(reproducido el 2026-09-11: se venía de `/buscar?keyword=python` y se volvía a
`/buscar`).

También falta decidir qué relación hay entre la URL de `/comparar` (que se comparte) y
la cesta (que es de cada navegador). Decisión: **abrir una comparación la convierte en
la comparación en curso**. Quien la está viendo es con esos cursos con los que va a
seguir trabajando, venga de su propia cesta o de un enlace que le han pasado.

## Como visitante que está comparando quiero quitar o añadir cursos desde la propia comparación y volver a mi búsqueda tal como la dejé para afinar la comparación sin empezar de cero

## Criterios de aceptación

- **Given** una comparación de 3 cursos **When** pulso «Quitar» en la columna de uno
  **Then** la comparación se queda con los otros 2, la URL cambia a esos 2 ids (sigue
  siendo compartible) y la cesta también
- **Given** una comparación de 2 cursos **When** quito uno **Then** se explica que hace
  falta al menos otro, y el que queda sigue en la cesta
- **Given** una comparación con menos de `MAX_COMPARADOS` cursos **When** pulso «Añadir
  otro curso» **Then** vuelvo a mi última búsqueda con esos cursos ya marcados
- **Given** que abro un enlace de comparación compartido **When** carga **Then** la
  cesta pasa a ser exactamente esos cursos (los que existan), y la barra lo refleja
- **Given** un enlace de comparación con un curso ya retirado del catálogo **When** lo
  abro **Then** ese curso desaparece también de la cesta (no queda un título fantasma
  en la barra)
- **Given** que venía de `/buscar?keyword=python&orden=precio-asc&pagina=2` **When**
  pulso «Volver a la búsqueda» en `/comparar` o en una ficha **Then** vuelvo a esa
  misma búsqueda, con sus filtros, su orden y su página
- **Given** que llego a `/comparar` o a una ficha sin haber buscado antes en esta
  pestaña (enlace directo) **When** pulso «Volver a la búsqueda» **Then** voy a
  `/buscar` sin filtros
- **Given** que navego sin JavaScript **When** uso `/comparar` **Then** «Quitar» sigue
  funcionando (es un enlace a la comparación sin ese id) y «Volver a la búsqueda» lleva
  a `/buscar`

## Fuera de alcance

- Reordenar las columnas de la comparación.
- Guardar comparaciones con nombre o en la cuenta.
- Cambiar los campos que se comparan (HU-017).

## Diseño

- **«Quitar» por columna**: enlace SSR a `/comparar?ids=<resto>` (funciona sin
  JavaScript). Con JavaScript, además actualiza la cesta.
- **Adoptar la URL como cesta**: un componente cliente en `/comparar` recibe del
  servidor la lista **ya saneada y resuelta contra el catálogo** (`cursos`, no los ids
  crudos de la URL) y la escribe en la cesta al montar.
- **Última búsqueda**: `/buscar` guarda su propia dirección en `sessionStorage` (por
  pestaña, se borra al cerrarla). «Volver a la búsqueda» y «Añadir otro curso» la
  usan si existe; si no, `/buscar`.

## Cuidados

- **Nada de redirección abierta**: lo guardado en `sessionStorage` es entrada externa.
  Solo se acepta si, al interpretarlo, es una ruta `/buscar` del propio sitio; se
  reconstruye a partir de los filtros saneados por `parseCourseSearchFilters`, nunca
  se usa la cadena guardada tal cual como `href`. Sin esquema, sin host, sin `//`.
- **Adoptar no confía en la URL**: se adoptan solo los cursos que el servidor ha
  encontrado, así que un id inventado o retirado nunca llega a la cesta.
- **Quitar la última columna de un par**: no deja una página rota ni vacía; es el
  aviso de «hace falta al menos otro» que ya existe.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: construcción del enlace «Quitar» (orden conservado, último curso) en
      `compare.test.ts`; validación de la última búsqueda guardada (rutas ajenas,
      `//evil`, `javascript:`, `data:`, barras invertidas, `..`, parámetros basura,
      vacío) en `ultima-busqueda.test.ts`; `reemplazar` en `cesta-comparar.test.ts`
- [x] Integración: no hace falta: no hay consulta nueva (`/comparar` sigue usando
      `getCoursesByIds`)
- [x] E2E: un test por criterio de aceptación, incluido sin JavaScript —
      `e2e/gestionar-comparacion.spec.ts` (8 tests)
- [x] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Cerrada`

### Resultado de los tests

- Unitarios (`npx vitest run`): 477 pasan, 107 omitidos (22 nuevos).
- Integración (`npm run test:integration`): 107 pasan (22 ficheros).
- E2E (`npx playwright test`): 139 de 139.

En la primera pasada completa fallaron 2 tests de HU-040 (`cesta-comparar.spec.ts`:
«atrás» desde la ficha y páginas distintas), los dos en el mismo instante y por lo
mismo: tras pulsar un enlace, la navegación no llegó en los 5 s de espera. Esa misma
pasada, la integración tardó 290 s frente a unos 200 s habituales (la base del NAS iba
lenta). Repetidos 12 veces con 5 procesos en paralelo pasaron todos, y la suite
completa volvió a pasar entera. No se tocó ningún tiempo de espera: no había nada que
arreglar en el código ni en los tests.

### Revisión de seguridad

Sin hallazgos. El punto delicado era la última búsqueda, que acaba en un `href`:

- **Sin redirección abierta**: lo leído de `sessionStorage` solo se acepta si, resuelto
  contra un origen ficticio, sigue en ese mismo origen y en la ruta exacta `/buscar`.
  Aun así la cadena guardada nunca se usa: se reconstruye con
  `parseCourseSearchFilters` + `enlacePagina`, igual que la paginación. Probado con
  `//evil.com`, `https://evil.com/buscar`, `javascript:`, `data:`, `/\evil.com`,
  `\\evil.com`, `/buscar/../mi-cuenta` y URLs mal formadas: todas dan `/buscar`.
- **Adoptar no confía en la URL**: `AdoptarComparacion` recibe los cursos que el
  servidor encontró en el catálogo, no los ids crudos, y pasa por `anadir` (ids
  válidos, sin repetidos, tope). Un id inventado o retirado nunca llega a la cesta.
- **«Quitar»** se construye con ids ya resueltos contra el catálogo y codificados; el
  destino vuelve a pasar por `parseCompareIds`.
- **Nada personal**: `sessionStorage` guarda solo la dirección de búsqueda de esta
  pestaña, y se borra al cerrarla.

### Qué cambió respecto al diseño previsto

- **«Quitar» no necesita JavaScript propio**: es un enlace a la comparación sin ese
  curso, y es la adopción al abrirla la que pone la cesta al día. Un solo camino para
  «quitar» y para «abrir un enlace».
- **Va en una fila «Quitar» al final de la tabla**, junto a «Ir al curso», no en la
  cabecera: así la cabecera de cada columna sigue siendo solo el título.
- **Solo se adopta si la dirección trae algún id válido**: `/comparar` a secas no vacía
  la cesta.
- **La dirección de la búsqueda se guarda ya saneada** desde el servidor
  (`enlacePagina`, extraída a `buscar-enlaces.ts` para reutilizarla), y además se vuelve
  a sanear al leerla.
- **Cambia un criterio de HU-041**: «Comparar mis favoritos» ya no deja la cesta
  intacta, porque abrir la comparación la adopta. Su test se actualizó a lo nuevo (la
  barra muestra esos favoritos), de acuerdo con la decisión de esta historia.

### Visto de paso, fuera de esta historia

En `/comparar` a 400 px, el texto de introducción se sale por la derecha. Es el mismo
fallo de móvil que ya se anotó en `/buscar` (HU-040) y en la ficha (HU-041): anterior a
estas historias, queda para una incidencia aparte.
