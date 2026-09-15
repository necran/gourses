# HU-056 — SEO técnico: que Google entienda el sitio y no indexe duplicados

## Contexto

Fase 6, estrategia de tráfico orgánico (2026-09-15). Revisando la web publicada y el
código aparecieron fallos técnicos que no dependen del contenido y que frenan a un
buscador aunque el contenido sea bueno:

1. **`/buscar` no tiene metadatos propios**: hereda el título y la descripción de la
   portada, y cada combinación de filtros (`?keyword=…&maxPrice=…&pagina=…`) es una
   dirección indexable distinta con contenido casi igual. Duplicados sin límite.
2. **La página 2 de una categoría declara como canónica la página 1**:
   `generateMetadata` no lee `pagina`. Google recomienda que cada página de una
   paginación sea canónica de sí misma; si no, puede ignorar las siguientes y los cursos
   que solo aparecen en ellas.
3. **Sin imagen para compartir**: un enlace a gourses.com en WhatsApp, X o LinkedIn sale
   sin imagen.
4. **Sin datos estructurados del sitio**: no se declara qué es el sitio ni su buscador;
   solo la ficha tiene los de «Curso». Tampoco hay migas de pan en fichas y categorías.
5. **La portada solo enlaza 6 de las 11 categorías**: 5 páginas de categoría solo se
   descubren por el sitemap.
6. **El sitemap declara todas las fichas «modificadas» cada día**: `lastModified` sale de
   `updated_at`, que la ingesta diaria actualiza aunque no cambie nada (lo mismo que se
   vio en HU-052). Un `lastmod` que siempre cambia enseña a Google a ignorarlo.

## Como responsable del sitio quiero que los buscadores entiendan qué páginas importan y cómo se relacionan para que las indexen bien y lleguen visitas

## Criterios de aceptación

- **Given** `/buscar` sin filtros **When** se lee su cabecera **Then** tiene título y
  descripción propios y es canónica de sí misma; **Given** una búsqueda con palabra
  clave, filtros, orden o página **Then** se marca `noindex, follow` con la canónica en
  `/buscar`
- **Given** la página 2 de una categoría **When** se lee su cabecera **Then** su canónica
  es ella misma, no la página 1
- **Given** la portada o una categoría **When** se comparten **Then** llevan imagen de
  1200 × 630 y tarjeta grande de X; **Given** una ficha con miniatura **Then** comparte
  la miniatura del curso
- **Given** la portada **When** se leen sus datos estructurados **Then** declara el sitio
  (`WebSite`) con su buscador (`SearchAction`) y la organización
- **Given** una ficha o una categoría **When** se leen sus datos estructurados **Then**
  declaran sus migas de pan (`BreadcrumbList`) con direcciones absolutas
- **Given** la portada **When** se recorren sus enlaces **Then** llevan a las once
  categorías
- **Given** el sitemap **When** se lee **Then** las fichas no declaran una fecha de
  modificación que cambia cada día

## Fuera de alcance

- **Decidir qué fichas no indexar por contenido escaso** (las que solo copian la
  descripción de la plataforma). Depende de cuántos resúmenes haya en producción
  (HU-052/HU-053); se revisa con datos de Search Console.
- **Páginas por tema** («cursos de Python en español»): historia propia.
- **hreflang**: el sitio solo está en español.

## Diseño

- **Funciones puras** en `src/lib/seo/seo-sitio.ts`: si una búsqueda es indexable, los
  datos estructurados del sitio y las migas de pan. Se prueban sin montar páginas.
- **Imagen para compartir estática** (`src/app/opengraph-image.png` y su texto
  alternativo), no generada por petición: generar imágenes gasta cómputo de Netlify en
  cada vista de un rastreador de redes, y la portada no cambia.
- **`/buscar` con `generateMetadata`**, que recibe los parámetros de la dirección.
- **Migas de pan solo como datos estructurados**: la ficha y la categoría ya tienen su
  enlace de vuelta visible; no se añade otra fila de navegación.
