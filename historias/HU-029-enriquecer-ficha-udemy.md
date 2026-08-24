# HU-029 — Enriquecer la ficha con los datos reales de Udemy

## Contexto

Investigación previa a esta historia: lo que la ficha llama «descripción» de un curso
de Udemy **no es una descripción**. `normalizeUdemyCourse` toma `description:
firstString(raw.headline)`, y `headline` es el titular de una línea del listado
("By the #1 Online Finance Instructor…"), no el texto del curso. La llamada de
detalle (`fetchCourseDetail`, que sí llega a `/courses/{id}/`) se hace **sin pedir
campos**, así que Udemy devuelve su conjunto por defecto — que tampoco trae
descripción.

Probado contra la API real el 2026-08-24 pidiendo
`fields[course]=description,what_you_will_learn_data,requirements_data,num_reviews,num_subscribers`:
los cinco están disponibles, sin permiso ni coste distinto del que ya se paga por el
precio — es la misma llamada de la Affiliate API, solo que pidiendo más.

Con esto se cierran dos huecos a la vez:

- **Contenido de verdad en la ficha** en vez de una frase suelta.
- **`AggregateRating` en los datos estructurados** (HU-016 lo omitió a propósito
  porque exige `reviewCount` y no se tenía; con `num_reviews` real, ya se puede
  declarar sin arriesgarse a que Google lo trate como dato engañoso).

De paso, el sitemap tiene un `.limit(5000)` puesto cuando el catálogo tenía 425
cursos. Al ponerse a arreglarlo se encontró que la causa real es peor de lo que
parecía: PostgREST en este proyecto limita cada respuesta a **1.000 filas**, aunque se
le pida más con `.limit()` — comprobado contra la API real pidiendo 49.000 y recibiendo
1.000. El `.limit(5000)` nunca llegó a hacer nada: el catálogo ya estaba recortado a
1.000 fichas mucho antes. Con 8.796 cursos, eso deja fuera **el 89 % del catálogo**, no
el 43 % que sugería el número escrito en el código. Se corrige paginando con `.range()`
hasta agotar el catálogo, no subiendo el número del límite.

## Como visitante quiero ver la información real de un curso de Udemy, no una frase suelta, para decidir si me interesa sin tener que salir a la plataforma de origen

## Criterios de aceptación

- **Given** un curso de Udemy con detalle disponible **When** se ingiere **Then**
  se guarda su descripción real, no el titular

- **Given** ese mismo curso **When** se ve su ficha **Then** se muestran, cuando
  existen, «Lo que aprenderás» y los requisitos previos, como listas

- **Given** un curso con valoración y número de reseñas **When** se genera su
  ficha **Then** los datos estructurados declaran `AggregateRating` con ese
  `reviewCount`

- **Given** un curso sin valoración o sin reseñas **When** se genera su ficha
  **Then** no se declara `AggregateRating` — a medias es peor que ausente

- **Given** que la llamada de detalle falla en una pasada de ingesta **When** el
  curso ya tenía descripción y estadísticas guardadas **Then** se conservan, en
  vez de borrarse con `null` (mismo criterio que ya rige el precio desde el fallo
  de HU-023)

- **Given** el catálogo actual **When** se genera el sitemap **Then** incluye
  todas las fichas de curso, no solo las primeras 1.000

## Fuera de alcance

- Coursera: su API pública no tiene equivalente a «lo que aprenderás» ni a
  requisitos. Su `description` ya es real y no se toca aquí.
- Generar contenido con IA. Esta historia es sobre mostrar datos que ya existen,
  no sobre producir texto nuevo — eso es HU-030.
- Renderizar el HTML que devuelve Udemy en `description` (párrafos, negritas):
  se limpia a texto plano. Un HTML sin sanear no se mete en el DOM.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: normalización de los campos nuevos, limpieza de HTML a texto
      plano, `AggregateRating` presente/ausente según los datos
- [x] Unitarios: `upsertCourse` conserva descripción y estadísticas cuando el
      detalle falla, igual que ya hace con el precio
- [x] Integración: el sitemap no recorta el catálogo
- [x] E2E: un test por cada criterio de aceptación visible desde la web
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

Unitarios (11 nuevos en normalize, 2 en upsert-course, 4 en course-seo, 5 en un módulo
compartido de formato de números), 3 de integración nuevos (sitemap) y 5 e2e (uno por
criterio visible desde la web). Suites completas en verde: 359 unitarios, integración
limpia, 96 e2e. `/security-review` sin hallazgos.

## Lo que la implementación descubrió y la investigación no vio

**El sitemap no perdía «casi 3.800 fichas»: perdía el 89 % del catálogo.** El
`.limit(5000)` del código nunca hizo nada — comprobado contra la API real pidiendo
49.000 filas y recibiendo 1.000: PostgREST en este proyecto limita cada respuesta a
1.000 filas *aunque se pida más*. El catálogo ya estaba recortado a 1.000 fichas mucho
antes del número escrito en el código. Se arregló paginando con `.range()`, no subiendo
la cifra. Hay un test que revierte el arreglo a propósito y confirma que falla sin él —
si no lo hiciera, no probaría nada.

**El mismo criterio de «desconocido, no ausente» que ya regía el precio (HU-023) se
extendió a descripción y estadísticas.** Vienen de la misma llamada de detalle, así
que fallan juntas: un detalle fallido ya no puede borrar una descripción real que se
había conseguido en una pasada anterior.

## Deuda que sigue abierta

- Coursera sigue sin equivalente a «lo que aprenderás» ni a requisitos: su API pública
  no lo publica.
- HU-030: resumen con IA de la descripción, apoyado en el texto real — no generación
  libre.
