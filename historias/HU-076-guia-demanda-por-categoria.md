# HU-076 — Guía «qué categoría tiene más demanda, por alumnos inscritos»

## Contexto

Fase 6, tráfico orgánico (2026-10-07). Siguiendo la misma estrategia que HU-075: una
pregunta concreta que solo se puede contestar teniendo el catálogo completo medido, en vez
de un blog genérico de keywords (descartado ya en `docs/analisis-y-estrategia.md`, sección
«Qué no hacer»: es el patrón que Google penaliza como *scaled content abuse*).

Antes de esta, se descartó una guía de «cursos gratis vs de pago»: el catálogo de Udemy en
español no tiene **ningún** curso gratis (0 de 3.374), así que no hay nada que comparar.

### El hallazgo, medido

El número de cursos de una categoría no mide su demanda real. Con los alumnos inscritos
(`num_subscribers`) por curso, mediana por categoría, Udemy en español:

| Categoría | Cursos | Alumnos, mediana |
|---|---|---|
| IT y software | 180 | 3.021 |
| Desarrollo | 364 | 2.140 |
| Productividad | 151 | 1.128 |
| Negocios | 956 | 671 |
| Diseño y creatividad | 511 | 434 |
| Humanidades y sociales | 206 | 411 |
| Desarrollo personal | 648 | 322 |
| Salud y bienestar | 358 | 195 |

Negocios tiene 5 veces más cursos que IT y software (956 frente a 180), pero un curso de IT
tiene de mediana 4,5 veces más alumnos inscritos. Hay categorías sobreofertadas (muchos
cursos, poco alumnado cada uno) y categorías con menos oferta pero mucho más tirón por curso.
Se usa la mediana, no la media: la media sale muy distorsionada por algún curso con cientos de
miles de alumnos (ej. Desarrollo: media 12.073 frente a mediana 2.140).

## Como persona que quiere aprender algo nuevo quiero saber qué materias tienen más alumnos de verdad para no guiarme solo por cuántos cursos hay

## Criterios de aceptación

- **Given** `/guias/demanda-por-categoria` **When** la abro **Then** veo una tabla con las
  ocho categorías, su número de cursos en español y la mediana de alumnos inscritos,
  calculada al servir la página
- **Given** la guía **When** la leo **Then** compara el número de cursos con los alumnos por
  curso y señala que no son lo mismo, con cifras reales (no una opinión de qué estudiar)
- **Given** la guía **When** la leo **Then** usa la mediana, no la media, y lo dice: evita que
  un curso con muchísimos alumnos maquille el dato de toda la categoría
- **Given** sus metadatos **When** se leen **Then** tiene título y descripción propios, es
  canónica de sí misma y declara migas de pan
- **Given** el índice de guías y el sitemap **When** se recorren **Then** la incluyen

## Fuera de alcance

- **Coursera**: no publica `num_subscribers` (comprobar al construir); si no lo publica, la
  guía es solo de Udemy, igual que HU-075 con el nivel.
- **Alumnos por tema**: se deja para una guía posterior si esta funciona; diluiría el titular.
- **Enlace directo desde la portada**: igual que las guías anteriores desde HU-070.

## Diseño

- Migración `0021`: vista `demanda_por_categoria` (`security_invoker`), una fila por
  categoría de Udemy en español, con cursos, alumnos mediana y media (para poder explicar la
  diferencia en el texto).
- `src/lib/courses/guia-demanda.ts`: mismas funciones de formato que las guías anteriores.
- Página con el aspecto de las páginas de texto, registrada en `guias.ts`.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: formato, conclusiones, que no afirma nada fuera de los datos (10 tests, `guia-demanda.test.ts`)
- [x] Integración: la vista cuenta lo mismo que una consulta directa, y Coursera queda fuera (2 tests)
- [x] E2E: un test por criterio de aceptación (5 tests propios + el índice/sitemap compartido de HU-069)
- [x] `/security-review` sin hallazgos críticos ni altos (sin hallazgos de ningún nivel)

## Retoque

Sin umbral de muestra mínima (a diferencia de `guia-precios.ts`, que tiene `MUESTRA_MINIMA`):
no hace falta porque las ocho categorías son una lista cerrada y la más pequeña tiene 151
cursos con alumnos — muy por encima de cualquier umbral razonable. Si algún día se añadiera
una categoría nueva con muestra pequeña, revisar si hace falta el mismo filtro.

## Estado

`Cerrada (2026-10-07), en la rama HU-076-guia-demanda-por-categoria, sin fusionar`
