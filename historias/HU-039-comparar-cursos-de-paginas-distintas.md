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

HU-031 fijó un principio que esta historia **sí toca, a propósito y con el visto
bueno de quien decide el producto**: hasta ahora, «la selección vive en la URL, nunca
en estado del navegador» significaba también «nada de JavaScript de cliente para
recordarla entre páginas». Esta historia añade una pieza de JavaScript pequeña y bien
acotada —lee las casillas marcadas en la página que hay cargada y reescribe con ellas
los enlaces de paginación y el formulario de filtros antes de que naveguen— para que
marcar cursos y pulsar «Siguiente» los lleve consigo sin un paso de más. Sigue sin
haber estado: lo único que hace el script es mantener al día la URL a la que se va a
navegar; nada se guarda en el navegador, y quien copie esa URL y la abra en otro sitio
obtiene exactamente la misma selección. Ver «Diseño elegido» para el porqué y el trato
de quien no tiene JavaScript.

## Como visitante que busca cursos quiero poder añadir a la comparación cursos que aparecen en páginas distintas de los mismos resultados para no tener que encontrarlos todos en una sola pantalla

## Criterios de aceptación

- **Given** que he marcado un curso en la página 1 de resultados, con JavaScript
  **When** voy a la página 2 (pulsando «Siguiente», sin ningún paso de más) y marco
  otro
  **Then** al pulsar «Comparar seleccionados» llego a una comparación con los dos, no
  solo con el de la página 2

- **Given** el mismo caso, pero sin JavaScript
  **When** voy a la página 2 y marco otro
  **Then** el comportamiento no empeora respecto a hoy (la selección de la página 1 no
  sobrevive), y no aparece ningún error ni un formulario roto

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

**Decisión (revisada tras la primera versión de esta historia):** JavaScript de
cliente captura las casillas marcadas y las lleva consigo al navegar, sin un botón
nuevo que pulsar. Se evaluó primero un botón explícito («Guardar selección y seguir
buscando») precisamente por no depender de JavaScript, pero se descartó porque la
interacción quedaba peor —un paso de más solo para conseguir lo que debería ser
automático— y aquí ya se pidió expresamente la versión con JavaScript, asumiendo su
única contrapartida real: quien navega sin JavaScript vuelve a tener el fallo original
(la selección no sobrevive a cambiar de página). Se acepta ese trato porque:

- **Quien no tenga JavaScript no queda peor que hoy**: hoy la selección ya no
  sobrevive a cambiar de página para nadie. Esta historia mejora la situación para la
  inmensa mayoría sin empeorarla para nadie.
- Todo lo demás del sitio (los propios filtros de esta página, el resto del
  comparador, el acceso, los favoritos…) sigue funcionando sin JavaScript; esta
  historia no cambia eso en ningún otro sitio, solo en el paso concreto de «llevar la
  selección de una página de resultados a la siguiente».
- La URL sigue siendo la única fuente de verdad: el script no guarda nada por su
  cuenta (ni `localStorage`, ni cookies propias): su trabajo es, antes de que el
  navegador siga un enlace o envíe un formulario, actualizar el parámetro `comparando`
  de ese enlace o formulario con lo que hay marcado ahora mismo. Copiar la URL
  resultante y abrirla en otra pestaña, sin JavaScript de por medio, reproduce la
  misma selección — sigue siendo compartible, cacheable y sin estado del lado del
  servidor.

### Cómo funciona

1. `/buscar` acepta un parámetro `comparando` (mismo nombre y mismo saneado con
   `parseCompareIds` que ya usa la ficha de curso desde HU-031): la lista de cursos
   acumulados de páginas anteriores de esta misma búsqueda.
2. Con `comparando` no vacío, la página muestra un aviso con cuántos hay y su título
   (una consulta más, solo cuando hace falta), cada uno con un enlace «Quitar» que
   vuelve a `/buscar` con ese id fuera de `comparando` — un enlace normal, funciona
   sin JavaScript.
3. Los cursos acumulados que además aparecen en la página actual se pintan con su
   casilla ya marcada (son un curso más de la lista, no hace falta tratarlos aparte).
   Los que no aparecen viajan como campos ocultos dentro del mismo formulario, para
   que «Comparar seleccionados» siempre mande la unión completa.
4. El formulario de filtros lleva `comparando` como campo oculto, y `enlacePagina` lo
   añade a «Siguiente»/«Anterior» igual que ya hace con `orden` o `keyword`: sin
   JavaScript, la selección acumulada **hasta la última vez que se pulsó «Buscar» o se
   cambió de página** sigue viajando. Esto no depende de JavaScript y ya arregla parte
   del problema por sí solo.
