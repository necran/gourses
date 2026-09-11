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

- [ ] Unitarios: `leerCesta` con JSON inválido, ids inválidos, repetidos, más de 4,
      títulos no textuales; `anadir`/`quitar`/`alternar`/`vaciar`; tope de
      `MAX_COMPARADOS`; almacenamiento que lanza al leer o escribir
- [ ] Integración: no hace falta fichero nuevo si no se añade ninguna consulta (la
      comparación reutiliza `getCoursesByIds`, ya cubierta)
- [ ] E2E: un test por criterio de aceptación, incluidos «atrás» desde la ficha, otra
      pestaña, recarga, almacenamiento bloqueado y sin JavaScript
- [ ] E2E: los de HU-017 y HU-039 que sigan aplicando, adaptados sin relajar lo que
      comprueban
- [ ] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Abierta`
