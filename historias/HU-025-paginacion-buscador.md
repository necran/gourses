# HU-025 — Paginación en el buscador

## Contexto

HU-023 amplió el catálogo porque «con 425 cursos la probabilidad de que alguien
encuentre lo que busca es baja, y sin eso no hay producto». Hoy el catálogo tiene
**8.796 cursos** (4.796 de Udemy y 4.000 de Coursera, medido el 2026-08-24)… y el
buscador sigue enseñando **como mucho 50**, sin ninguna forma de ver el resto.

Es decir: el 99,4 % del catálogo es inalcanzable desde la web. El trabajo de HU-023
está pagado pero no entregado, y el síntoma es peor que antes de ampliar, porque
ahora una búsqueda corriente tiene cientos de resultados buenos que nadie puede ver.

Dos detalles del diseño actual que condicionan la solución:

- `searchCourses` consulta **una vez por fuente** y las intercala una a una
  (`interleaveBySource`). No es un capricho: Coursera no publica valoraciones —0 de
  sus 4.000 cursos tienen `rating`, verificado contra la API— así que un orden global
  por valoración la dejaba fuera de la primera página siempre. La paginación tiene que
  conservar esa alternancia, o reaparece el mismo problema en la página 2.
- El número de página llega por la dirección, así que es **entrada externa**: hay que
  sanearla como el resto de filtros, y acotar hasta dónde se puede saltar. Un
  `?pagina=99999999` no puede convertirse en un salto que obligue a la base de datos a
  recorrer el catálogo entero.

## Como visitante quiero recorrer todos los resultados de mi búsqueda para no quedarme en los primeros 50 cuando lo que busco está en el 51

## Criterios de aceptación

- **Given** una búsqueda con más resultados de los que caben en una página **When**
  la hago **Then** veo que hay más y cómo pasar a la siguiente

- **Given** que estoy en la página siguiente **When** miro los cursos **Then** son
  distintos de los de la primera, sin repetirse

- **Given** que estoy en la página 2 **When** copio la dirección y la abro de nuevo
  **Then** vuelvo a la página 2, no a la primera

- **Given** una búsqueda con filtros aplicados **When** paso de página **Then** los
  filtros siguen aplicados

- **Given** una página con resultados de las dos plataformas **When** paso a la
  siguiente **Then** sigue habiendo de las dos, no solo de una

- **Given** un número de página inventado en la dirección (`0`, `-3`, `abc`)
  **When** la abro **Then** vuelvo a la primera página, con resultados

- **Given** un número de página enorme, más allá del catálogo **When** la abro
  **Then** se me dice que ahí no hay nada y cómo volver, en vez de romperse o de
  fingir que estoy en la última página con resultados

## Fuera de alcance

- Ordenar los resultados a gusto del visitante (por precio, por valoración). Es otra
  historia; aquí no se toca el criterio de orden.
- Cambiar cuántos resultados entran por página.
- El comportamiento de los filtros de precio y valoración con los cursos que no tienen
  ese dato. Es un problema real y distinto —hoy poner un precio máximo esconde los
  4.000 cursos de Coursera— y se anota como deuda, no se arregla aquí.

## Cuidados

- La alternancia entre plataformas debe mantenerse en todas las páginas.
- Sin JavaScript de cliente: el buscador funciona con formularios y enlaces (HU-007,
  HU-017) y la paginación tiene que seguir igual.
- La dirección con página tiene que poder compartirse, como ya pasa con los filtros.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: saneado del número de página (inválidos, cero, negativos, tope)
- [x] Unitarios: el troceado por páginas conserva la alternancia y no repite cursos
- [x] Integración: contra el catálogo real, dos páginas seguidas no comparten cursos
- [x] E2E: un test por cada criterio de aceptación de arriba
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

Unitarios (22 nuevos), integración (5) y e2e (7, uno por criterio). Suites completas en
verde: 309 unitarios, 74 de integración, 76 e2e. `/security-review` sin hallazgos.

## Lo que se decidió sobre la marcha

**Un criterio se reescribió, no el comportamiento.** Estaba escrito que una página
inventada «responde con resultados». Con `?pagina=99999999999` lo correcto no es eso:
se recorta al tope, no hay nada ahí, y lo honesto es decirlo y ofrecer la vuelta a la
primera en vez de fingir que estás en la última página con resultados. Se cambió el
criterio para que dijera lo que debe pasar.

**El desempate por `id` no está demostrado por los tests.** Se añadió como tercer
criterio de orden porque hay miles de filas empatadas (4.000 cursos de Coursera sin
valoración y con la misma fecha de ingesta) y Postgres no promete devolver los empates
en el mismo orden entre dos consultas. Pero el test de integración pasa igual
quitándolo: hoy, contra la base real, el orden sale estable sin él. Se mantiene porque
la garantía la da el `ORDER BY`, no que el plan de hoy siga siendo el de mañana — y así
queda dicho, sin fingir que el test lo prueba.

## Descartado al elegir esta historia

Antes de esto se consideró arreglar «Coursera sin precio ni valoración», que venía
anotado como deuda desde HU-023. **No es deuda: es imposible por la vía admitida.**
Probado contra la API real el 2026-08-24 pidiendo `avgProductRating`,
`numProductRatings`, `averageFiveStarRating`, `ratings` y `avgLearningHours`: la
Catalog API responde 200 e **ignora en silencio** los campos que no conoce, y ninguno
aparece en la respuesta. No existen. Con la regla de no hacer scraping, esos dos datos
no se pueden conseguir.

## Deuda que sigue abierta

- Los filtros de precio máximo y valoración mínima **esconden los 4.000 cursos de
  Coursera**: `price_amount <= X` es nulo para ellos, así que quedan fuera sin avisar.
  Es un problema real y distinto de este; merece su propia historia.
- No se puede ordenar los resultados a gusto (por precio, por valoración).
- No se dice cuántos resultados hay en total, solo si hay más.