5. El JavaScript de mejora entra encima de eso: al marcar o desmarcar una casilla de
   esta página, recalcula el total (acumulado + marcado aquí) y reescribe con él el
   campo oculto del formulario de filtros y el `href` de los enlaces de paginación —
   así, cambiar de filtro o de página **sin pulsar nada más que lo de siempre**
   arrastra también lo marcado en la página que se abandona. Si el máximo
   (`MAX_COMPARADOS`) ya está cubierto, deshabilita las casillas restantes de esta
   página en vez de dejar marcar una de más.

## Cuidados

- **`parseCompareIds` ya hace el trabajo de fusionar y acotar** (admite repetidos,
  descarta inválidos, corta en `MAX_COMPARADOS`): la fusión de «acumulado + recién
  marcado» pasa por ahí en el servidor, no por una función nueva que reimplemente el
  mismo cuidado. En el cliente, el script hace la unión con lo mínimo (un `Set`) y dejar
  que el servidor, al recibir la petición, vuelva a sanear con `parseCompareIds` como
  entrada externa que es — el script de cliente no es de fiar por sí solo, es una
  mejora de interacción, no una validación.
- **El parámetro acumulado sigue siendo entrada externa**, igual que `ids` en
  `/comparar` y `comparando` en la ficha (HU-031): se sanea con `parseCompareIds` antes
  de usarlo para nada, nunca se confía en que venga bien formado ni en que lo haya
  escrito el propio script.
- **El JavaScript no sustituye el saneado del servidor, solo mejora la interacción.**
  Si alguien manipula el `comparando` de la URL a mano (con basura, con más de
  `MAX_COMPARADOS`, con ids inventados), el resultado tiene que ser el mismo que si
  ese parámetro no existiera del todo salvo por lo válido que contenga — igual que hoy
  con `ids` en `/comparar`.
- **El título de los cursos acumulados que no están en la página actual sí hace falta
  pedirlo** (para el aviso «llevas N marcados» y el enlace «Quitar» de cada uno): es
  una consulta más por página de resultados, solo cuando `comparando` no está vacío, y
  solo pidiendo lo que se pinta (reutilizar `getCoursesByIds`, no una consulta nueva).
- **El aviso de «cuántos llevas» no debe ser el único sitio donde se pueda quitar
  uno.** El criterio de aceptación lo pide explícitamente: tiene que poder quitarse
  sin volver a la página donde apareció, así que el aviso lleva su propio control por
  curso (el título y un enlace «Quitar» que funciona sin JavaScript), no una lista
  muda.
- **Cambiar de página de resultados no debe perder la selección aunque también cambie
  el filtro, y esto no depende de JavaScript.** `enlacePagina` reconstruye la URL
  entera a partir de `filters`; el parámetro `comparando` se añade ahí igual que los
  demás, y el formulario de filtros lo lleva como campo oculto — esta parte es SSR
  pura y es lo que hace que, incluso sin JavaScript, lo ya acumulado (hasta la última
  vez que se pulsó «Buscar» o «Siguiente») no se pierda.
- **El script no debe poder mandar un formulario con más de `MAX_COMPARADOS`
  casillas activas.** Deshabilitar en el cliente es solo comodidad de interfaz: el
  límite de verdad lo sigue poniendo `parseCompareIds` en el servidor al construir la
  comparación, por si el script fallara o alguien lo sorteara.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: fusión de ids acumulados + recién marcados vía `parseCompareIds` —
      duplicados, inválidos, y recorte al llegar a `MAX_COMPARADOS`
- [ ] Unitarios: `enlacePagina` conserva el parámetro `comparando` junto con los
      filtros existentes
- [ ] Unitarios: un `comparando` manipulado a mano (basura, ids inventados, de más)
      se sanea igual que `ids` en `/comparar` — el servidor nunca se fía del cliente
- [ ] E2E: un test por cada criterio de aceptación de arriba, con JavaScript activo
      (el comportamiento por defecto de Playwright)
- [ ] E2E: el caso sin JavaScript (`test.use({ javaScriptEnabled: false })`), para
      demostrar que no empeora respecto a hoy y que el formulario y los enlaces de
      paginación no se rompen
- [ ] E2E: con el máximo ya alcanzado, las casillas de una página nueva no permiten
      marcar una quinta sin avisar
- [ ] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Abierta`
