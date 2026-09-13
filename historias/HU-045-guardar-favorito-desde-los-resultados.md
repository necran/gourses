# HU-045 — Guardar en favoritos desde los resultados de búsqueda

## Contexto

Fase 3. Deuda explícita de HU-019, anotada allí en «Fuera de alcance» y repetida en su
«Deuda que sigue abierta»:

> **Guardar desde la lista de resultados.** La lista ya va dentro de un `<form>` para
> comparar y HTML no admite formularios anidados. Se puede resolver con el atributo
> `form=` de los botones, pero es un enredo que merece su propia historia.

Hoy, para guardar un curso hay que entrar en su ficha, guardarlo y volver atrás. Con
50 resultados por página, guardar tres cursos son seis navegaciones. Es la mejora de
producto más repetida en las deudas del proyecto.

El obstáculo técnico sigue siendo real y es el motivo de que esto tenga historia
propia: la lista de `/buscar` vive dentro de `<form method="get" action="/comparar">`
(HU-017), y un `<form>` no puede contener otro.

## Como visitante con cuenta quiero guardar un curso desde la propia lista de resultados para no tener que entrar en cada ficha y volver

## Criterios de aceptación

- **Given** que he entrado en mi cuenta **When** busco cursos **Then** cada resultado
  ofrece guardarlo en favoritos, y los que ya tengo guardados se ven como guardados
- **Given** un resultado sin guardar **When** pulso guardar **Then** queda guardado y
  sigo en la misma búsqueda, con sus filtros, su orden y su página
- **Given** un resultado ya guardado **When** vuelvo a pulsar **Then** deja de estar
  guardado, y sigo igualmente en la misma búsqueda
- **Given** que guardo un curso desde los resultados **When** abro `/favoritos` o «Mi
  cuenta» **Then** aparece allí, como si lo hubiera guardado desde su ficha
- **Given** que no he entrado en mi cuenta **When** busco cursos **Then** no aparece un
  botón que no podría funcionar; guardar se sigue ofreciendo desde la ficha, que ya
  explica que hace falta entrar
- **Given** cualquiera de esos casos **When** navego sin JavaScript **Then** guardar y
  quitar funcionan igual
- **Given** que uso las casillas de comparar **When** guardo un favorito desde la misma
  lista **Then** ni la comparación ni la cesta se ven afectadas, y al revés

## Fuera de alcance

- **La portada y `/comparar`.** Esta historia es la lista de resultados de `/buscar`.
- **Guardar sin cuenta** (favoritos anónimos en el navegador). Los favoritos viven en la
  cuenta desde HU-019 y ahí se quedan.
- **Deshacer** («guardado — deshacer»). Volver a pulsar ya lo quita.
- **Cambiar la ficha**, que sigue con su botón grande tal cual (HU-019).

## Diseño

- **Un solo formulario aparte, fuera del de comparar**, con `id`, y en cada tarjeta un
  `<button type="submit" form="…" name="courseId" value="…">`. Así el botón vive
  visualmente dentro de la tarjeta pero pertenece al otro formulario: no hay anidamiento
  y no hace falta JavaScript. El id del curso viaja en el propio botón, sin campo
  oculto.
- **Una sola acción que alterna**, que decide según lo que hay en la base de datos, no
  según lo que se pintó. Si la página estaba desactualizada o se pulsa dos veces, el
  resultado es el que la persona quería y no un error.
- **Una consulta más por búsqueda, y solo con sesión**: los ids de los favoritos, para
  saber cuáles pintar como guardados. Se exporta la función que ya existe en
  `favorites.ts` en vez de escribir otra.
- **Botón compacto con el corazón** de HU-019, reutilizando los colores `--fav`, para
  que se lea igual que el de la ficha aunque sea más pequeño.

## Cuidados

- **La RLS sigue siendo la última palabra.** La acción valida el id, pero quien decide
  qué se puede escribir y leer es la política de la tabla, como en HU-019.
- **No romper comparar ni la cesta.** Es justo el riesgo de meter otro formulario en esa
  página: hay que comprobar que marcar casillas, comparar y la barra de la cesta siguen
  funcionando igual.
- **No revelar nada de otras personas**: los ids de favoritos se leen con el cliente de
  la sesión, nunca con el anónimo ni con la clave de servicio.
- **Sin sesión no se paga la consulta extra** ni se pinta el botón.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: **no se añade ninguno, y es a propósito.** Al implementarlo no apareció
      lógica pura que aislar: saber si un resultado está guardado es preguntar
      `Set.has(id)` sobre los ids que devuelve la base de datos, sin ramas ni casos
      límite. Un test unitario de eso probaría `Set`, no el código. Lo que sí tiene
      sustancia —que los ids sean los propios y que guardar acabe en la tabla— se
      prueba donde de verdad puede fallar, en integración
- [x] Integración: caso nuevo en `tests/integration/favoritos.test.ts` para
      `idsFavoritos`, con dos sesiones reales y su RLS. Guardar y quitar pasan por
      `guardarFavorito`/`quitarFavorito`, ya cubiertas en ese mismo fichero
- [x] E2E: un test por criterio de aceptación, incluido el caso sin JavaScript y el de
      que comparar y la cesta siguen intactos — `e2e/favorito-desde-resultados.spec.ts`
      (7 tests)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

### Resultado de los tests

- Unitarios (`npm test`): 511 pasan, 116 omitidos.
- Integración (`npm run test:integration`): 116 pasan, incluido el caso nuevo.
- E2E (`npx playwright test`): 176 en total, 7 nuevos. En la pasada completa falló
  `seo.spec.ts › la ficha publica datos estructurados`, el intermitente ya documentado
  desde HU-039; repetido junto a las specs afectadas, pasan los 19.
- Comprobado además en el navegador a 400 px y en escritorio.

### Revisión de seguridad

Sin hallazgos:

- **El id del curso viaja en el `value` del botón**, que es entrada externa igual que un
  campo oculto: la acción lo valida con `isValidCourseId` antes de tocar nada, y la RLS
  de `0004_favorites.sql` sigue siendo la última palabra sobre qué se puede leer y
  escribir.
- **Los favoritos se leen con el cliente de la sesión**, nunca con el anónimo ni con la
  clave de servicio, así que la lista de ids no puede traer nada ajeno.
- **Sin sesión no se pinta el botón ni se hace la consulta**: no hay forma de sondear
  desde fuera si un curso está guardado.
- **Alternar decide contra la base de datos**, no contra lo pintado: un doble clic o una
  página vieja no crean filas duplicadas ni errores.

### Qué cambió respecto al diseño previsto

- **Un ajuste de móvil no previsto.** Con el corazón, la tarjeta pasó a tener cuatro
  elementos en fila y a 400 px el título se partía en cinco líneas. La miniatura se
  reduce por debajo de 30 rem, como ya hacía la tarjeta de favoritos: el título baja a
  tres líneas.
- **Sin `aria-pressed`**, igual que se decidió en HU-041: el nombre accesible del botón
  ya cambia entre «Guardar X en favoritos» y «Quitar X de favoritos», y añadir el estado
  encima hace que un lector de pantalla anuncie algo contradictorio.
- **El formulario vacío con `id` funcionó tal cual**, sin JavaScript y sin tocar el
  formulario de comparar: era el riesgo principal de la historia y quedó despejado en la
  primera prueba.
