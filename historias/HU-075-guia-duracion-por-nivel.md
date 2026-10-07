# HU-075 — Guía «cuánto dura un curso según su nivel»

## Contexto

Fase 6, tráfico orgánico (2026-10-07). Al escribir la estrategia de tráfico orgánico con datos
de Search Console se vio que **las páginas de categoría reciben impresiones pero ningún
clic**: compiten de frente con Udemy y Coursera por términos muy generales, sin ninguna
autoridad propia. Lo que sí trae tráfico son preguntas más concretas (el tema «Liderazgo»,
fichas sueltas). Esta guía sigue esa misma lógica: un dato específico y no obvio, que ningún
agregador genérico publica porque nadie más tiene el catálogo medido así.

Se valoraron dos ideas. Comprobado contra producción:

- **«¿Es buen momento para comprar?» con el histórico de precios.** Descartada por ahora: solo
  el **2,7 % de los cursos en español de Udemy** (107 de 3.934) han mostrado alguna vez más de
  un precio en el histórico capturado desde el 10 de agosto. Con eso no se puede afirmar nada
  sobre patrones de bajada sin inventarse un patrón de una muestra mínima. Se revisa cuando
  haya más meses de ingesta continua.
- **Duración según el nivel.** Datos completos: el 100 % de los 3.977 cursos de Udemy en
  español con nivel (ya normalizado en español, HU-065) tiene también su duración. Coursera no
  publica nivel (0 de 262), así que la guía es de Udemy.

### El hallazgo, medido

| Nivel | Cursos | Duración mediana | Valoración media |
|---|---|---|---|
| Experto | 112 | 6,5 h | 4,56 |
| **Todos los niveles** | 2.249 | **6 h** | 4,58 |
| Intermedio | 479 | 5 h | 4,58 |
| Principiante | 1.137 | 3,5 h | 4,57 |

Un curso «Todos los niveles» dura de mediana **casi el doble que uno de «Principiante»**: no
es la introducción corta que el nombre sugiere, se acerca más a la duración de uno de nivel
Experto. Y la valoración media apenas varía entre niveles (4,56–4,58): elegir el nivel no es
apostar por la calidad, es apostar por cuánto tiempo se quiere dedicar.

## Como persona que busca curso quiero saber cuánto dura normalmente cada nivel para no asumir que "todos los niveles" es la opción corta

## Criterios de aceptación

- **Given** `/guias/duracion-segun-el-nivel` **When** la abro **Then** veo una tabla con los
  cuatro niveles, cuántos cursos en español tiene cada uno y su duración mediana, calculada al
  servir la página
- **Given** la guía **When** la leo **Then** dice explícitamente que es solo de Udemy, porque
  Coursera no publica nivel
- **Given** la guía **When** la leo **Then** compara los niveles entre sí con las cifras reales
  (el más largo, el más corto, la diferencia) y no afirma nada que los datos no sostengan
- **Given** sus metadatos **When** se leen **Then** tiene título y descripción propios, es
  canónica de sí misma y declara migas de pan
- **Given** el índice de guías y el sitemap **When** se recorren **Then** la incluyen

## Fuera de alcance

- **Cruzar nivel con categoría o tema**: comprobado que no aporta un hallazgo propio más allá
  de reflejar el tamaño de cada categoría; se deja fuera para no diluir el titular.
- **Guía de histórico de precios**: ver arriba, los datos todavía no dan para ella.
- **Enlace directo desde la portada**: desde HU-070 las guías sueltas no se enlazan una a una
  desde la portada, solo el índice `/guias`.

## Diseño

- Migración `0020`: vista `duracion_por_nivel` (`security_invoker`), una fila por nivel de
  Udemy en español, con cursos, con respaldo (50+ reseñas, mismo umbral que el resto del
  sitio), duración mediana y valoración media.
- `src/lib/courses/guia-nivel.ts`: mismas funciones puras de formato que las guías anteriores
  (`horas`, `porcentaje` de `guia-plataformas.ts`), conclusiones calculadas comparando el nivel
  más largo con el más corto.
- Página con el aspecto de las páginas de texto, registrada en `guias.ts` (índice y sitemap la
  recogen solos).

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: formato, conclusiones, que no afirma nada fuera de los datos (9 tests, `guia-nivel.test.ts`)
- [x] Integración: la vista cuenta lo mismo que una consulta directa, y Coursera queda fuera (2 tests)
- [x] E2E: un test por criterio de aceptación (5 tests propios + el índice/sitemap compartido de HU-069)
- [x] `/security-review` sin hallazgos críticos ni altos (sin hallazgos de ningún nivel)

## Retoque

Al aplicar la migración 0020 contra `gourses_test` con el script `apply-migrations.mjs` (que
reaplica todas desde la 0001) se descubrió que esa base **no tiene el esquema `auth`**: le
faltan todas las tablas que dependen de `auth.users` (favoritos, etc.), algo anterior a esta
historia y que no la bloquea porque la vista nueva solo depende de `courses`. Se aplicó la
0020 sola, directamente, en vez de arreglar ese hueco (fuera de alcance de HU-075).

La suite completa de integración también destapó un fallo preexistente y ajeno
(`busqueda-trigramas.test.ts`, de HU-057): el planificador de Postgres elige un escaneo por
`courses_pkey` en vez del índice de trigramas. No es una regresión de esta historia — se
reproduce igual en aislamiento — y queda pendiente como historia aparte.

## Estado

`Cerrada (2026-10-07), en la rama HU-075-guia-duracion-por-nivel, sin fusionar`
