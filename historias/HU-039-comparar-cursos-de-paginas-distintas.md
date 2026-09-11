# HU-039 — Poder comparar cursos de páginas distintas del buscador

## Contexto

Fase 2/3, deuda de HU-017 (el comparador) y HU-025 (la paginación), que nunca llegaron
a encontrarse.

Reportado como incidencia y reproducido: en `/buscar`, marcar un curso en la página 1,
ir a la página 2, marcar otro y pulsar «Comparar seleccionados» lleva a
`/comparar?ids=<solo el de la página 2>` — el primero desaparece sin aviso, y la
página de comparación, con menos de dos cursos, responde «Hace falta al menos un
curso más. Vuelve al buscador y marca otro», que manda de vuelta sin memoria de lo
que ya se había marcado.

La causa está en dos sitios:

1. **El formulario de comparar es una `<form method="get">` que envuelve la lista de
   una sola página.** Solo puede enviar lo que está marcado en el HTML que hay cargado
   ahora mismo; lo marcado en una carga anterior de la página ya no existe en el DOM.
2. **`enlacePagina` (en `src/app/buscar/page.tsx`) no lleva ningún id seleccionado.**
   Reconstruye la URL de «Siguiente»/«Anterior» solo a partir de los filtros de
   búsqueda (`keyword`, `maxPrice`, …); ni siquiera el único curso que puede llegar
   preseleccionado desde una ficha (`?preseleccionado=`, HU-031) sobrevive a un cambio
   de página, aunque eso no se había notado porque esa vía solo marca uno.

HU-031 fijó un principio que esta historia no toca: **la selección vive en la URL,
nunca en estado del navegador** — nada de cookies ni de JavaScript de cliente para
recordarla entre páginas. El fallo no es que ese principio esté mal, es que no se
aplicó a la paginación: la URL nunca llegó a llevar la selección acumulada, solo la
de la página actual.

## Como visitante que busca cursos quiero poder añadir a la comparación cursos que aparecen en páginas distintas de los mismos resultados para no tener que encontrarlos todos en una sola pantalla

## Criterios de aceptación

- **Given** que he marcado un curso en la página 1 de resultados
  **When** voy a la página 2 y marco otro
  **Then** al pulsar «Comparar seleccionados» llego a una comparación con los dos, no
  solo con el de la página 2

- **Given** que tengo cursos marcados de páginas distintas
  **When** miro la página que estoy viendo ahora
  **Then** se me dice cuántos llevo marcados en total (no solo los de esta página), para
  no pensar que se han perdido

- **Given** que tengo cursos marcados de otra página
  **When** cambio el orden, un filtro o la palabra clave de la búsqueda
  **Then** la selección acumulada sigue ahí (es de los cursos, no de la búsqueda que los
  encontró)

- **Given** que ya tengo el máximo de cursos marcados (`MAX_COMPARADOS`)
  **When** veo otra página de resultados
  **Then** las casillas de más cursos aparecen deshabilitadas o se explica que hay que
  quitar uno antes, en vez de dejar marcar un quinto que luego se recorta en
  silencio

- **Given** que tengo cursos marcados de páginas distintas
  **When** quito uno de los que ya llevaba (sin haberlo visto de nuevo en pantalla)
  **Then** puedo hacerlo, sin tener que volver a la página donde apareció

- **Given** una comparación ya construida así, con cursos de páginas distintas
  **When** copio la dirección de `/comparar` y la abro de nuevo
  **Then** obtengo la misma comparación (esto ya funciona hoy; no debe romperse)

## Fuera de alcance

- **Recordar la selección entre visitas o pestañas distintas.** Sigue viviendo en la
  URL de la sesión de búsqueda actual, no en una cuenta ni en almacenamiento del
  navegador. Quien cierra la pestaña sin haber comparado, la pierde — igual que hoy.
- **Seleccionar cursos de búsquedas distintas** (por ejemplo, un curso encontrado con
  una palabra clave y otro con otra, sin haber comparado entre medias). Esta historia
  cubre acumular a través de la paginación y de refinar filtros de la misma sesión de
  búsqueda; combinar resultados de búsquedas que la persona considera «distintas»
  intentos es un caso de uso más amplio, no confirmado.
