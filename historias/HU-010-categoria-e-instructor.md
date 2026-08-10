# HU-010 — Categoría común e instructor de Coursera

## Contexto

Transversal a la Fase 1, ya cerrada. Dos huecos reales detectados al cerrar `HU-005`:

1. Los 100 cursos de Coursera tienen `instructor` a `null`, aunque su API sí expone `instructorIds` y `partnerIds` resolubles en la misma petición con `includes`.
2. El filtro por categoría se dejó fuera de `HU-007` porque no existía esa columna ni ninguna fuente la aportaba. Ahora sabemos que **ambas** pueden aportarla: Coursera vía `domainTypes`, y Udemy porque la ingesta ya recorre el catálogo categoría a categoría (`HU-005`), así que conoce la categoría de cada curso sin pedir nada extra.

El punto delicado es que las dos plataformas usan vocabularios distintos (`Development` frente a `computer-science`). Guardarlos en crudo repetiría el fallo que corrigió `HU-005`: un filtro que, sin querer, esconde una fuente entera. La regla del proyecto ya lo zanja (`.claude/rules/ingesta-fuentes.md`): cada adaptador normaliza a un esquema común y *"la web y el comparador nunca conocen las diferencias entre fuentes"*.

## Como visitante quiero filtrar y ver los cursos por categoría, y saber quién los imparte, para comparar opciones equivalentes entre plataformas distintas

## Criterios de aceptación

- **Given** un curso de cualquier fuente **When** se ingiere **Then** queda guardado con una categoría del vocabulario común del proyecto, no con la etiqueta original de su plataforma.
- **Given** un curso de Coursera **When** se ingiere **Then** su `instructor` queda relleno con el nombre del instructor o, si la API no lo da, con el de la institución que lo imparte.
- **Given** una categoría del vocabulario común presente en ambas plataformas **When** filtro por ella **Then** veo cursos de las dos, no de una sola.
- **Given** un curso cuya categoría original no está en el mapa **When** se ingiere **Then** se guarda con categoría `null` y el caso queda registrado, sin romper la ingesta ni inventar una categoría.
- **Given** la ficha de un curso con categoría **When** la visito **Then** veo su categoría junto al resto de datos.

## Fuera de alcance

- **Duración**: descartada de forma deliberada. El campo `workload` de Coursera es texto libre (solo lo trae el 62%, en varios idiomas: `"2 heures"`, `"5 Horas"`, `"2 часа"`, `"4 weeks of study, 2-4 hours a week"`), y sobre todo **mide algo distinto** que Udemy: horas de vídeo frente a esfuerzo semanal. Presentarlos como un número comparable engañaría al usuario justo en el producto cuyo nombre es "comparador". Se retoma si se encuentra una base honesta de comparación.
- El filtro de categoría en la interfaz del buscador: va en `HU-011`, para que esta historia se quede en la capa de datos y la ficha.
- La institución (`partnerIds`) como campo propio: de momento solo se usa como respaldo del instructor. Un campo "universidad" es valioso para Coursera pero no tiene equivalente en Udemy, así que merece su propia discusión.

## Vocabulario común de categorías

Decidido a partir de las 13 categorías reales de Udemy y los 11 dominios reales de Coursera (consultados por API el 2026-08-10). Se prefiere un conjunto corto: cuantas más categorías, más probable que una quede servida por una sola plataforma y el filtro vuelva a esconder fuentes.

| Categoría común | Udemy | Coursera |
|---|---|---|
| `desarrollo` | Development | computer-science |
| `it-y-software` | IT & Software | information-technology |
| `datos-e-ia` | — | data-science |
| `negocios` | Business, Finance & Accounting, Marketing | business |
| `diseno-y-creatividad` | Design, Photography & Video, Music | — |
| `desarrollo-personal` | Personal Development, Lifestyle | personal-development |
| `salud-y-bienestar` | Health & Fitness | life-sciences |
| `ciencia-y-matematicas` | — | physical-science-and-engineering, math-and-logic |
| `humanidades-y-sociales` | Teaching & Academics | arts-and-humanities, social-sciences |
| `idiomas` | — | language-learning |
| `productividad` | Office Productivity | — |

Que algunas casillas queden vacías no es un defecto del mapa, sino de los catálogos: Coursera no vende cursos de fotografía y Udemy no tiene un dominio de idiomas propio. Es distinto del fallo de `HU-005`, donde una fuente desaparecía por un criterio de orden y no por no tener ese contenido.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: mapeo de categoría de cada fuente al vocabulario común, incluyendo una etiqueta desconocida (devuelve `null`, no lanza) (`src/lib/courses/categories.test.ts`, más los casos en cada `normalize.test.ts`)
- [x] Unitarios: instructor de Coursera con instructor presente, con instructor vacío (usa la institución) y sin ninguno de los dos (`src/lib/ingesta/coursera/normalize.test.ts`)
- [x] Integración: ingesta de ambas fuentes contra la BD de test que deja categoría e instructor rellenos (`tests/integration/catalogo-enriquecido.test.ts`)
- [x] Integración: una categoría común presente en las dos plataformas devuelve cursos de ambas (mismo fichero)
- [x] E2E: la ficha de un curso muestra su categoría, con etiqueta legible y no el identificador interno (`e2e/curso.spec.ts`)
- [x] `/security-review`: sin hallazgos — la categoría pasa por una lista cerrada, así que ningún valor de una API externa llega en crudo a la base de datos, y la escritura sigue parametrizada

## Notas de implementación

Resultado de la reingesta real de ambas fuentes:

- **Instructor de Coursera: de 0 a 100 de 100.** Se resuelve con `includes=instructorIds,partnerIds`, que devuelve los nombres en `linked` **dentro de la misma petición**, sin una llamada extra por curso.
- **Categoría**: 412 de 413 cursos con categoría del vocabulario común. Seis categorías (`desarrollo`, `it-y-software`, `negocios`, `desarrollo-personal`, `salud-y-bienestar`, `humanidades-y-sociales`) quedan servidas por las **dos** plataformas, que era el objetivo.
- Udemy no necesita ninguna llamada nueva: la ingesta ya recorre el catálogo categoría a categoría desde `HU-005`, así que solo hubo que arrastrar ese dato hasta la normalización. Una subcategoría hereda la categoría de su padre, porque el vocabulario común es de primer nivel.

## Hallazgo colateral: cursos obsoletos que nunca se refrescan

Tras la reingesta quedó **un** curso de Udemy con `category` a `null` y `updated_at` de la ejecución anterior. La causa no es el mapeo: ese curso **ya no aparece en el listado de la fuente**, así que la ingesta no vuelve a tocarlo y conserva indefinidamente los datos con los que entró.

Importa más de lo que parece, y no por la categoría: **conserva también el precio antiguo**. En Fase 4 (alertas de bajada de precio) un precio congelado puede disparar una alerta falsa o falsear una comparación. Merece su propia historia — decidir si esos cursos se refrescan por otra vía, se marcan como obsoletos o se retiran del catálogo pasado cierto tiempo.

## Estado

Cerrada.
