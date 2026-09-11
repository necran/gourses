# HU-040 — Cesta de comparación que no se pierde al navegar

## Contexto

Fase 2, deuda de HU-017 (comparador), HU-031 (comparar desde la ficha) y HU-039
(páginas distintas, sin fusionar — ver su apartado «Estado»).

Incidencia reportada y reproducida en el navegador el 2026-09-11:

| Recorrido | Qué pasa hoy |
|---|---|
| Marco uno en `/buscar` → entro en la ficha de otro → «atrás» | Vuelve a `/buscar` sin nada marcado |
| Marco uno → ficha de otro → «Comparar este curso» | Llega a `/buscar?preseleccionado=<el nuevo>`: el primero desaparece |
| Comparo dos → «Volver a la búsqueda» en `/comparar` | Llega a `/buscar` a secas: sin selección y sin la búsqueda |
| Comparo dos → «atrás» del navegador | Funciona, pero por casualidad (el navegador recuerda el formulario) |

**Causa común:** lo marcado solo existe en las casillas de la página abierta. Sobrevive
únicamente si el enlace por el que se sale lo lleva en su URL, y cada enlace nuevo del
sitio vuelve a abrir el mismo agujero. HU-039 lo tapó para paginación y filtros; la
ficha, «atrás», la cabecera o favoritos siguen perdiéndolo.

**Decisión de producto (explícita, 2026-09-11):** se abandona el principio de HU-017 y
HU-031 de que «la selección vive en la URL, nunca en el navegador». Se sustituye por:

- **La selección en curso vive en el navegador**: una «cesta» de hasta
  `MAX_COMPARADOS` cursos guardada en `localStorage`, visible y editable desde cualquier
  página.
- **El resultado sigue viviendo en la URL**: `/comparar?ids=…` no cambia, se puede
  compartir y abrir sin cesta ni JavaScript.

Se descartó mantenerlo todo en la URL (reescribiendo la dirección con
`history.replaceState` y enhebrando `comparando` por cada enlace): arreglaba «atrás»,
pero cualquier salida que no lo llevara (cabecera, favoritos, otra pestaña, escribir una
dirección) seguía perdiéndolo; frágil por diseño.

Esta historia es la base: la cesta, la barra que la muestra y `/buscar`. La ficha y
favoritos son HU-041; `/comparar` es HU-042.

## Como visitante que compara cursos quiero que lo que he marcado para comparar se mantenga mientras navego por la web para no tener que volver a encontrarlo

## Criterios de aceptación

- **Given** que he marcado un curso en `/buscar` **When** entro en la ficha de otro y
  vuelvo con «atrás» del navegador **Then** el curso sigue marcado
- **Given** que he marcado un curso en la página 1 **When** paso a la página 2, marco
  otro y pulso «Comparar» **Then** la comparación tiene los dos (criterio heredado de
  HU-039)
- **Given** que he marcado cursos **When** cambio la palabra clave, un filtro o el orden
  **Then** siguen marcados, y los que aparezcan en los nuevos resultados salen con su
  casilla marcada
- **Given** que tengo al menos un curso en la cesta **When** estoy en cualquier página
  de la web **Then** veo una barra con cuántos llevo (p. ej. «2 de 4»), el título de
  cada uno y un botón «Comparar»
- **Given** que tengo un solo curso en la cesta **When** miro la barra **Then** el botón
  «Comparar» no está activo y se explica que falta al menos otro
- **Given** que tengo cursos en la cesta **When** pulso la × de uno en la barra **Then**
  sale de la cesta y, si su casilla está en pantalla, se desmarca
- **Given** que tengo cursos en la cesta **When** pulso «Vaciar» **Then** la cesta
  queda vacía, la barra desaparece y no queda ninguna casilla marcada
- **Given** que la cesta ya tiene `MAX_COMPARADOS` cursos **When** miro los resultados
  **Then** las casillas de los demás aparecen deshabilitadas con la explicación de que
  hay que quitar uno antes
- **Given** que tengo cursos en la cesta **When** recargo la página, cierro y vuelvo a
  abrir la pestaña, o abro la web en otra pestaña **Then** la cesta sigue ahí
