# HU-046 — Una página propia por categoría, con su SEO

## Contexto

Fase 1/5. Deuda explícita de HU-022, anotada en su «Deuda que sigue abierta»:

> Páginas propias por categoría (`/categoria/desarrollo`) con su SEO.

Hoy las categorías solo existen como filtro: la portada enlaza a
`/buscar?category=desarrollo` y ahí acaba todo. Eso tiene dos problemas.

1. **No hay nada que indexar.** `/buscar` hereda el título y la descripción del layout
   («Gourses — Compara cursos online de varias plataformas»), sin metadatos propios, así
   que las once categorías comparten una única página a ojos de un buscador. Un
   comparador vive del tráfico de búsqueda (`docs/analisis-y-estrategia.md`), y «cursos
   de diseño» o «cursos de idiomas» son justo las búsquedas por las que alguien llegaría.
2. **No hay una página que enseñar.** Un enlace a un buscador con un filtro puesto no se
   comparte igual que una página que se llama «Cursos de diseño y creatividad».

El catálogo da para las once: medido el 2026-09-13, de 2.812 cursos en Negocios a 56 en
Idiomas. Ninguna nacería vacía. Quedan además 316 cursos sin categoría, que no son parte
de esta historia.

## Como alguien que busca «cursos de diseño» en Google quiero encontrar una página de Gourses dedicada a esa categoría para entrar directamente a lo que buscaba, en vez de a un buscador vacío

## Criterios de aceptación

- **Given** una categoría del catálogo **When** abro `/categoria/<su identificador>`
  **Then** veo sus cursos, con un título que la nombra («Cursos de diseño y
  creatividad»), no el genérico del sitio
- **Given** esa misma página **When** miro sus metadatos **Then** tiene título y
  descripción propios, distintos de los de otra categoría, y se declara a sí misma como
  la dirección canónica
- **Given** una categoría con más cursos de los que caben **When** llego al final
  **Then** puedo pasar de página, y esa página siguiente también es una dirección
  compartible
- **Given** que quiero afinar **When** estoy en una categoría **Then** puedo saltar al
  buscador con esa categoría ya aplicada, sin perderla
- **Given** un identificador de categoría que no existe **When** lo abro **Then** veo la
  página de «no encontrado», no una categoría vacía ni un error
- **Given** la portada **When** pincho una categoría **Then** voy a su página, no al
  buscador con un filtro puesto
- **Given** el sitemap **When** lo consulta un buscador **Then** incluye las once
  categorías

## Fuera de alcance

- **Cambiar la indexación de `/buscar`.** Sigue como está; lo que hace esta historia es
  dar una canónica propia a cada categoría. Si algún día compiten de verdad en los
  resultados, se decide entonces con datos, no por adelantado.
- **Textos de presentación escritos a mano por categoría.** La descripción se compone
  con lo que ya se sabe (nombre y cuántos cursos hay). Redactar once textos es trabajo
  editorial, no de esta historia.
- **Los 316 cursos sin categoría.** Mejorar el reparto es tarea de la ingesta.
- **Subcategorías, o categorías cruzadas con idioma o precio.** Para eso está el
  buscador.
- **Datos estructurados de listado** (`ItemList`). Se puede añadir después; primero que
  la página exista y se indexe.

## Diseño

- Ruta nueva `/categoria/[slug]`, que reutiliza `searchCourses` con esa categoría y la
  misma paginación de HU-025. No duplica el buscador: no lleva formulario de filtros,
  solo el listado y un enlace para afinar en `/buscar?category=<slug>`.
- **Lo que decide si un identificador vale ya existe**: `COURSE_CATEGORIES`. Un slug que
  no esté en esa lista es `notFound()`, igual que una ficha inexistente.
- **Metadatos con las mismas costumbres que la ficha** (`course-seo.ts`): título corto y
  distintivo, descripción por debajo de 160 caracteres, y `alternates.canonical`
  apuntando a la propia página. Los helpers van en su módulo con tests, no dentro del
  componente.
