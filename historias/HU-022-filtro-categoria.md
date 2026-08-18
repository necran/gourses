# HU-022 — Filtrar por categoría

## Contexto

Bug encontrado en producción: la portada ofrece «Explora por categoría» con seis
categorías, y **las seis llevan a una página vacía**. Comprobado contra el sitio en
vivo, las seis devuelven cero cursos.

La causa es que los enlaces apuntan a `/buscar?keyword=Desarrollo`, es decir, una
búsqueda de **texto libre** con la etiqueta en español, mientras que los títulos y
descripciones del catálogo están casi todos en inglés. La categoría sí está guardada
en la base de datos —los 425 cursos la tienen— pero el buscador nunca tuvo un filtro
para ella.

Es el primer camino que recorre quien entra por la portada, así que el sitio aparenta
no tener cursos.

## Como visitante quiero pinchar una categoría y ver sus cursos para explorar sin tener que adivinar una palabra de búsqueda

## Criterios de aceptación

- **Given** que estoy en la portada **When** pincho una categoría **Then** veo cursos
  de esa categoría, no una página vacía

- **Given** que estoy viendo una categoría **When** miro el buscador **Then** la
  categoría aparece seleccionada, para saber por qué veo solo esos cursos

- **Given** que estoy viendo una categoría **When** vuelvo a «Todas» **Then** veo
  otra vez el catálogo completo

- **Given** una categoría en la dirección que no existe **When** cargo la página
  **Then** se ignora el filtro y se ven todos los cursos, sin error

- **Given** que filtro por categoría y por palabra clave a la vez **When** busco
  **Then** se aplican ambos

## Fuera de alcance

- Páginas propias por categoría (`/categoria/desarrollo`) con su SEO. Sería otra
  historia; esto es un filtro del buscador.
- Cambiar qué categorías se destacan en la portada, o cuántas.

## Cuidados

- La categoría llega por la dirección, así que es entrada externa: solo se aceptan
  identificadores del vocabulario conocido. Uno inventado no llega a la consulta y no
  se aplica, en vez de romper la búsqueda (mismo criterio que el resto de filtros).
- Se filtra por el identificador estable guardado en base de datos, nunca por la
  etiqueta visible: la etiqueta es solo cómo se enseña y puede cambiar.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: se acepta una categoría válida, se descarta una inventada
- [x] Integración: filtrar por categoría devuelve solo cursos de esa categoría
- [x] E2E: un test por cada criterio de aceptación de arriba (5 de 5)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

**Cerrada.**

- Unitarios: 241 pasan.
- Integración: 62 pasan.
- E2E: 64 pasan.
- Revisión de seguridad: sin hallazgos.

## Dos tests que estaban mal planteados

Merece anotarlos porque los dos habrían pasado midiendo otra cosa:

1. El de integración comprobaba el catálogo entero esperando encontrar las tres
   filas sembradas. No aparecían: no tienen valoración, el orden las manda al final
   y no entraban en el límite. Se busca ahora por un marcador del título, así el
   conjunto es pequeño y lo que se mide es el filtro, no el tamaño de la página.
2. El e2e recorría las seis categorías con un localizador de la portada, pero al
   navegar a la primera ya no existía. Se recogen las direcciones antes de moverse.

## Deuda que sigue abierta

- Páginas propias por categoría (`/categoria/desarrollo`) con su SEO.
- La portada sigue sin enseñar ni un solo curso: es una página de presentación. No es
  un fallo, pero quien entra por primera vez no ve catálogo hasta que pincha algo.
