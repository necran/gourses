# HU-034 — Cabeceras de seguridad que lleguen de verdad a producción

## Contexto

Al verificar el despliegue agrupado del 10 de septiembre de 2026 (HU-014) contra
`https://gourses.com`, de las cinco cabeceras de seguridad que declara `netlify.toml`
(añadidas en HU-014 y HU-018) solo llegaban dos: `X-Content-Type-Options: nosniff`
y una versión recortada de `Strict-Transport-Security` (sin `includeSubDomains`).
Faltaban `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.

El motivo: el bloque `[[headers]]` de `netlify.toml` se aplica a los ficheros
estáticos que sirve el CDN, pero no del todo a las páginas que el runtime de Next.js
en Netlify sirve por función. Es una limitación conocida del adaptador.

## Como titular del proyecto quiero que las cabeceras de seguridad lleguen a todas las respuestas en producción, no solo a las estáticas

## Criterios de aceptación

- **Given** cualquier página del sitio (portada, buscador, ficha) **When** se pide
  **Then** la respuesta incluye las cinco cabeceras con sus valores completos
- **Given** `next dev` en local **When** se piden esas páginas **Then** las cabeceras
  ya están, sin necesidad de desplegar para comprobarlo

## Fuera de alcance

- Content-Security-Policy: es una cabecera con mucha más superficie (hay que
  inventariar orígenes de scripts, estilos, imágenes) y merece su propia historia.
- Quitar el bloque `[[headers]]` de `netlify.toml`: se deja, porque sí sirve para
  los estáticos (`/_next/static/*`, imágenes) que no pasan por la función.

## Checklist de tests (obligatorio antes de cerrar)

- [x] E2E: la portada, el buscador y una ficha responden con las cinco cabeceras y
      sus valores exactos — `e2e/cabeceras-seguridad.spec.ts`
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

**Cerrada** (código y tests). Pendiente de comprobar en producción tras el próximo
despliegue que las cinco cabeceras llegan ya completas.

- Unitarios: 404 pasan.
- E2E: 110 pasan (2 fallos intermitentes ajenos ya conocidos:
  `orden.spec.ts` y, bajo carga, `seo.spec.ts` — ambos pasan en aislado).
- Revisión de seguridad: sin hallazgos.
