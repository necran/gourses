# HU-064 — Revisión automática de accesibilidad con axe

## Contexto

Fase 6, calidad antes de publicar (2026-09-15). HU-054, HU-055 y HU-062 midieron a mano
tamaños de controles y de letra en el móvil, pero nadie había pasado una revisión
automática de las reglas WCAG por todo el sitio. `axe-core` (vía `@axe-core/playwright`)
comprueba contrastes, etiquetas, puntos de referencia, nombres accesibles y ARIA en la
página ya renderizada.

### Lo que encontró la primera pasada (WCAG 2.2 AA + buenas prácticas, tema claro y oscuro)

| Problema | Páginas | Regla |
|---|---|---|
| «← Anterior / Siguiente →» inactivos con contraste 2,25:1 (claro) y 2,5:1 (oscuro); hace falta 4,5:1 | buscar, categoría, tema, novedades | `color-contrast` (1.4.3) |
| La casilla que pliega los filtros tenía la etiqueta oculta en escritorio, y seguía siendo enfocable: el tabulador se paraba en un control invisible | buscar | `label` (4.1.2) |
| La página 404 por defecto no tiene `<main>` ni puntos de referencia | cualquier dirección inexistente | `landmark-one-main`, `region` |

Sin problemas en portada, ficha (Udemy y Coursera), comparación (llena y vacía), guía,
páginas legales, acceder y favoritos sin sesión.

## Como persona que navega con lector de pantalla, teclado o poca visión quiero que el sitio cumpla las pautas de accesibilidad para poder usarlo igual que cualquiera

## Criterios de aceptación

- **Given** las páginas públicas del sitio (portada, buscador con y sin búsqueda, fichas,
  comparación, categoría, tema, novedades, guía, legales, acceder, 404) **When** se revisan
  con axe en tema claro **Then** no hay infracciones de WCAG 2.2 AA ni de buenas prácticas
- **Given** esas páginas **When** se revisan en tema oscuro **Then** tampoco hay infracciones
- **Given** el móvil, con los filtros del buscador desplegados **When** se revisa **Then** no
  hay infracciones
- **Given** una sesión abierta **When** se revisan «Mi cuenta» y «Favoritos» **Then** no hay
  infracciones
- **Given** el buscador en escritorio **When** se recorre con el tabulador **Then** el foco
  nunca cae en un control invisible
- **Given** una dirección que no existe **When** se abre **Then** responde 404 con una página
  que tiene su contenido principal y enlaces para seguir

## Fuera de alcance

- **Auditoría manual con lector de pantalla.** axe detecta en torno a la mitad de los
  problemas de accesibilidad; el resto (orden de lectura con sentido, textos alternativos
  que digan algo) necesita una persona.
- **Correos** (avisos de precio, acceso): no son páginas.

## Diseño

- Paginación inactiva: gris de texto secundario sin opacidad y borde discontinuo, para que
  se distinga de los enlaces sin ser ilegible.
- Casilla de filtros: `display: none` en escritorio, donde no hace nada; solo existe en el
  móvil, donde su etiqueta es el botón visible.
- `src/app/not-found.tsx` con `<main>`, `noindex` y enlaces al buscador y a la portada.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: no aplica (CSS y una página estática)
- [x] E2E: un test por criterio de aceptación
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-15)

### Lo corregido

- Paginación inactiva en buscar, categoría, tema y novedades: sin `opacity: 0.5`, con borde
  discontinuo.
- Casilla de filtros del buscador: no existe en escritorio. **Comprobado que el test lo
  detecta**: con el CSS anterior, el recorrido con el tabulador se para en `ver-filtros` y
  falla; con el arreglo, pasa.
- `src/app/not-found.tsx`: 404 con `<main>`, `noindex` y enlaces para seguir.

Dependencia de desarrollo nueva: `@axe-core/playwright` 4.13.0.

### Resultado de los tests

- Unitarios (`npm test`): 772 pasan.
- Integración (`npm run test:integration`): 145 pasan.
- E2E (`npx playwright test`): 263 pasan (6 nuevos), en 2,4 min.
  - La primera pasada dio 4 fallos por tiempo en otras historias (navegaciones de más de 5 s):
    las revisiones de axe corrían en varios workers a la vez y el servidor de desarrollo
    llevaba hora y media encendido.
  - El spec pasó a ejecutarse en serie y se reinició el servidor.
  - Con eso, la suite pasó entera.

### Revisión de seguridad

Sin hallazgos. Cambia CSS, añade una página estática sin entrada del usuario y una
dependencia solo de desarrollo (no llega al paquete de la web). El test con sesión crea un
usuario `zzz-hu064-e2e-…@example.com` y lo borra siempre en `finally`.