- **Sitemap**: las fichas sin `lastModified`, en vez de una fecha que no significa nada.
  Las páginas fijas y las categorías tampoco la llevaban.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: búsqueda indexable (sin nada, con cada tipo de filtro, página 2, orden,
      sinDato), datos del sitio, migas de pan (direcciones absolutas, posiciones), el
      escapado de `</script>` sigue aplicándose
- [x] E2E: un test por criterio de aceptación
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Cambio de diseño durante la implementación: la imagen, fuera del fichero especial

El diseño preveía `src/app/opengraph-image.png`, el fichero especial de Next. Funcionó
en la portada, pero el e2e detectó que **la página de categoría se compartía sin
imagen**: al declarar su propio `openGraph` (título y descripción de la categoría),
sustituye entero el del layout, y la imagen por fichero de la raíz no se aplica a ese
segmento. Comprobado leyendo la cabecera real: la categoría no tenía ni `og:image` ni
`og:site_name`.

Se cambió a una imagen en `public/imagen-compartir.png` declarada explícitamente en un
bloque común (`OPEN_GRAPH_SITIO`: imagen, nombre del sitio, idioma) que usan el layout y
la categoría. Un test unitario comprueba que el fichero existe donde dicen los
metadatos. La ficha sigue compartiendo la miniatura del curso.

La imagen se generó a partir de un HTML con la tipografía y los colores del sitio,
renderizado a 1200 × 630 y revisado a ojo (la primera versión tenía el texto tapado por
los círculos decorativos).

### Tests que cambiaron

- `seo.spec.ts` (HU-016) y `enriquecer-ficha.spec.ts` (HU-029) leían «el» bloque de
  datos estructurados de la ficha; ahora hay dos (curso y migas de pan). Leen el del
  curso por su `@type`. Un primer intento con `filter({ hasText })` se quedaba
  esperando: Playwright no mira dentro de un `<script>` con ese filtro.

### Resultado de los tests

- Unitarios (`npm test`): 642 pasan, 20 nuevos.
- Integración (`npm run test:integration`): 124 pasan.
- E2E (`npx playwright test`): 221 pasan, 7 nuevos, en 2,0 min.
- Compilación de producción: correcta; el sitemap sigue estático con revalidación diaria.

Hubo dos pasadas completas con fallos antes de la buena, y **ninguno venía de esta
historia**, pero se investigaron antes de afirmarlo:

1. **4 fallos por navegaciones que no terminaban**: se había lanzado la suite unitaria
   completa **a la vez** que la e2e (error de método: no se debe cargar la máquina
   durante una pasada). Uno de ellos mostraba «This page couldn't load», y el registro
   del servidor tenía la causa: `Fallo al buscar cursos: canceling statement due to
   statement timeout` en `/buscar?keyword=python&orden=precio-asc&pagina=2`, que tardó
   3,3 s con el rol `anon`, cuyo `statement_timeout` es **3 s** (comprobado en
   `pg_roles`). Explica también el fallo intermitente de HU-045 visto en HU-054.
2. **3 fallos por tiempo con la suite sola**: el servidor de desarrollo llevaba 2 h 44 min
   encendido, estaba al **359 % de CPU en reposo y ocupaba 3,7 GB**. Reiniciado, la pasada
   completa fue limpia (221/221, 2,0 min) y el servidor quedó en 1,4 GB.

**Riesgo que queda abierto, fuera de esta historia**: una búsqueda por palabra clave
tarda ~1,8 s sin carga contra un límite de 3 s. Bajo carga se cancela y la persona ve un
error. Se trata en su propia historia.

### Revisión de seguridad

Sin hallazgos críticos ni altos:

- **Datos estructurados**: todos pasan por `serializeStructuredData`, que escapa `<` y
  `>` (un test comprueba que un título con `</script>` no cierra la etiqueta en las
  migas de pan). La única entrada de terceros incrustada es el título del curso.
- **Canónica de categoría**: la página sale de `parseCourseSearchFilters` (entero
  saneado) y el slug de la lista cerrada de categorías; no se puede inyectar una
  dirección ajena.
- **`robots` y canónica de `/buscar`**: valores fijos; la entrada de la persona solo
  decide entre dos opciones.
- **Imagen**: fichero estático propio, sin carga de terceros.