- **El sitemap añade las once**, junto a las páginas fijas que ya lleva.
- **La portada pasa a enlazar a `/categoria/<slug>`**, que es el motivo por el que la
  página existe.

## Cuidados

- **El slug viene de la URL: es entrada externa.** Se comprueba contra la lista cerrada
  de categorías antes de tocar la base de datos; nunca se interpola en una consulta.
- **Nada de contenido duplicado a lo tonto**: la categoría se declara canónica de sí
  misma, y su paginación conserva el número de página en la dirección (HU-025), de modo
  que la página 2 no se anuncia como si fuera la 1.
- **Que no se rompa el filtro que ya existe**: `/buscar?category=` sigue funcionando
  igual, porque hay enlaces antiguos y porque es a donde lleva «afinar la búsqueda».
- **Una categoría vacía no es un error.** Hoy ninguna lo está, pero si la ingesta cambia,
  la página debe decir que aún no hay cursos, no romperse.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: título, descripción y validación del slug (válido, inventado, con otras
      mayúsculas, vacío, con espacios, con intentos de inyección) —
      `categoria-seo.test.ts`, 18 tests
- [x] Integración: confirmado que no hace falta. La página no añade ninguna consulta
      nueva: reutiliza `searchCourses`, ya cubierta
- [x] E2E: un test por criterio de aceptación — `e2e/paginas-de-categoria.spec.ts`
      (7 tests)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

### Resultado de los tests

- Unitarios (`npm test`): 529 pasan, 116 omitidos (18 nuevos).
- Integración (`npm run test:integration`): 116 pasan, sin cambios.
- E2E (`npx playwright test`): 183 pasan, 7 nuevos. Pasada completa limpia, sin el
  intermitente de `seo.spec.ts` que venía saliendo estos días.
- Comprobado en el navegador a 1280 px y a 400 px.

### Revisión de seguridad

Sin hallazgos:

- **El identificador de la dirección se valida contra la lista cerrada**
  `COURSE_CATEGORIES` antes de tocar la base de datos, y nunca se interpola en una
  consulta: llega ya tipado como categoría a `searchCourses`. Probado con
  `../../etc/passwd` y con un intento de inyección.
- **Un identificador que no existe devuelve 404**, no un listado vacío que un buscador
  acabaría indexando.
- **La página lee con el cliente anónimo** y la RLS pública de HU-004; no toca datos de
  ninguna cuenta ni necesita sesión.
- **El sitemap solo añade rutas construidas desde esa misma lista cerrada**, no desde
  nada que venga de fuera.

### Qué cambió respecto al diseño previsto

- **Hizo falta una página de «no encontrado» propia.** El 404 de fábrica de Next sale en
  inglés («This page could not be found»), y el resto del sitio está en castellano; las
  fichas ya tenían el suyo desde HU-008, así que se añadió el equivalente para
  categorías. Lo detectó el test del criterio correspondiente.
- **Un test de HU-022 se adaptó, no se silenció.** Comprobaba que las categorías de la
  portada llevaran a cursos buscando enlaces a `/buscar?category=`, y ahora van a
  `/categoria/…`. Su criterio no cambia —pinchar una categoría tiene que enseñar cursos,
  no una página vacía—, solo el destino, y así queda escrito en el propio test.
- **En español, los números de cuatro cifras van sin separador** (2812) y a partir de
  cinco sí (15.744). El primer test daba por hecho «2.812» y fallaba: estaba mal
  planteado el test, no el código. Queda fijado con los dos casos.
- **La descripción cuesta una consulta más.** Para decir cuántos cursos hay,
  `generateMetadata` pide el total además de la consulta que hace la propia página: dos
  por visita. Es asumible con el catálogo actual, pero si un día pesa, la salida es
  cachear el recuento por categoría en vez de quitar el dato, que es lo que distingue
  esta descripción de una genérica.
