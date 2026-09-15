# HU-059 — Cursos nuevos en español

## Contexto

Fase 6, tráfico orgánico (2026-09-15). La idea inicial era «Cursos en oferta hoy», y los
datos la descartaron:

- En seis semanas de histórico de precios hubo **7 bajadas** (y 6 subidas); el resto de
  cambios eran precios que pasaban de desconocido a conocido.
- **10.162 de los ~10.800 cursos de Udemy están a 14,99 €**: el precio guardado ya es el
  rebajado, así que casi todo parecería «en oferta» siempre.
- Coursera no publica precio.

El usuario eligió la alternativa (2026-09-15): **novedades en español**, con las fechas
reales de las plataformas. Es contenido que cambia de verdad cada semana —útil para que
Google vuelva y para que la persona vuelva— y no depende de promociones.

### Lo que dicen las APIs (comprobado el 2026-09-15)

- **Udemy**: el **listado** de descubrimiento, que la ingesta ya recorre, trae
  `published_time` (fecha de publicación) y `last_update_date` (última actualización del
  contenido) en cada curso. Comprobado con las propias funciones de la ingesta: 50 de 50
  cursos de una página los traen. **No hace falta ninguna petición más por curso.** En esa
  página (desarrollo, en español), 22 de 50 son de 2026.
- **Coursera**: la Catalog API no tiene `launchedAt`, `createdAt` ni `publishedAt` (se
  piden y se ignoran en silencio). Tiene **`startDate`**: los 100 cursos de una muestra la
  traen, repartida de 2015 a 2026 (27 de 2026). En cursos a demanda funciona como fecha de
  lanzamiento; se trata como tal y se nombra con cuidado.
- Hoy la base no guarda ninguna de estas fechas. La «llegada al catálogo» (primera fila del
  histórico de precios) no sirve: refleja nuestras pasadas de ingesta (5.773 cursos
  «llegaron» la misma semana), no cuándo se publicó el curso.

## Como visitante quiero ver qué cursos en español han salido hace poco para no perderme lo nuevo sin revisar cada plataforma

## Criterios de aceptación

- **Given** la ingesta **When** guarda un curso **Then** guarda su fecha de publicación
  (Udemy) o de lanzamiento (Coursera), y en Udemy la de última actualización, sin
  inventarla si la plataforma no la da
- **Given** `/novedades` **When** la abro **Then** veo «Cursos nuevos en español» con los
  cursos en español publicados en los últimos 90 días, del más reciente al más antiguo, y
  cada tarjeta dice cuándo se publicó
- **Given** esa página **When** leo la presentación **Then** dice cuántos cursos nuevos hay
  en ese plazo y de qué plataformas, con datos
- **Given** esa página **When** miro sus metadatos **Then** tiene título y descripción
  propios, es canónica de sí misma, y cada página de la paginación también
- **Given** menos de 20 cursos nuevos en el plazo **When** se abre **Then** la página
  responde con normalidad pero se marca `noindex, follow` y sale del sitemap
- **Given** la portada **When** recorro sus enlaces **Then** lleva a `/novedades`
- **Given** la ficha de un curso con fecha de publicación **When** la abro **Then** dice
  cuándo se publicó y, si la hay, cuándo se actualizó por última vez

## Fuera de alcance

- **Ofertas y bajadas de precio** (ver contexto).
- **Novedades por tema o por categoría** («Python nuevos»): multiplicaría páginas finas.
- **«Actualizados recientemente» como página propia**: la fecha se muestra en la ficha; una
  segunda página de novedades competiría con esta.
- **Avisos por correo de novedades**: sería otra historia, con consentimiento propio.

## Diseño

- **Migración `0013`**: `publicado_en timestamptz` y `actualizado_en_plataforma date` en
  `courses`, con índice para filtrar y ordenar por publicación.
- **Ingesta**: la normalización de Udemy lee las dos fechas del listado; la de Coursera
  pide `startDate` y la convierte. Una fecha mal formada es `null`, nunca «hoy».
- **La fecha no se pierde si una pasada no la trae**: igual que el precio desconocido
  (HU-029), un `null` en una pasada no borra una fecha buena ya guardada.