- **Ampliar `MAX_COMPARADOS`.** Sigue en 4; esta historia trata de alcanzarlo desde
  varias páginas, no de subirlo.
- **Un contador o «cesta» persistente visible en toda la navegación** (tipo carrito de
  compra, con icono en la cabecera). Esta historia soluciona el caso reportado con lo
  mínimo — un aviso en la propia página de resultados—; una cesta con entidad propia
  es una ampliación posterior si hace falta.

## Diseño elegido, y el que se descartó

**Se acumula en la URL con un botón explícito, no marcando la casilla.** Al pulsar
«Guardar selección y seguir buscando» (nuevo, junto al ya existente «Comparar
seleccionados»), el formulario manda lo marcado en esta página a un parámetro
acumulado (`comparando`, mismo nombre que ya usa la ficha de curso desde HU-031) y
vuelve a la misma búsqueda con ese parámetro añadido a la URL. Desde ahí, los enlaces
de paginación y el propio formulario de la página siguiente llevan ese parámetro, con
sus ids como casillas ya marcadas (deshabilitadas, para no confundir con «marcado en
esta página») más las nuevas que se marquen. «Comparar seleccionados» siempre manda la
unión de lo acumulado y lo recién marcado.

**Se descartó JavaScript de cliente que capture el estado de las casillas al navegar
de página** (interceptar el clic en «Siguiente» y añadir a la URL lo marcado sin
pulsar ningún botón nuevo). Sería una interacción más fluida, pero **sin JavaScript no
funcionaría en absoluto** —dejaría de nuevo sin poder comparar cursos de páginas
distintas, que es justo el fallo de esta historia—, mientras que el botón explícito
degrada con normalidad: sin JavaScript, sigue siendo un `<button type="submit">` de
toda la vida. Es la misma razón por la que HU-031 ya rechazó guardar la selección en
el navegador.

## Cuidados

- **`parseCompareIds` ya hace el trabajo de fusionar y acotar** (admite repetidos,
  descarta inválidos, corta en `MAX_COMPARADOS`): la fusión de «acumulado + recién
  marcado» pasa por ahí, no por una función nueva que reimplemente el mismo cuidado.
- **El parámetro acumulado es entrada externa** igual que `ids` en `/comparar` y
  `comparando` en la ficha (HU-031): se sanea con `parseCompareIds` antes de usarlo
  para nada, nunca se confía en que venga bien formado.
- **No se vuelve a consultar la base de datos por los cursos acumulados solo para
  pintar su casilla como marcada.** Una casilla deshabilitada con el id ya conocido
  (`<input type="hidden">` o `disabled checked`) no necesita el título ni el precio del
  curso — esos ya se mostraron cuando se marcó, en su propia página. Pedirlos de nuevo
  aquí sería una consulta extra en cada página de resultados por algo que no hace
  falta ver dos veces.
- **El aviso de «cuántos llevas» no debe ser el único sitio donde se pueda quitar
  uno.** El criterio de aceptación lo pide explícitamente: tiene que poder quitarse
  sin volver a la página donde apareció, así que el aviso lleva su propio control por
  curso (aunque sea solo el título y un enlace «Quitar»), no una lista muda.
- **Cambiar de página de resultados no debe perder la selección aunque también cambie
  el filtro.** `enlacePagina` reconstruye la URL entera a partir de `filters`; el
  parámetro `comparando` tiene que añadirse ahí igual que los demás, no solo en el
  enlace de paginación.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: fusión de ids acumulados + recién marcados vía `parseCompareIds` —
      duplicados, inválidos, y recorte al llegar a `MAX_COMPARADOS`
- [ ] Unitarios: `enlacePagina` (o su reemplazo) conserva el parámetro `comparando`
      junto con los filtros existentes
- [ ] E2E: un test por cada criterio de aceptación de arriba
- [ ] E2E: con el máximo ya alcanzado, las casillas de una página nueva no permiten
      marcar una quinta sin avisar
- [ ] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Abierta`
