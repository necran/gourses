# HU-055 — La ficha y la comparación, cómodas en el móvil

## Contexto

Fase 6, rediseño móvil (2026-09-15), segunda parte tras HU-054 (buscador). Medido en un
iPhone 13 (390 × 664 de visor en Playwright):

- **Ficha**: «Ver curso en Udemy», la acción que da de comer al sitio, empieza en
  y = 810, fuera de la primera pantalla. El bloque de compra apila precio, invitación a
  guardar, «Añadir a la comparación» y, **el último**, el botón principal.
- **Comparación**: se ven 358 px de una tabla de 736. La columna de etiquetas
  («PLATAFORMA», «PRECIO»…) se come casi la mitad, y con dos cursos solo cabe uno.
  El idioma sale como código («en»).

## Como visitante desde el móvil quiero ver el precio y el botón para ir al curso sin buscar, y comparar dos cursos de un vistazo, para decidir rápido

## Criterios de aceptación

- **Given** la ficha de un curso en el móvil **When** carga **Then** el precio y el botón
  «Ver curso en…» están en la primera pantalla, y el botón va antes que guardar y
  comparar
- **Given** la ficha en el móvil **When** la uso **Then** todos los controles miden al
  menos 24 × 24 px y ningún texto baja de 12 px
- **Given** una comparación de dos cursos en el móvil **When** carga **Then** los dos se
  ven enteros, uno al lado del otro, sin desplazar la tabla, y cada dato lleva encima su
  etiqueta
- **Given** la comparación en el móvil **When** la recorre un lector de pantalla **Then**
  cada fila sigue teniendo su encabezado («Precio», «Idioma»…)
- **Given** la comparación **When** se ve el idioma **Then** aparece con su nombre
  («Inglés»), no con el código
- **Given** una pantalla de escritorio **When** se ven la ficha y la comparación **Then**
  la tabla conserva su columna de etiquetas

## Fuera de alcance

- **Una barra fija con el botón al hacer scroll.** Competiría con la barra de la cesta
  (HU-040) y con el aviso de analítica (HU-051) por el mismo borde de la pantalla. Con
  el botón en la primera pantalla, no hace falta.
- **Recortar la descripción de la ficha.** Es larga, pero es el texto de la plataforma;
  el resumen propio en español llega con HU-052/HU-053.

## Diseño

- **Ficha**: el bloque de compra pasa a tener, en este orden, precio, «Ver curso» con su
  divulgación, y guardar y comparar. El orden cambia en el HTML y no solo con CSS, para
  que el foco del teclado y el lector de pantalla sigan el mismo orden que se ve. En el
  móvil, título más pequeño, imagen 16:9 y el botón a lo ancho.
- **Comparación**: en el móvil, las etiquetas de fila se ocultan **solo a la vista** (el
  lector de pantalla las sigue leyendo como encabezados) y cada celda muestra la suya
  encima del dato con `::before`, marcado para que el lector no la lea dos veces. Las
  columnas de curso bajan a 9,5 rem: dos caben enteras; con tres o cuatro, la tabla se
  desplaza igual que antes (HU-043).

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: la fila de idioma de la comparación con nombre
- [x] E2E: un test por criterio de aceptación
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Antes y después, medido en un iPhone 13 (390 × 664 de visor)

| | Antes | Después |
|---|---|---|
| «Ver curso en Udemy» en la ficha | y = 810, fuera de pantalla | y = 601–647, dentro |
| Comparación de dos cursos | 358 px visibles de 736 | 358 de 358, los dos enteros |
| Idioma en la comparación | «en» | «Inglés» |

Revisado también en capturas.

### Hallazgos durante la historia

- **Dos tablas de nombres de plataforma.** HU-054 creó `nombrePlataforma` con su propia
  tabla, pero ya existía `sourceLabel` en `course-seo.ts` (HU-016). Ahora
  `nombrePlataforma` usa `sourceLabel`: una sola tabla.
- **El enlace «Entra en tu cuenta»** de la invitación a guardar medía 18 px de alto; lo
  detectó el test de tamaños. WCAG exime los enlaces dentro de una frase, pero en el móvil
  se pulsa con el dedo: se le dio relleno en vez de relajar el test.

### Resultado de los tests

- Unitarios (`npm test`): 622 pasan, 1 nuevo.
- Integración (`npm run test:integration`): 124 pasan.
- E2E (`npx playwright test`): 214 pasan, 6 nuevos.

Una pasada intermedia dio un fallo en HU-028 («en la segunda página el número sigue
siendo el total»): tras pulsar «Siguiente», la dirección no cambió en 5 s. La
instantánea mostraba el enlace correcto (`/buscar?keyword=python&pagina=2`) aún en la
página 1, es decir, una navegación que no terminó a tiempo con tres procesos cargando el
servidor de desarrollo. La paginación no se tocó en esta historia y la pasada completa
siguiente fue limpia. Queda anotado con esa evidencia.

### Revisión de seguridad

Sin hallazgos críticos ni altos:

- **`data-etiqueta`**: textos fijos del servidor (las etiquetas de fila), sin entrada de
  la persona. `attr()` en CSS solo pinta texto.
- **Orden del bloque de compra**: mismo contenido, mismos atributos del enlace de salida
  (`noopener noreferrer nofollow sponsored`).
