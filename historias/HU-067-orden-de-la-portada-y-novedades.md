# HU-067 — Que la portada enseñe cursos buenos y lo recién publicado

## Contexto

Fase 6, tráfico orgánico (2026-09-16). Al revisar con el usuario cómo se ordena la portada
aparecieron dos fallos, medidos contra la base de desarrollo.

**1. «Mejor valorado» premia al que casi nadie ha valorado.** El orden por defecto (HU-007)
pide a cada plataforma sus cursos por valoración y los intercala. Lo que sale hoy:

| Curso de Udemy | Valoración | Reseñas |
|---|---|---|
| Godot 4 Intermediate Game Development Course (2026) | 5,00 | 11 |
| Discrete Mathematics 3 | 5,00 | 11 |
| Fernando Sor's 20 Studies | 5,00 | 16 |

Un 5,00 con 11 reseñas no es una señal de calidad: es falta de datos. De los 11.400 cursos
de Udemy, **8.183 tienen 50 reseñas o más**, así que hay de sobra para exigirlo.

**2. La mitad de la portada sale al azar.** Coursera no publica valoración —su API no la
tiene (HU-006)— ni número de reseñas: sus 4.106 cursos tienen `rating` nulo, así que el
orden lo acababa decidiendo `updated_at`, es decir, cuándo tocó la ingesta esa fila. Hoy el
primero es «Implementing Basic BGP». En cambio Coursera **sí** publica fecha (3.749 de 4.106
la tienen, HU-059), que es una señal de verdad y además la que le falta a Udemy.

**3. Lo recién publicado no se ve en la portada.** `/novedades` existe (HU-059) pero solo se
llega por un enlace de texto.

### Por qué no se ordena la portada entera por fecha

Era la primera idea del usuario. No se puede todavía, y conviene no hacerlo del todo:

- **Udemy solo tiene fecha en 387 cursos de 11.400.** Las fechas se añadieron ayer (HU-059) y
  solo las reciben las filas que la ingesta vuelve a tocar: las 8.352 de la pasada del día 13
  están sin fecha. Se llenarán solas con las siguientes pasadas completas.
- Aunque estuvieran, lo más nuevo es lo que aún no tiene ninguna valoración. Ordenar la
  portada entera por fecha cambia un orden sin señal de calidad por otro.

Por eso la fecha se usa donde sí manda —Coursera, que no tiene valoración— y como sección
aparte, no como orden global.

## Como visitante quiero que la portada me enseñe cursos que mucha gente ha valorado bien, y lo último que ha salido, para no tener que fiarme de un 5,00 con once votos

## Criterios de aceptación

- **Given** la portada o el buscador sin orden pedido **When** se listan cursos de Udemy
  **Then** los que tienen 50 reseñas o más van antes que los que tienen menos, y dentro de
  cada grupo mandan la valoración y el número de reseñas
- **Given** ese mismo listado **When** se listan cursos de Coursera **Then** van del más
  recién publicado al más antiguo, y los que no publican fecha, al final
- **Given** dos páginas seguidas del buscador **When** se comparan **Then** ningún curso se
  repite ni se salta: el orden sigue siendo estable
- **Given** la portada **When** la abro **Then** veo una sección con los últimos cursos
  publicados en español, con su fecha, que enlaza a todas las novedades
- **Given** que no hay ningún curso nuevo en español **When** se abre la portada **Then** la
  sección no aparece, en vez de salir vacía

## Fuera de alcance

- **Cambiar los órdenes que se piden a mano** (precio, valoración, duración): HU-027 los deja
  como los pide quien busca, sin sesgos añadidos.
- **Ordenar por fecha el catálogo entero.** Ver arriba: Udemy aún no tiene fechas.
- **Puntuación propia de relevancia** que mezcle valoración, reseñas y fecha en un número.
  Sin datos de uso sería inventarse los pesos.

## Diseño

- Migración `0018`: columna generada `bien_valorado` (`coalesce(num_reviews, 0) >= 50`, el
  mismo umbral que los temas, HU-058) y dos índices, uno por cada orden nuevo.
- `criteriosOrdenPorDefecto(source)`: función pura con el orden de cada plataforma, probada
  sin base de datos; `searchCoursesFromSource` la aplica y remata siempre con `id` para que
  la paginación siga siendo estable.
- `leerUltimasNovedades(client, limite)`: la misma consulta de HU-059 pero pidiendo unos
  pocos, en vez de traerse hasta 1.000 filas para enseñar cuatro.
- La sección de la portada reutiliza las tarjetas de «Cursos destacados».

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: criterios de orden por plataforma
- [x] Integración: el orden real contra la base (Udemy por reseñas, Coursera por fecha) y que
      la paginación sigue sin repetir
- [x] E2E: un test por criterio visible
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-16)

### Lo que cambió, medido

Los primeros cursos de Udemy en la portada, antes y después:

| Antes | Después |
|---|---|
| Godot 4 Intermediate (5,00 · **11 reseñas**) | The AI-Powered Business Writing (5,00 · **175**) |
| Discrete Mathematics 3 (5,00 · **11**) | Mastering Microeconomics (5,00 · **112**) |
| Fernando Sor's 20 Studies (5,00 · **16**) | CIA - Certified Internal Auditor (5,00 · **69**) |

Coursera pasa de un orden que decidía la fecha de la última ingesta a ir por fecha de
publicación: lo más reciente primero.

Migración `0018` aplicada en desarrollo y en la base de test. **Tarda 14 s en desarrollo**:
añadir una columna generada reescribe la tabla, así que en producción va fuera de las horas
de ingesta.

### Dos datos de prueba que ya no representaban a nada

Los dos fallaron con el cambio, y los dos estaban mal, no el código:

- `courses-search`: sembraba un curso de Coursera **sin fecha de publicación**, cuando la
  publican 3.749 de sus 4.106. Sin fecha se iba al final del orden nuevo y se salía de los
  100 primeros resultados de «rust».
- `priorizar-idioma`: sembraba cursos con **5,00 y cero reseñas**, exactamente el perfil que
  esta historia manda al final a propósito, y luego esperaba verlos en la portada.

### Resultado de los tests

- Unitarios (`npm test`): 802 pasan.
- Integración (`npm run test:integration`): 157 pasan.
- E2E (`npx playwright test`): 272 pasan (7 nuevos), en 2,6 min, sin un solo error.

**Incidencia durante las pruebas, que no era del código.** Tres suites e2e seguidas salieron
con decenas de «did not run», ningún fallo y tiempos de 15 min en vez de 2. La causa era
**Tailscale parado**: sin él la web se queda sin Supabase y cada página agota los 30 s. Se
tardó en ver porque el `ENOTFOUND` estaba en el resumen de Playwright y los filtros de
salida (`tail`) lo recortaban. Anotado en la memoria del proyecto.

### Revisión de seguridad

Sin hallazgos. El cambio es de orden de lectura: una columna generada que solo deriva de
`num_reviews`, dos índices, y una sección de la portada que lee cursos ya públicos por el
mismo camino (RLS de `courses`). No hay entrada del usuario, ni endpoints nuevos, ni datos
personales implicados.
