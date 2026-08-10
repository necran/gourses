# HU-012 — Portada del sitio

## Contexto

Fase 6. La raíz del sitio (`/`) sigue siendo **la plantilla por defecto de `create-next-app`**, con el logo de Vercel y enlaces a la documentación de Next.js. Cualquiera que entre en `gourses.com` verá un andamio, no un comparador de cursos.

Además, los metadatos del sitio siguen diciendo `title: "Create Next App"`. Para un comparador que vive del tráfico de búsqueda orgánica, eso no es un detalle estético: es lo que aparece en Google y en el enlace cuando alguien lo comparte.

Esta historia no depende de ninguna decisión de hosting ni de ninguna cuenta, así que puede hacerse antes que el resto de la fase.

## Como visitante quiero entender en la portada qué hace esta web y poder buscar desde ella para empezar a comparar sin dar rodeos

## Criterios de aceptación

- **Given** la raíz del sitio **When** la visito **Then** veo qué hace la web y desde qué plataformas compara, sin rastro de la plantilla de Next.js.
- **Given** la portada **When** escribo una palabra clave y confirmo **Then** llego al buscador con esa búsqueda ya aplicada.
- **Given** la portada **When** se carga **Then** las cifras que muestra (número de cursos y de plataformas) son las reales de la base de datos, nunca inventadas ni fijas en el código.
- **Given** la base de datos vacía o inaccesible **When** se carga la portada **Then** la página sigue funcionando y simplemente no muestra cifras, en vez de romperse.
- **Given** cualquier página del sitio **When** se comparte o la indexa un buscador **Then** el título y la descripción describen el comparador, no "Create Next App".

## Fuera de alcance

- Rediseño visual del buscador o de la ficha: esta historia solo crea la portada y arregla los metadatos globales.
- Página "sobre nosotros", aviso legal o política de privacidad: harán falta antes de solicitar la afiliación (`HU-009`), pero van en su propia historia.
- Cualquier configuración de despliegue: va en las historias siguientes de la Fase 6.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: función que resume el catálogo, incluido el caso vacío y el de cuenta no disponible (`src/lib/courses/catalog-summary.test.ts`)
- [x] Integración: la portada obtiene las cifras reales, y devuelve `null` sin lanzar cuando la base no responde o las credenciales no valen (`tests/integration/portada.test.ts`)
- [x] E2E: un test por criterio (`e2e/portada.spec.ts`) — contenido sin plantilla, búsqueda desde la portada, cifras reales y metadatos; el caso de base inaccesible se cubre en integración, que es donde se puede provocar de verdad
- [x] `/security-review`: sin hallazgos — la portada solo hace lecturas públicas ya permitidas por la RLS, y no toca `SUPABASE_SERVICE_ROLE_KEY` ni `DATABASE_URL`

## Notas de implementación

- Las cifras (**413 cursos de 2 plataformas**) se leen de la base en cada carga. Un número escrito a mano envejecería mal y acabaría mintiendo al visitante, así que la portada se marca `force-dynamic`.
- Solo se cuentan las plataformas que **hoy aportan cursos**, no las que existen en el código: anunciar "2 plataformas" con una vacía sería falso.
- Si la base no responde, la portada se sirve igual y omite las cifras. Son decoración, no el contenido, y no deben poder tumbar la página principal del sitio.
- Corregido de paso: `<html lang="en">` decía inglés en un sitio en español, lo que afecta a lectores de pantalla y a buscadores.
- El test de humo (`e2e/smoke.spec.ts`) comprobaba el titular del andamio de `create-next-app`; se reescribe para verificar que la portada levanta, sin acoplarse a un texto concreto.

## Pendiente para otra historia

- **Títulos por página**: hoy todas heredan el título por defecto. Para SEO, la ficha de curso debería llevar el nombre del curso en el título; 413 páginas con el mismo título se penalizan.
- **Aviso legal, privacidad y transparencia de afiliación**: harán falta antes de solicitar la afiliación (`HU-009`) y, en el caso de la divulgación de afiliación, es además una exigencia legal en varios países.

## Estado

Cerrada.
