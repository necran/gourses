# HU-016 — SEO de las fichas de curso

## Contexto

El sitio se publicó el 2026-08-11 y los buscadores lo van a rastrear por primera vez ahora. Hacer esto antes de que se indexe vale mucho más que corregirlo después, cuando ya haya páginas asentadas con datos pobres.

No es una mejora cosmética. El modelo del proyecto es tráfico orgánico que acaba en un enlace de afiliado (`HU-009`), y las **fichas de curso son la puerta de entrada natural**: quien busca un curso concreto aterriza ahí, no en la portada.

Tres carencias concretas hoy:

1. **Las 413 fichas comparten el mismo título y la misma descripción**, los que hereda del layout raíz. Google penaliza los títulos duplicados y, sobre todo, no hay nada que distinga una ficha de otra en los resultados de búsqueda.
2. **No hay datos estructurados.** El buscador no tiene forma de saber que esas páginas describen un curso con precio, valoración e idioma, así que no puede mostrar resultados enriquecidos.
3. **No hay sitemap ni `robots.txt`.** Google tendría que descubrir las 413 fichas siguiendo enlaces desde el buscador, que es lento e incompleto.

## Como visitante que busca un curso en Google quiero encontrar la ficha de ese curso concreto para llegar directamente a la comparación en vez de a una página genérica

## Criterios de aceptación

- **Given** la ficha de un curso **When** se carga **Then** su título contiene el nombre del curso y su plataforma, y no el título genérico del sitio.
- **Given** la ficha de un curso **When** se carga **Then** su descripción resume ese curso concreto, no el sitio.
- **Given** dos fichas distintas **When** comparo sus títulos y descripciones **Then** son diferentes entre sí.
- **Given** la ficha de un curso **When** un buscador la analiza **Then** encuentra datos estructurados que identifican el curso, su plataforma y, si se conocen, su precio y valoración.
- **Given** un buscador **When** consulta `/sitemap.xml` **Then** obtiene todas las fichas del catálogo junto a las páginas principales.
- **Given** un buscador **When** consulta `/robots.txt` **Then** encuentra permiso de rastreo y la referencia al sitemap.

## Fuera de alcance

- Reescribir las descripciones de los cursos: se usa lo que publica cada plataforma.
- Optimizar el contenido del buscador o de la portada más allá de lo ya hecho en `HU-012`.
- Analítica o seguimiento de posiciones: implicaría rastreadores, y la política de privacidad publicada afirma que el sitio no usa ninguno.
- Traducción o versiones por idioma.

## Cuidados

- **Los datos estructurados deben decir la verdad.** Declarar un precio que no se tiene, o una valoración inventada, es motivo de penalización manual por parte de Google. Los cursos de Coursera no tienen precio ni valoración: en esos casos, esos campos simplemente no se declaran.
- El sitemap debe generarse desde la base de datos, no fijarse a mano, o quedará desfasado en cuanto la ingesta diaria cambie el catálogo.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: título y descripción por ficha, incluidos los casos sin precio, sin valoración y sin ningún dato (`src/lib/courses/course-seo.test.ts`)
- [x] Unitarios: los datos estructurados omiten los campos desconocidos en vez de inventarlos
- [x] E2E: dos fichas distintas tienen títulos y descripciones distintos, y ninguno es el genérico del sitio (`e2e/seo.spec.ts`)
- [x] E2E: `/sitemap.xml` incluye fichas reales y páginas principales; `/robots.txt` referencia el sitemap
- [x] `/security-review`: sin hallazgos

## Notas de implementación

- **Los datos estructurados solo declaran lo que se sabe.** No se publica precio cuando el curso no lo tiene (todos los de Coursera), y **no se publica la valoración en absoluto**: schema.org exige acompañarla del número de reseñas, que no guardamos, y publicar una valoración incompleta puede interpretarse como engañosa. Se prefirió omitirla a arriesgar una penalización manual.
- El **sitemap se genera desde la base de datos** en cada petición, no fijo: la ingesta diaria cambia el catálogo y un sitemap escrito a mano quedaría desfasado en días. Si la base falla, devuelve al menos las páginas fijas en vez de un error.
- Los títulos se recortan a 60 caracteres y las descripciones a 160, que es donde truncan los buscadores; sin eso, la parte distintiva del título se pierde justo en el resultado de búsqueda.

### Un riesgo introducido y cerrado en la misma historia

El JSON-LD obliga a usar `dangerouslySetInnerHTML`, que es la forma estándar de incrustarlo pero también un sink peligroso. **`JSON.stringify` no escapa la secuencia `</script>`**, y los títulos de los cursos vienen de APIs de terceros: un título que la contuviera habría cerrado la etiqueta y permitido inyectar código en todas las fichas.

Se resolvió con `serializeStructuredData`, que escapa `<` y `>` como secuencias unicode — equivalentes dentro de una cadena JSON, pero inertes para el analizador de HTML. Hay un test que reproduce el ataque concreto y comprueba que el texto original se conserva intacto.

## Estado

Cerrada.
