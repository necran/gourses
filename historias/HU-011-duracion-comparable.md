# HU-011 — Duración comparable entre plataformas

## Contexto

Transversal a la Fase 1. La duración se dejó fuera de `HU-010` por considerarla poco aprovechable. Al medirlo sobre 600 cursos reales (2026-08-10) esa valoración resultó equivocada:

| | |
|---|---|
| Cursos de Coursera con dato de duración | 54% |
| De esos, derivables a un total de horas | 83% |
| Cobertura sobre el catálogo muestreado | **45%** |

El desglose de lo derivable: un 46% ya son totales directos (`"2 hours"`, `"106 minutes"`, `"4h 30m"`) y un 37% son `semanas × horas/semana` (`"4 weeks of study, 2-4 hours a week"` → 8–16 h totales). Lo verdaderamente inservible es un 5% en otros alfabetos, y hasta eso está estructurado (`"4 周课程, 1-3 小时/周"`), o sea recuperable más adelante.

Udemy lo da limpio y directo en el listado que ya recorre la ingesta (`content_info_short`, p. ej. `"16.5 hours"`), sin ninguna llamada nueva.

## Como visitante quiero saber cuánto dura cada curso para descartar rápido los que no me encajan y comparar opciones de plataformas distintas

## Criterios de aceptación

- **Given** un curso de Udemy con duración en el listado **When** se ingiere **Then** queda guardada su duración en minutos.
- **Given** un curso de Coursera cuya duración se expresa como semanas por horas semanales **When** se ingiere **Then** queda guardado el total derivado, como rango cuando las horas semanales son un rango.
- **Given** un curso cuya duración no se puede interpretar **When** se ingiere **Then** se guarda sin duración y la ingesta continúa, sin inventar una cifra.
- **Given** la ficha de un curso cuya duración es un rango **When** la visito **Then** veo el rango, no un punto medio que la plataforma nunca ha afirmado.
- **Given** un curso sin duración conocida **When** lo veo en la ficha o en el buscador **Then** simplemente no se muestra duración, sin huecos ni valores por defecto.

## Fuera de alcance

- **Filtrar u ordenar por duración** en el buscador: va en una historia aparte. Antes conviene ver el dato ya en producción, porque solo cubre parte del catálogo y ordenar por un campo mayoritariamente vacío tiene su propia trampa (la misma clase de problema que el orden por valoración de `HU-005`).
- Duraciones en alfabetos no latinos (chino, árabe, ruso): quedan a `null` de momento.
- Convertir la duración en un juicio de valor ("curso corto/largo"): solo se guarda y se muestra el dato.

## Advertencia sobre la comparación

Las dos plataformas **no miden lo mismo**: Udemy publica horas de vídeo, y Coursera, esfuerzo total de estudio con ejercicios y proyectos incluidos. Comparando las cifras a pelo, Udemy parecerá sistemáticamente más corto de lo que realmente cuesta terminarlo.

Por eso se guarda **rango** (mínimo y máximo) en vez de un número único: `"2-4 hours a week"` durante 4 semanas es honestamente 8–16 h, y reducirlo a "12 h" sería afirmar algo que Coursera no dice. Y por eso el filtro y la ordenación quedan fuera de alcance hasta tener el dato a la vista.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: parseo de los formatos reales de Coursera y de Udemy (`src/lib/courses/duration.test.ts`, 40 casos tomados de respuestas reales)
- [x] Unitarios: formatos no interpretables devuelven `null` en vez de una cifra inventada, incluida la prosa larga y las duraciones "por semana" sin número de semanas
- [x] Integración: ingesta real de ambas fuentes que deja duración guardada, más una comprobación de que nunca se guarda una duración incoherente (`tests/integration/catalogo-enriquecido.test.ts`)
- [x] E2E: la ficha muestra el rango de un curso que lo tiene, y no muestra nada cuando no lo tiene (`e2e/curso.spec.ts`)
- [x] `/security-review`: sin hallazgos — el parser solo produce enteros acotados o `null`, y la escritura sigue parametrizada

## Notas de implementación

Cobertura real tras la reingesta: **Udemy 312 de 313 (100%)** — publica la duración en el propio listado, en formato uniforme — y **Coursera 53 de 100 (53%)**. En total, 365 de 413 cursos del catálogo. De los de Coursera, **20 son rangos** y 33 exactas, lo que confirma que guardar mínimo y máximo no era una precaución teórica.

El parser se midió contra 600 valores reales antes de darlo por bueno: interpreta el **84%** de los que traen dato. Lo que rechaza, lo rechaza a propósito:

- **`"4-8 hours/week"` sin número de semanas.** Fue una regresión real que se coló al afinar el parser: durante una iteración se guardaba como "4–8 h totales", subestimando gravemente un curso que puede durar meses. Hay un test por cada variante de este caso para que no vuelva.
- **Prosa que suma tramos** (`"4 hours of videos, plus a final project requiring about 5 hours"`): quedarse con la primera cifra daría 4 h cuando son ~9 h.
- **Alfabetos no latinos**, que están estructurados y son recuperables más adelante.

Detalles que salieron de los datos y no de suponer: los meses se cuentan como 4 semanas, los módulos multiplican igual que las semanas, y se admiten números escritos con letra (`"Three weeks of study"`) porque aparecen de verdad.

## Estado

Cerrada.
