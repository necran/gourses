# HU-065 — El nivel de los cursos, siempre en español

## Contexto

Fase 6, calidad del catálogo (2026-09-15). Encontrado al preparar HU-063. Udemy devuelve el
nivel en el idioma en que se pide el catálogo, y la ingesta hace pasadas en español y en
inglés (HU-049). En la base de desarrollo:

| En español | En inglés |
|---|---|
| Todos los niveles: 5.443 | All Levels: 1.825 |
| Principiante: 2.307 | Beginner: 629 |
| Intermedio: 745 | Intermediate: 260 |
| Experto: 166 | Expert: 23 |

La ficha, la comparación y la exportación de datos enseñan el valor tal cual: dos cursos
del mismo nivel se comparan con «All Levels» y «Todos los niveles». Coursera no publica
nivel.

## Como persona que compara cursos quiero ver el nivel siempre con las mismas palabras, en español, para comparar sin traducir

## Criterios de aceptación

- **Given** un curso de Udemy que llegó con el nivel en inglés **When** abro su ficha **Then**
  veo el nivel en español
- **Given** dos cursos del mismo nivel, uno llegado en inglés y otro en español **When** los
  comparo **Then** la fila «Nivel» dice lo mismo en los dos
- **Given** la ingesta **When** Udemy devuelve «Beginner», «All Levels»… **Then** se guarda la
  etiqueta en español (unitarios e integración: no se ve desde la web)
- **Given** los cursos ya guardados **When** se aplica la migración **Then** no queda ningún
  nivel en inglés (integración)

## Fuera de alcance

- **Filtrar por nivel** en el buscador. Con el vocabulario ya unificado sería posible, pero
  es otra historia.
- **Nivel de Coursera**: su catálogo no lo publica.

## Diseño

- `src/lib/courses/nivel.ts`: `normalizarNivel`, con las equivalencias en inglés y español.
  Lo que no reconoce se conserva tal cual.
- La normalización de Udemy la usa al ingerir.
- Migración `0016`: `update` de las filas guardadas con las mismas equivalencias.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: equivalencias, mayúsculas y espacios, valores desconocidos, normalización de Udemy
- [x] Integración: la migración deja los niveles en español y coincide con `normalizarNivel`
- [x] E2E: ficha y comparación
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Lo hecho

- Migración `0016` aplicada en desarrollo: 2.737 cursos corregidos. Quedan 7.268 «Todos los
  niveles», 2.936 «Principiante», 1.005 «Intermedio», 189 «Experto» y 2 sin nivel.
- **Al desplegar**: aplicar `0016` en Supabase Cloud. Es un `update` de unos pocos miles de
  filas que no toca las columnas generadas de la búsqueda; mejor fuera de las horas de la
  ingesta.

### Resultado de los tests

- Unitarios (`npm test`): 787 pasan.
- Integración (`npm run test:integration`): 146 pasan.
- E2E (`npx playwright test`): 265 pasan, en 2,8 min.

### Revisión de seguridad

Sin hallazgos. La normalización trabaja sobre datos de la API de Udemy antes de un insert
parametrizado; la migración es un `update` con valores fijos, sin entrada externa.
