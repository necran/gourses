# HU-054 — El buscador, cómodo en el móvil

## Contexto

Fase 6, rediseño móvil (2026-09-15). HU-043 dejó el móvil sin cortes, pero al medir
`/buscar` en un iPhone 13 (390 × 844) nada se sale y aun así cuesta usarlo:

- **Los resultados empiezan fuera de la primera pantalla.** Los siete campos del
  formulario, uno debajo de otro, ocupan la pantalla entera; la página mide 9.356 px.
- **Controles pequeños**: la casilla de comparar mide 18 × 18 px, por debajo del mínimo
  de 24 × 24 de WCAG 2.2 AA (criterio 2.5.8), y los enlaces del pie, 17 px de alto.
- **Letra de 11,5 px** en las etiquetas de los campos.
- **El idioma se escribe a mano** («es, en…»): hay que saber el código, y en las
  tarjetas aparece como `en` o `es`. La plataforma, en minúsculas («udemy»).

La ficha y la comparación en el móvil son **HU-055**.

## Como visitante desde el móvil quiero ver resultados nada más entrar y filtrar sin pelearme con la pantalla para encontrar un curso rápido

## Criterios de aceptación

- **Given** que entro en `/buscar` desde el móvil sin filtros **When** carga **Then** veo
  la palabra clave, un botón «Filtros y orden» y el primer resultado en la primera
  pantalla; los demás campos aparecen al pulsar ese botón
- **Given** que entro con filtros aplicados **When** carga **Then** los filtros están a la
  vista con sus valores, y el botón dice cuántos hay aplicados
- **Given** el filtro de idioma **When** lo uso **Then** elijo de una lista con el nombre
  del idioma en español, y las tarjetas muestran idioma y plataforma con su nombre
  («Español», «Udemy»), no con códigos
- **Given** el buscador en el móvil **When** lo uso **Then** todos los controles miden al
  menos 24 × 24 px y ningún texto baja de 12 px
- **Given** que navego sin JavaScript en el móvil **When** pulso «Filtros y orden»
  **Then** los filtros se despliegan igual
- **Given** una pantalla de escritorio **When** entro en `/buscar` **Then** los filtros se
  ven todos, sin botón para desplegarlos, como hasta ahora

## Fuera de alcance

- **La ficha y la comparación**: HU-055.
- **Cambiar cómo filtra el idioma** por dentro: sigue siendo igualdad sin distinguir
  mayúsculas sobre el código que guarda la base. Solo cambia cómo se elige.
- **Filtros que se aplican solos al cambiarlos.** Se sigue pulsando «Buscar»: funciona
  sin JavaScript y cada búsqueda es un enlace que se puede compartir.

## Diseño

- **Plegado sin JavaScript**: una casilla oculta (pero enfocable con teclado) y su
  etiqueta «Filtros y orden». Solo en pantallas estrechas, el CSS muestra los campos
  cuando está marcada. Se marca de inicio si hay filtros aplicados.
- **En escritorio no cambia nada**: el contenedor de los campos es `display: contents`,
  así que siguen siendo hijos directos del formulario, con la misma disposición en fila.
- **Nombres legibles** en un solo módulo (`presentacion.ts`): plataforma por tabla fija
  e idioma con `Intl.DisplayNames` en español, con el código de respaldo si no lo
  conoce. La lista de idiomas del filtro son los códigos exactos que hay en la base; si
  la dirección trae otro, se añade como opción para no perderlo.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: nombre de plataforma e idioma (conocidos, desconocidos, códigos no
      válidos), opciones del filtro con un valor fuera de la lista, número de filtros
      plegados aplicados
- [x] E2E: un test por criterio de aceptación
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Lo que se ve

En un iPhone 13, sin filtros, la primera pantalla muestra la palabra clave, «Filtros y
orden» con «Buscar» al lado, el recuento y la primera tarjeta. Desplegados, los campos
cortos van de dos en dos y categoría y orden a lo ancho. Con filtros aplicados, el botón
lleva un contador. Revisado en capturas, además de en los tests.

Un detalle corregido al mirarlas: «Todos los idiomas» se cortaba en la columna estrecha
(«Todos los idiom»); pasó a «Todos», porque la etiqueta de encima ya dice de qué es.

### Nombres en todo el sitio

Plataforma e idioma con nombre en el buscador, la portada, las categorías, favoritos y
la ficha. En la ficha, además, el botón decía «Ver Curso En Udemy» por un
`text-transform: capitalize` aplicado al texto entero; ahora dice «Ver curso en Udemy».

### Tests que cambiaron por el cambio de nombres

- `buscar.spec.ts` (HU-007) buscaba `"udemy"` y `"coursera"` literales en las tarjetas.
  Se actualizó a «Udemy» y «Coursera»: lo que comprueba, que salen las dos plataformas
  mezcladas, no cambia.
- Se revisaron los demás que miran la plataforma (`filtros-sin-dato`, `orden`,
  `orden-duracion`, `paginacion`) por si se hubieran vuelto siempre verdaderos sin
  fallar (un `not.toContain("coursera")` frente a «Coursera»). No: todos pasan el texto
  a minúsculas antes de comparar.

### Resultado de los tests

- Unitarios (`npm test`): 621 pasan, 16 nuevos.
- Integración (`npm run test:integration`): 124 pasan.
- E2E (`npx playwright test`): 208 pasan, 6 nuevos.
- E2E de la analítica (`npm run test:e2e:analitica`): 5 pasan (el pie cambió de relleno).

Una pasada intermedia dio un fallo en HU-045 («guardar no me saca de la búsqueda»): tras
guardar en la página 2, no apareció «Quitar» en 5 s. Pasó solo y en la pasada completa
siguiente, sin cambiar nada. El registro del servidor muestra en esa tanda un
`The destination stream closed early` junto a una petición `POST /buscar?keyword=python`,
pero sin horas no se puede atribuir con seguridad; la instantánea se perdió al repetir
el fichero, que vacía `test-results`. Queda anotado, no descartado.

### Revisión de seguridad

Sin hallazgos críticos ni altos:

- **Idioma**: la lista no cambia la entrada del servidor; el valor sigue pasando por
  `parseLanguage` y el mismo filtro. Un idioma llegado por la dirección se pinta como
  texto de una opción, que React escapa.
- **`Intl.DisplayNames`** con un código arbitrario lanza `RangeError`: está capturado y
  se devuelve el código.
- **La casilla del plegado** no tiene `name`: no añade nada a la búsqueda.