- **Página `/novedades`**: lista de los cursos en español con `publicado_en` en los últimos
  90 días, paginada de 50 en 50; presentación con datos; mismo umbral mínimo que los temas
  (20) para ser indexable. Se lee con una consulta indexada.
- **Rellenar los cursos existentes**: la ingesta diaria lo hace sola en producción. En
  desarrollo, una pasada de Coursera (barata) y una de Udemy en español.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: lectura de fechas de Udemy y Coursera (válidas, ausentes, mal formadas,
      `startDate` 0), plazo de 90 días, texto de presentación, metadatos, umbral
- [x] Integración: la ingesta guarda las fechas y una pasada sin fechas no borra las
      guardadas (base de test). La lectura de novedades por PostgREST la ejercitan los e2e
      contra la base de desarrollo
- [x] E2E: un test por criterio visible desde la web, salvo el umbral (ver abajo)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Lo construido

- Migración `0013`: `publicado_en` y `actualizado_en_plataforma`, con índice por idioma
  y fecha.
- `fechas-plataforma.ts`: lectura validada. Una fecha mal formada, futura o anterior a
  2009 es `null`, nunca «hoy».
- Ingesta: Udemy lee las dos fechas del **listado** (sin peticiones adicionales);
  Coursera pide `startDate`. El guardado usa `coalesce`: una pasada sin fechas no borra
  las buenas.
- `/novedades`: los cursos en español publicados en los últimos 90 días, del más reciente
  al más antiguo, con la fecha en cada tarjeta («Publicado el…» en Udemy, «Lanzado el…» en
  Coursera), paginación de 50, canónica propia, `noindex` por debajo de 20 cursos, migas de
  pan y entrada en el sitemap si supera el mínimo.
- Ficha: «Publicado el 3 de julio de 2017 · Actualizado el 4 de junio de 2026».
- Portada: «Ver los cursos nuevos en español →» bajo los temas.

### Datos en desarrollo

- Coursera (pasada de 40 páginas, 79 s): fecha en 4.000 de 4.106 cursos.
- Udemy en español (pasada limitada a 6 ámbitos): 375 cursos, todos con las dos fechas.
- `/novedades`: 21 cursos (10 de Udemy y 11 de Coursera). En producción, la ingesta diaria
  rellena todas las fechas en su primera pasada.

### El criterio del umbral no tiene e2e

«Con menos de 20 cursos nuevos, `noindex`» no se puede provocar con los datos reales sin
borrar cursos de la base compartida. Lo prueban los unitarios de `superaUmbralNovedades`.

### Hallazgo: la búsqueda con paréntesis daba 500

Un e2e de la cesta falló porque buscar el título «Godot 4 Intermediate Game Development
Course (2026)» daba HTTP 500. Venía de HU-007 y se destapó al cambiar el primer curso de
`/buscar` con la pasada de Udemy. Se corrigió en un commit propio y está anotado en HU-057.

### Pasadas con fallos antes de la buena

Dos pasadas completas fallaron por navegaciones que no terminaban (paginación, ficha). En
ambas, el registro del servidor mostraba peticiones de 3 a 13 s que medidas después, sin
carga, tardaban 0,3–0,5 s, y el servidor de desarrollo había crecido a 1,3 GB. Se sospechó
de las páginas de tema por el tamaño de sus descripciones y **se descartó con datos**:
fotografía, con 93 KB, también tardó 10 s. Reiniciado el servidor, la pasada fue limpia.

### Resultado de los tests

- Unitarios (`npm test`): 748 pasan, 36 nuevos.
- Integración (`npm run test:integration`): 140 pasan, 3 nuevos.
- E2E (`npx playwright test`): 239 pasan, 5 nuevos, en 1,9 min.

### En producción

Aplicar `0013` en Supabase Cloud con las demás (`0009`–`0012`). No hace falta relleno:
la ingesta diaria escribe las fechas.

### Revisión de seguridad

Sin hallazgos críticos ni altos:

- **Fechas de terceros**: validadas antes de guardarse; ni una cadena rara ni una fecha
  futura llegan a la base como fecha.
- **SQL**: parámetros de `pg` en el guardado; supabase-js en la lectura, con la fecha
  calculada en el servidor.
- **Página**: `pagina` pasa por `parseCourseSearchFilters`; migas de pan por
  `serializeStructuredData`; las fechas se pintan como texto y en `<time dateTime>`.
