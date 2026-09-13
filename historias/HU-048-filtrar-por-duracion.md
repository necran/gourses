# HU-048 — Filtrar por duración máxima

## Contexto

Fase 1. Deuda anotada en HU-047, que dejó fuera el filtro a propósito:

> **Filtrar por duración** («menos de 2 horas»). Es un filtro, no un orden, y merece su
> propia historia con su aviso de «sin dato», como el de precio (HU-026).

Ordenar por duración ya ayuda, pero no basta: quien tiene una tarde libre no quiere
recorrer una lista ordenada hasta encontrar dónde empiezan los cursos largos, quiere
decir «como mucho tres horas» y ver solo eso. El buscador ya filtra por precio máximo,
valoración mínima, idioma y categoría; la duración es el hueco que queda.

Reparto medido el 2026-09-13, sobre 9.380 cursos:

| Duración | Cursos |
|---|---|
| Hasta 1 h | 448 |
| 1–3 h | 1.594 |
| 3–10 h | 2.545 |
| 10–30 h | 1.972 |
| Más de 30 h | 638 |
| Sin publicar | 2.183 |

## Como visitante con un rato libre quiero ver solo los cursos que duran menos de lo que puedo dedicarles para no perder tiempo mirando cursos que no me caben

## Criterios de aceptación

- **Given** el buscador **When** lo miro **Then** hay un campo para pedir duración
  máxima, junto a los demás filtros
- **Given** que pido una duración máxima **When** busco **Then** todos los resultados
  duran eso o menos
- **Given** que pido una duración máxima **When** busco **Then** se me avisa de que los
  cursos que no publican duración quedan fuera, y de cómo incluirlos — igual que ya pasa
  con el precio y la valoración (HU-026)
- **Given** ese aviso **When** pulso para incluirlos **Then** vuelven a aparecer también
  los cursos sin duración publicada
- **Given** una duración máxima puesta **When** paso de página o cambio el orden
  **Then** el filtro sigue aplicado
- **Given** una duración máxima puesta **When** comparto la dirección **Then** se abre
  con el mismo filtro
- **Given** una duración inventada en la dirección (texto, negativa, enorme) **When** la
  abro **Then** veo resultados, sin error, como con cualquier otro filtro mal escrito

## Fuera de alcance

- **Duración mínima** («al menos 10 horas»). Quien busca un temario largo tiene el orden
  y la lista; si se pide, se añade.
- **Tramos predefinidos** («menos de 1 h», «1–3 h»). Un campo numérico es coherente con
  el de precio, no inventa vocabulario nuevo y no obliga a mantener una lista de tramos.
- **Rellenar la duración que falta.** 2.183 cursos no la publican; eso es cosa de la
  ingesta.
- **Cambiar cómo se muestra o se ordena la duración** (HU-011, HU-047).

## Diseño

- Un filtro más, `maxDuration`, en horas de cara a la persona y en minutos por dentro.
  Se parsea con la misma función que el precio (`parseNonNegativeNumber`), con su tope,
  así que un valor raro simplemente no aplica el filtro.
- **Filtra por `duration_max_minutes`, no por el mínimo.** Es la diferencia con HU-047,
  que ordena por el mínimo: para ordenar interesa lo menos que puede costarte, pero para
  un techo hay que mirar lo más que puede costarte. Un curso de «1 h–20 h» no cumple
  «como mucho 2 horas», aunque su extremo bajo sí.
- **Mismo trato de los huecos que HU-026**: por defecto, quien no publica duración queda
  fuera; con `sinDato=1` vuelve. Se reutiliza `incluirSinDato`, no se inventa otro
  interruptor.
- `excluyePorFaltaDeDato` pasa a contar también este filtro, y el texto del aviso —que
  hoy nombra «precio», «valoración» o ambos— tiene que saber nombrar tres cosas sin
  quedar como una lista pegada con cinta.
- `enlacePagina` debe llevar el parámetro nuevo, o al pasar de página se perdería el
  filtro. Es el fallo más fácil de cometer aquí.

## Cuidados

