# HU-031 — Empezar a comparar desde la ficha de un curso

## Contexto

HU-017 construyó el comparador, pero la única puerta de entrada son las casillas de
`/buscar`. Desde la ficha de un curso no hay ninguna forma de empezar o ampliar una
comparación — comprobado revisando `src/app/curso/[id]/page.tsx`, no tiene enlace
hacia `/comparar`.

Se evaluó también añadir casillas de comparar a "Cursos destacados" de la home, y se
implementó — pero se descartó a propósito: la home enseña solo 6 cursos a modo de
muestra (ver "Deuda" más abajo, que trata precisamente de ampliar eso), y no es el
sitio donde alguien llega pensando en comparar. Se revirtió esa parte; esta historia
queda limitada a la ficha.

Mismo principio que fijó HU-017 y que esta historia no toca: **la selección vive en la
URL, nunca en estado del navegador**. Todo lo de aquí son enlaces y formularios GET
con los ids como parámetros, nada de cookies ni de JavaScript de cliente para
recordar una selección entre páginas.

El máximo de cursos a comparar (`MAX_COMPARADOS = 4`) ya existe y no se toca en esta
historia.

## Como visitante quiero poder añadir un curso a una comparación desde su ficha, no solo desde los resultados de búsqueda

## Criterios de aceptación

- **Given** la ficha de un curso **When** pulso «Comparar este curso»
  **Then** llego a `/buscar` con la casilla de ese curso ya marcada, listo para
  añadir hasta 3 más
- **Given** que llego a la ficha de un curso desde una comparación existente
  **When** pulso «Añadir a la comparación»
  **Then** vuelvo a `/comparar` con ese curso incluido junto a los que ya estaban,
  sin perder ninguno
- **Given** que una comparación ya tiene el máximo de cursos **When** llego a la
  ficha de otro curso desde ella **Then** no se ofrece añadirlo, se explica que hay
  que quitar uno primero
- **Given** cualquiera de estos enlaces **When** los abro directamente o los comparto
  **Then** funcionan igual sin pasar antes por la página anterior — son URLs
  autocontenidas, no dependen de una sesión

## Fuera de alcance

- Cambiar el máximo de cursos a comparar: sigue siendo 4 (HU-017).
- Una "cesta" de comparación persistente entre navegaciones cualesquiera (cookie o
  estado de cliente): rompería el principio de HU-017 de que todo vive en la URL.
- Rediseñar `/buscar` o `/comparar`: solo se añaden puntos de entrada nuevos.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: construcción de los enlaces (preselección en `/buscar`, ampliación
      de una comparación existente, tope alcanzado) — `compare.test.ts`
- [x] Integración: no hace falta un fichero nuevo. Los parámetros nuevos
      (`comparando`, `preseleccionado`) reutilizan `parseCompareIds` e
      `isValidCourseId`, ya cubiertas con entrada real contra la base de test en
      `tests/integration/comparar.test.ts` (HU-017) y con intentos de inyección en
      `compare.test.ts`; no se añade ninguna consulta nueva que probar.
- [x] E2E: un test por criterio de aceptación, en `e2e/comparar-desde-cualquier-sitio.spec.ts`
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

Cerrada.

- Unitarios: 387 pasan.
- E2E: 106 pasan (1 fallo intermitente preexistente en `orden.spec.ts`, no
  relacionado — misma carrera de siembra en paralelo ya documentada en HU-030).
- Revisión de seguridad: sin hallazgos.

## La home se probó y se descartó

Se implementó primero también en la home (casillas sobre "Cursos destacados" +
formulario hacia `/comparar`, igual que en `/buscar`) y se verificó funcionando en
el navegador. Se revirtió a petición expresa: la home no es el sitio para empezar a
comparar, y mostrar solo 6 cursos de muestra no da pie a esa acción. Queda como
posible vuelta atrás si la home cambia de forma (ver HU-032).
