# HU-062 — El móvil de portada, categorías, temas y novedades

## Contexto

Fase 6, rediseño móvil (2026-09-15). HU-054 y HU-055 dejaron cómodos en el móvil el
buscador, la ficha y la comparación, con dos reglas medibles: **controles de al menos
24 × 24 px** (WCAG 2.2 AA, criterio 2.5.8) y **ningún texto por debajo de 12 px**. Las
páginas que vinieron después (temas, novedades) y la portada y las categorías no se
midieron con esas reglas.

Medido a 400 × 800 (la referencia de móvil del proyecto, HU-043):

| Página | Se sale algo | Controles de menos de 24 px | Texto de menos de 12 px |
|---|---|---|---|
| Portada | no | «Ver todos →» (18 px), títulos de los cursos destacados (20 px) | 11,5 px |
| Categoría | no | «← Todas las categorías» (17 px), «Afinar la búsqueda» (18 px), títulos (21 px) | — |
| Tema | no | «← Inicio» (17 px), «Buscar también en otros idiomas» (18 px) | — |
| Novedades | no | «← Inicio» (17 px), títulos (21 px) | — |
| Legales | no | «← Volver al inicio» (17 px) | — |

Revisadas también en capturas: la disposición es correcta y nada se corta. Lo que falla es
el tamaño de lo que se pulsa con el dedo, y un texto pequeño en la portada.

## Como visitante desde el móvil quiero acertar con el dedo en los enlaces de cualquier página para no tener que ampliar la pantalla

## Criterios de aceptación

- **Given** la portada, una categoría, un tema, las novedades o una página legal en el móvil
  **When** las uso **Then** todos los enlaces y botones miden al menos 24 px de alto y de
  ancho
- **Given** esas páginas en el móvil **When** las leo **Then** ningún texto baja de 12 px
- **Given** esas páginas en el móvil **When** cargan **Then** nada se sale de la pantalla
- **Given** una pantalla de escritorio **When** se ven **Then** la disposición no cambia

## Fuera de alcance

- **Rediseñar estas páginas.** La disposición está bien; solo se corrigen tamaños.
- **Buscador, ficha y comparación**: ya cubiertos por HU-054 y HU-055.

## Diseño

- Relleno vertical en los enlaces pequeños (enlaces de vuelta, «Ver todos», enlaces de la
  presentación y títulos de tarjetas) con `display: inline-block`, para que el relleno
  cuente como zona táctil sin separar las líneas del texto. Mismo recurso que HU-055 en la
  ficha.
- El texto de 11,5 px de la portada sube a 12,5 px, como las etiquetas del buscador en
  HU-054.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: no aplica (solo CSS)
- [x] E2E: un test por criterio de aceptación (el de tamaños, uno por página)
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Lo corregido

- Enlaces de vuelta, enlaces de la presentación y títulos de tarjeta en categoría, tema y
  novedades: `inline-block` con relleno vertical.
- Portada: «Ver todos» con relleno; la plataforma de cada destacado, de 11,5 a 12,5 px.
- **Títulos de los destacados de la portada**: el `h3` recorta a dos líneas con
  `line-clamp`, que un `inline-block` rompería. El enlace se queda en línea y lleva relleno
  vertical, que cuenta en su zona táctil sin mover las líneas. Comprobado: los títulos
  siguen en una o dos líneas, y la tarjeta se ve igual en captura.
- Páginas legales: el enlace de vuelta y, **hallazgo del e2e**, los enlaces dentro del texto
  («Mi cuenta», «política de privacidad de Google»), que medían 21 px. Mismo recurso que los
  destacados: en línea, con relleno vertical, para no partir mal los enlaces largos.

WCAG 2.2 exime los enlaces dentro de una frase del mínimo de 24 px; aun así se les da
relleno, porque en el móvil se pulsan con el dedo y el coste es nulo.

### Resultado de los tests

- Unitarios (`npm test`): 754 pasan.
- Integración (`npm run test:integration`): 142 pasan.
- E2E (`npx playwright test`): 250 pasan, 8 nuevos, en 2,4 min.

### Revisión de seguridad

Sin hallazgos: solo cambia CSS.