- **Given** dos pestañas abiertas **When** marco o quito un curso en una **Then** la
  otra lo refleja sin recargar
- **Given** que el navegador no deja guardar datos (modo privado estricto,
  almacenamiento bloqueado) **When** marco cursos **Then** la cesta funciona mientras
  no salga de la página, sin errores, igual que antes de esta historia
- **Given** que navego sin JavaScript **When** marco cursos en una página de `/buscar`
  y pulso «Comparar» **Then** llego a la comparación de esos cursos (el comportamiento
  anterior a esta historia no empeora; la cesta simplemente no existe)
- **Given** que llego a `/buscar?preseleccionado=<id>` (enlaces antiguos o sin
  JavaScript) **When** carga la página **Then** ese curso se **añade** a la cesta, sin
  sustituir lo que ya había
- **Given** la política de privacidad **When** la leo **Then** explica que se guarda en
  el navegador la lista de cursos marcados para comparar, que no son datos personales,
  que no sale del dispositivo salvo al pulsar «Comparar», y cómo borrarla

## Fuera de alcance

- Añadir y quitar desde la ficha y desde favoritos (HU-041).
- Quitar y añadir en `/comparar`, y volver a la búsqueda sin perderla (HU-042).
- Casillas en la portada: se quitaron a petición expresa en HU-031 y siguen fuera.
- Guardar la cesta en la cuenta del usuario o sincronizarla entre dispositivos.
- Cambiar `MAX_COMPARADOS` (sigue en 4).

## Diseño

- **Almacén** (`src/lib/courses/cesta-comparar.ts`, lógica pura + un adaptador fino a
  `localStorage`): lista ordenada de `{ id, titulo }`. El título solo sirve para pintar
  la barra sin pedir nada al servidor; los ids son la única fuente de verdad. Funciones
  puras: `leerCesta(bruto)`, `anadir`, `quitar`, `alternar`, `vaciar`, `estaLlena`.
- **Lectura tolerante**: lo leído de `localStorage` es entrada externa (lo puede editar
  la propia persona o cualquier extensión). JSON inválido, ids que no pasen
  `isValidCourseId`, repetidos, títulos que no sean texto o más de `MAX_COMPARADOS`
  se descartan o recortan en silencio, mismo criterio que `parseCompareIds`. Cualquier
  excepción al leer o escribir (almacenamiento bloqueado) deja la cesta en memoria.
- **Estado compartido en cliente** con `useSyncExternalStore` sobre ese almacén, más
  el evento `storage` para las otras pestañas.
- **Barra** (`src/components/barra-cesta.tsx`, en el layout): fija abajo, solo
  visible con la cesta no vacía. «N de 4», un chip por curso con su título y una ×
  (`aria-label="Quitar <título> de la comparación"`), «Vaciar» y «Comparar» (enlace a
  `/comparar?ids=…`). Una región `aria-live` anuncia cada alta y baja. Deja hueco
  abajo para no tapar contenido, y funciona a 400 px de ancho.
- **`/buscar`**: las casillas siguen siendo `<input type="checkbox" name="ids">` dentro
  del formulario GET hacia `/comparar` (base sin JavaScript). Con JavaScript, marcar o
  desmarcar alterna la cesta, y al montar se marcan las que están en la cesta. Se
  pintan desmarcadas desde el servidor y se marcan tras hidratar: aceptado.
- **Se retira de HU-039** (rama sin fusionar): `SincronizarComparando`, el parámetro
  `comparando` de `/buscar` y el aviso «llevas N marcados». Se reaprovechan la prop
  `disabled` de `CasillaComparar` y los tests e2e de sus criterios.

## Cuidados

- **El servidor no se fía de la cesta.** Solo le llega en `/comparar?ids=`, que ya
  sanea `parseCompareIds`. Un curso retirado del catálogo desaparece de la comparación
  como hoy; la barra seguirá mostrando su título hasta que se abra `/comparar`
  (HU-042 la reconcilia).
- **Títulos pintados como texto** (JSX), nunca como HTML: vienen de `localStorage`.
- **Nada personal en el almacén**: ids y títulos de cursos públicos. Almacenamiento
  funcional pedido por la propia persona → no requiere consentimiento, pero sí
  constar en `/privacidad` (HU-013 exige que describa lo que se usa de verdad).