- **El aviso solo sale cuando de verdad se está dejando algo fuera.** Un aviso
  permanente es ruido (HU-026).
- **No confundir «no publica duración» con «dura cero»**: un hueco no es un cero, la
  misma regla de todo el proyecto.
- **El filtro tiene que sobrevivir al orden, a la paginación y a la categoría**, que es
  donde se rompen los filtros nuevos.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: parseo del valor (válido, vacío, texto, negativo, `NaN`, `Infinity`,
      desmesurado, cero), conversión de horas a minutos sin decimales sueltos, el texto
      del aviso en sus seis combinaciones, y que `enlacePagina` conserva el filtro y lo
      devuelve en horas — `search-filters.test.ts` y el nuevo `buscar-enlaces.test.ts`
- [x] Integración: contra la base real, ningún resultado pasa del techo pedido —medido
      por el extremo alto del rango— y con `sinDato` vuelven los que no publican
      duración — 3 casos nuevos en `tests/integration/filtros-sin-dato.test.ts`
- [x] E2E: un test por criterio de aceptación — `e2e/filtro-duracion.spec.ts` (7 tests)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

### Resultado de los tests

- Unitarios (`npm test`): 556 pasan, 122 omitidos.
- Integración (`npm run test:integration`): 122 pasan, 3 nuevos.
- E2E (`npx playwright test`): 195 pasan, 7 nuevos. Pasada completa limpia.
- Comprobado en el navegador a 1280 px y a 400 px, y leyendo el texto del aviso en sus
  tres variantes.

### Revisión de seguridad

Sin hallazgos, y sin superficie nueva:

- **El valor llega por la dirección y se sanea con el mismo parseo que el precio**, con
  tope (1.000 horas) por el motivo ya documentado en HU-026: acaba interpolado en el
  texto de un filtro `.or()` de PostgREST, así que tiene que ser siempre un número
  corto y normal. Se redondea a minutos enteros para que no viaje algo como
  `123.00000000000001`.
- **Un valor inválido no aplica el filtro**, no rompe la búsqueda: probado con texto,
  negativos, `NaN`, `Infinity`, vacío y desmesurado.
- **No hay consulta nueva ni datos nuevos**: es la misma búsqueda con una condición más.
- **La paginación no puede reintroducir basura**: `enlacePagina` reconstruye el enlace
  desde los filtros ya saneados, nunca desde lo que venía escrito en la dirección.

### Qué cambió respecto al diseño previsto

- **El aviso mentía, y lo encontré mirando una captura, no con los tests.** La segunda
  frase —«Coursera no publica ni precios ni valoraciones, así que se queda fuera su
  catálogo entero»— estaba escrita a fuego, y con el filtro de duración es falsa:
  Coursera publica duración en 1.819 de sus 4.000 cursos, y de hecho salían cursos suyos
  en esa misma búsqueda. Mi test comprobaba que el aviso dijera «duración» y tuviera su
  enlace, así que pasó por encima de la mentira. Ahora esa frase solo aparece cuando el
  filtro es de precio o valoración, y hay un test que exige que **no** salga con
  duración y que **sí** salga con precio.
- **`textoDatoQueFalta` se mudó de la página a la librería.** Con tres filtros son seis
  combinaciones; ahí abajo se puede probar, en la página no.
- **Se filtra por `duration_max_minutes`, al revés que el orden de HU-047**, que va por
  el mínimo. Medido: «hasta 2 horas» da 1.382 cursos por el máximo y 1.400 por el
  mínimo. Esos 18 de diferencia son rangos tipo «1 h–20 h» que no caben en dos horas.
- **`enlacePagina` tuvo que aprender el filtro** y devolverlo en horas; sin eso, cada
  paso de página lo habría multiplicado por sesenta. No tenía fichero de tests y se
  creó.
- **Un tropiezo propio**: escribí la spec con `test.each`, que es de Vitest y Playwright
  no tiene. Tumbó la tanda entera hasta reescribirlo como un bucle, que además arregló
  que el test ignoraba el valor y visitaba siempre la misma dirección.
