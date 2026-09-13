# HU-047 — Ordenar los resultados por duración

## Contexto

Fase 1. Deuda de HU-027, anotada en su «Deuda que sigue abierta»:

> No se puede ordenar por duración ni por novedad.

Hoy solo hay dos órdenes: precio de menor a mayor y mejor valorados. Falta el que
responde a la pregunta más común cuando alguien tiene poco tiempo: **cuál es el más
corto**. La duración ya se enseña en cada resultado y en la ficha desde HU-011, y ya se
puede comparar; lo único que falta es poder ordenar por ella.

Medido en la base el 2026-09-13: **7.197 de 9.380 cursos tienen duración** — Udemy 5.378
de 5.380, Coursera 1.819 de 4.000. Eso hace este orden distinto del de precio, que en la
práctica es un orden de Udemy porque Coursera no publica precios: aquí las dos
plataformas están representadas.

## Lo de «novedad» no entra, y conviene explicar por qué

La deuda de HU-027 pedía dos órdenes. El segundo **no se puede hacer todavía**: la tabla
`courses` no guarda cuándo se dio de alta un curso. Solo tiene `updated_at`, que la
ingesta reescribe en cada pasada — medido: 4.847 filas con fecha del 2026-09-09 y 77 del
2026-09-13. Ordenar por ese campo daría «lo que la ingesta tocó más recientemente», que
no es novedad y además cambiaría cada noche sin que el catálogo haya cambiado.

Hacerlo bien pide una columna de alta (`created_at`) y una migración, y hasta que pase
un tiempo desde esa migración el orden sería ciego para los 9.380 cursos que ya están.
Es una historia propia, con su decisión de producto detrás; queda anotada como deuda al
final.

## Como visitante con poco tiempo quiero ordenar los resultados por duración para encontrar primero los cursos que puedo terminar

## Criterios de aceptación

- **Given** el buscador **When** despliego «Ordenar por» **Then** puedo elegir ordenar
  por duración, además de los órdenes que ya había
- **Given** que ordeno por duración **When** miro la lista **Then** las duraciones no
  bajan según voy hacia abajo
- **Given** que ordeno por duración **When** paso a la página siguiente **Then** el orden
  se mantiene, también entre el final de una página y el principio de la otra
- **Given** que ordeno por duración **When** llego a los cursos sin duración publicada
  **Then** están todos al final, nunca intercalados
- **Given** que ordeno por duración **When** comparto la dirección **Then** se abre con
  ese mismo orden
- **Given** que ordeno por duración **When** miro las plataformas **Then** aparecen las
  dos, no solo una

## Fuera de alcance

- **Ordenar por novedad** (ver arriba): necesita migración e historia propia.
- **Ordenar de mayor a menor duración.** Se añade un solo orden, el útil: quien busca
  «lo más largo» está buscando otra cosa (un temario completo), y cada opción de más en
  el desplegable es una decisión más para todo el mundo. Si se pide, se añade.
- **Filtrar por duración** («menos de 2 horas»). Es un filtro, no un orden, y merece su
  propia historia con su aviso de «sin dato», como el de precio (HU-026).
- **Cambiar cómo se calcula o se muestra la duración** (HU-011).

## Diseño

- Un valor nuevo en `ORDENES`, `duracion-asc`, con su etiqueta. Al ser una lista cerrada,
  el saneado de HU-027 lo admite sin tocar nada: un orden que no esté en ella sigue
  cayendo al de por defecto.
- En `searchCoursesOrdenado`, el orden pasa de un ternario de dos ramas a un reparto por
  clave. Se ordena por `duration_min_minutes` ascendente **con los nulos al final**
  (`nullsFirst: false`), igual que precio y valoración: un curso sin duración publicada
  no es el más corto. El desempate por `id` que ya existe se mantiene, que es lo que
  hace que la paginación no repita ni se salte cursos (HU-025).
- Se ordena por el **mínimo** del rango: Coursera publica duraciones como «12 h–20 h», y
  quien busca lo más corto compara por lo mínimo que le va a costar.

## Cuidados

- **La paginación es lo frágil.** Cualquier orden nuevo tiene que llevar su desempate
  estable o la página 2 repite cursos de la 1 (el fallo que ya se cuidó en HU-025).
- **Los nulos al final, nunca intercalados**: es la misma regla que en el resto del
  proyecto — un hueco no es un cero.
- **No cambiar el orden por defecto.** La mezcla equilibrada entre plataformas sigue
  siendo lo que se ve sin pedir nada (HU-007).

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: el nuevo orden se sanea como los demás (entra solo en el `it.each` que
      recorre `ORDENES`) y ninguna etiqueta queda vacía ni repetida
- [x] Integración: contra la base real, el orden por duración sale ascendente, los
      cursos sin duración no salen los primeros y dos páginas seguidas no comparten
      cursos — 3 casos nuevos en `tests/integration/orden.test.ts`
- [x] E2E: un test por criterio de aceptación, menos el de los huecos, que vive en
      integración por lo explicado abajo — `e2e/orden-duracion.spec.ts` (5 tests)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

### Resultado de los tests

- Unitarios (`npm test`): 531 pasan, 119 omitidos.
- Integración (`npm run test:integration`): 119 pasan, 3 nuevos.
- E2E (`npx playwright test`): 188 pasan, 5 nuevos. Pasada completa limpia.

### Revisión de seguridad

Sin hallazgos, y sin superficie nueva:

- **El orden llega por la dirección, pero ya venía saneado** contra la lista cerrada
  `ORDENES` desde HU-027: añadir un valor a esa lista no abre ninguna vía nueva, y uno
  inventado sigue cayendo al orden por defecto.
- **La columna por la que se ordena no se toma de la entrada**: sale de un reparto por
  clave indexado con el valor ya validado, así que no hay forma de colar un nombre de
  columna ni nada que se interpole en la consulta.
- **No hay consulta nueva ni datos nuevos**: es la misma búsqueda con otro `ORDER BY`.

### Qué cambió respecto al diseño previsto

- **Nada del diseño, pero sí del alcance de la deuda.** HU-027 pedía duración *y*
  novedad; se entrega solo duración, con el motivo medido y comprobable: la tabla
  `courses` no guarda cuándo se dio de alta un curso, solo `updated_at`, que la ingesta
  reescribe cada pasada (4.847 filas con fecha del 2026-09-09 y 77 del 2026-09-13).
  Ordenar por ahí no sería novedad.
- **El ternario de dos ramas pasó a reparto por clave.** Con tres órdenes ya no se leía;
  con cuatro sería peor.
- **El criterio de «los huecos al final» se prueba en integración, no por el
  navegador.** 7.197 de 9.380 cursos tienen duración, así que por pantalla los primeros
  cursos sin ella no aparecen hasta pasada la página 140: un test e2e de eso sería lento
  y frágil, y no probaría mejor lo mismo.

## Deuda que sigue abierta

- **Ordenar por novedad.** Necesita una columna de alta (`created_at`) y su migración.
  Ojo al cerrarla: los 9.380 cursos que ya están recibirían todos la fecha de la
  migración, así que ese orden sería ciego hasta que pasara un tiempo. Merece decidir
  antes qué se quiere decir con «nuevo»: recién añadido a Gourses, o recién publicado en
  la plataforma (dato que hoy no se ingiere).
- **Ordenar de mayor a menor duración**, y **filtrar** por duración, ambos fuera de
  alcance aquí a propósito.