- **Sin parpadeo de la barra al hidratar**: no se pinta en el servidor (no conoce la
  cesta); aparece en cliente sin desplazar el contenido.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: `leerCesta` con JSON inválido, ids inválidos, repetidos, más de 4,
      títulos no textuales; `anadir`/`quitar`/`vaciar`; tope de
      `MAX_COMPARADOS`; almacenamiento que lanza al leer o escribir —
      `cesta-comparar.test.ts` y `almacen-cesta.test.ts` (34 tests)
- [x] Integración: no hace falta fichero nuevo: no se añade ninguna consulta (la
      comparación reutiliza `getCoursesByIds`, ya cubierta)
- [x] E2E: un test por criterio de aceptación, incluidos «atrás» desde la ficha, otra
      pestaña, recarga, almacenamiento bloqueado y sin JavaScript —
      `e2e/cesta-comparar.spec.ts` (14 tests)
- [x] E2E: los de HU-017 (`comparar.spec.ts`) y HU-031
      (`comparar-desde-cualquier-sitio.spec.ts`) pasan sin tocarlos. Los de HU-039 no
      se trasladan tal cual: sus criterios (páginas distintas, quitar sin volver, tope,
      sin JavaScript) están cubiertos por los de esta historia
- [x] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Cerrada`

### Resultado de los tests

- Unitarios (`npx vitest run`): 456 pasan, 107 omitidos, sin regresiones.
- Integración (`npm run test:integration`): 107 pasan (22 ficheros).
- E2E (`npx playwright test`): 124 de 125. El que falla es
  `seo.spec.ts › cada ficha tiene su propio título`, intermitente y ajeno a esta
  historia (ya falló igual al cerrar HU-039): abre la ficha del primer resultado de
  `/buscar` y a veces es un curso que otro test en paralelo acaba de sembrar y borrar,
  así que ve «Curso no encontrado». Pasa en un segundo pase, igual que los 14 de esta
  historia.

### Revisión de seguridad

Sin hallazgos. La cesta no añade ninguna vía nueva hacia el servidor ni ninguna
consulta:

- **Lo leído de `localStorage` es entrada externa** y se trata así: `leerCesta` descarta
  JSON inválido, ids que no pasan `isValidCourseId`, repetidos, títulos que no son texto
  (y recorta los largos a 300) y todo lo que pase de `MAX_COMPARADOS`.
- **El servidor no se fía de la cesta**: solo le llega en `/comparar?ids=`, que sigue
  saneando `parseCompareIds`. Los ids van codificados con `encodeURIComponent` y el
  destino lo construye el propio código (`hrefComparar`), nunca una cadena guardada.
- **Títulos pintados como texto** (JSX y atributos de React, que escapan), nunca como
  HTML.
- **Sin datos personales** en el almacén (ids y títulos de cursos públicos),
  documentado en `/privacidad`.

### Qué cambió respecto al diseño previsto

- **La barra no se quedaba fija abajo.** `body` tenía `overflow-x: hidden`, que lo
  convierte en un contenedor con scroll propio que nunca se desplaza, y eso anula
  cualquier `position: sticky` de dentro. Los e2e pasaban igual porque «visible» en
  Playwright no exige estar en pantalla. Se cambió a `overflow-x: clip` en `body` (mismo
  efecto de no dejar scroll horizontal, sin ese problema) y se añadió
  `toBeInViewport()` al test de la barra, que ahora falla si vuelve a pasar.
- **`alternar` no se ha escrito**: aquí no lo usa nadie. Llega con el botón de la ficha
  (HU-041).
- **`?preseleccionado=` no se borra de la URL** tras sumarlo a la cesta: el test de
  HU-031 comprueba esa URL, y HU-041 sustituye esa vía para quien tiene JavaScript.
  Efecto menor aceptado: si alguien quita ese curso y recarga esa misma URL, vuelve a
  entrar.

### Visto de paso, fuera de esta historia

En móvil (400 px), `/buscar` ya se cortaba por la derecha antes de esta historia: las
tarjetas y el campo de palabra clave se salen de la pantalla. Queda como incidencia
aparte.
