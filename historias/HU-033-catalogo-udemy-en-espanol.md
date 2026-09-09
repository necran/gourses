# HU-033 — Traer también el catálogo de Udemy en español

## Contexto

Descubierto al probar HU-032 (priorizar el idioma del visitante): en local, con el
navegador en español, seguían saliendo sobre todo cursos en inglés. La causa no
estaba en la priorización — comprobado con `?keyword=python`, sí funciona — sino en
que **Udemy tiene 0 cursos en español en este catálogo, de 5.198 en total**.

Comprobado contra la API real (9 de septiembre de 2026): `discovery-units` filtra el
catálogo que devuelve según la cabecera `Accept-Language`, y la ingesta nunca la ha
mandado. Sin cabecera, todo lo que devuelve es `en_US`. Con `Accept-Language: es`,
un catálogo distinto — no una traducción del mismo: en una categoría de prueba, de
50 cursos en español solo 14 coincidían con los que ya se traen en inglés.

**No es gratis**: extrapolado a las 143 categorías/subcategorías de HU-023, añadir
español podría ampliar el catálogo de Udemy en torno a un 70 %, lo que multiplicaría
en la misma proporción las peticiones de detalle — el cuello de botella real de la
ingesta (HU-023) — justo cuando la pasada en inglés ya iba justa (46 min medidos
contra el tope de 90 min recién ampliado, HU-023/CLAUDE.md). Por eso esta historia no
añade español a la misma pasada: crea una **pasada aparte**, en otro horario, con su
propio tope, para no arriesgar la que ya funciona.

## Como visitante que busca en español quiero ver también los cursos de Udemy en español, no solo los de Coursera

## Criterios de aceptación

- **Given** la ingesta de Udemy **When** se ejecuta pidiendo el catálogo en español
  (`Accept-Language: es`) **Then** guarda cursos en español, no la misma lista que
  la pasada en inglés
- **Given** la ingesta habitual (sin pedir español) **When** se ejecuta **Then** se
  comporta exactamente igual que antes — sin `Accept-Language`, como siempre
- **Given** un curso que ya existe (mismo `source_id`) **When** aparece también en el
  descubrimiento en español **Then** se actualiza, no se duplica
- **Given** la pasada en español **When** se ejecuta en producción **Then** corre en
  su propio horario, sin competir por la cuota de la API con la pasada en inglés ni
  arriesgar su tope

## Fuera de alcance

- Otros idiomas además de español: se decide más adelante, con esta misma
  arquitectura si hace falta (el campo `locale` es genérico, no específico de
  español).
- Traducir la interfaz del sitio: esto es catálogo, no i18n de la web.
- Ajustar el tope de 90 min de la pasada en español con un número medido: no hay
  todavía una ejecución completa real: se deja el mismo tope de partida que tuvo la
  pasada en inglés al principio, a ajustar con la primera medición real (mismo
  criterio que HU-023).

## Cuidados

- El campo `locale` es opcional y no tiene valor por defecto a propósito: si lo
  tuviera, cambiaría en silencio qué trae la ingesta habitual.
- Mismo `(source, source_id)` decide si un curso se actualiza o se inserta: no hace
  falta ningún cambio de esquema ni de `upsertCourse` para que las dos pasadas
  convivan.
- El campo `language` que se guarda por curso viene de los metadatos propios de cada
  curso en la respuesta de la API (`locale.locale`), no de la cabecera de la
  petición: un curso en inglés que aparezca en el descubrimiento en español (cursos
  bilingües o recomendados de forma cruzada) se sigue guardando como `en`, no como
  `es` por error.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: la cabecera `Accept-Language` se manda solo cuando se pide un
      `locale`, y tal cual se pida — `fetch-catalog.test.ts`
- [x] Integración: pedir `locale: "es"` contra la API real trae un catálogo distinto
      al de por defecto, no una traducción — `tests/integration/udemy-ingest.test.ts`
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

**Cerrada** (la parte de código e infraestructura). Queda pendiente de comprobar en
producción la primera ejecución real de `ingesta-es.yml` para medir su duración y
ajustar el tope, igual que se hizo con la pasada en inglés en HU-023.

- Unitarios: 404 pasan.
- Integración: 6 pasan (`udemy-ingest.test.ts`, incluida la nueva de locale).
- Revisión de seguridad: sin hallazgos.

## Por qué una pasada aparte y no una casilla en la misma

Se consideró añadir `UDEMY_LOCALE` como una variable más de `ingesta.yml` en vez de
un workflow nuevo. Se descartó: la pasada en inglés ya mide 46 min contra un tope de
90, y con ~70 % más catálogo en español, sumarlo a la misma ejecución
probablemente superaría el tope igualmente — solo que esta vez sin margen para
comprobarlo antes de que rompiera producción una noche cualquiera. Una pasada
separada, en otro horario (`ingesta-es.yml`, 07:17 UTC, tres horas después de la de
inglés), no compite por la misma cuota acumulada de la API (HU-023: el límite de
Udemy es acumulado, no por segundo) y puede medirse y ajustarse de forma
independiente sin arriesgar la que ya funciona.
