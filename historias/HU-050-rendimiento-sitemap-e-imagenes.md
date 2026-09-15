# HU-050 — Rendimiento: sitemap cacheado e imágenes con carga diferida

## Contexto

Fase 6. Detectado al revisar el proyecto el 2026-09-13 y medido en producción el
2026-09-14. Netlify cobra por créditos, y los contadores que se gastan son despliegues,
cómputo, ancho de banda y peticiones: lo que se ahorre en cada visita se ahorra en
créditos.

Medido en `https://gourses.com`:

| Ruta | Tiempo | Tamaño | `Cache-Control` |
|---|---|---|---|
| `/sitemap.xml` | **5.116 ms** | **2.899 KB** | `public, max-age=0, must-revalidate` |
| `/buscar` | 790 ms | 284 KB | `private, no-cache, no-store` |
| `/` | 993 ms | 36 KB | `private, no-cache, no-store` |

Dos problemas concretos, y los dos baratos de arreglar:

1. **El sitemap se regenera entero en cada petición.** `src/app/sitemap.ts` lleva
   `export const dynamic = "force-dynamic"`, así que cada visita de un rastreador lee el
   catálogo completo por PostgREST en tramos de 1.000 filas. Con el catálogo en 15.395
   cursos son 16 consultas y 5 segundos de función por petición, para un contenido que
   solo cambia una vez al día, con la ingesta.
2. **Las imágenes se descargan todas de golpe.** Hay cinco `<img>` sin `loading` ni
   dimensiones. En `/buscar` son 50 miniaturas por página, que el navegador pide aunque
   la persona no baje de las diez primeras, y sin dimensiones reservadas la página salta
   al ir cargándolas.

## Fuera de alcance, y por qué

Se evaluó y se descartó a propósito:

- **Cachear las páginas principales.** Ninguna se cachea porque la cabecera y el pie leen
  la sesión desde el layout raíz, pero aunque eso se resolviera, `/`, `/buscar`,
  `/categoria` y la ficha seguirían siendo dinámicas por sus propias funciones: la
  prioridad por idioma del navegador (HU-032) y los botones de favorito (HU-019, HU-045).
  Hacerlas cacheables es rediseñar cuatro historias cerradas. Decisión de alcance tomada
  explícitamente: no entra aquí.
- **`next/image`.** En Netlify pasa por su Image CDN, que transforma cada imagen en su
  infraestructura y gasta cómputo y ancho de banda, justo los contadores que se quieren
  ahorrar. Los atributos nativos del navegador consiguen lo principal sin coste.
- **Trocear el sitemap** con `generateSitemaps`. El límite de Google son 50.000 URLs y hay
  15.411: aún no hace falta.

## Como responsable del sitio quiero que cada visita cueste menos trabajo al servidor y menos descarga al navegador para gastar menos créditos y que las páginas carguen antes

## Criterios de aceptación

- **Given** el sitemap **When** se pide dos veces seguidas en un despliegue **Then** la
  segunda respuesta sale de la caché, sin volver a leer el catálogo
- **Given** el sitemap cacheado **When** pasa un día **Then** se regenera, para recoger
  lo que haya traído la ingesta
- **Given** el sitemap **When** se consulta **Then** sigue teniendo las páginas fijas, las
  once categorías y todas las fichas, igual que antes
- **Given** una lista de cursos (buscador, portada, categoría, favoritos) **When** carga
  **Then** las primeras miniaturas se piden de inmediato y el resto solo cuando se acercan
  a la pantalla
- **Given** la ficha de un curso **When** carga **Then** su imagen principal se pide de
  inmediato y con prioridad, porque es lo primero que se ve
- **Given** cualquier imagen de curso **When** aún no ha cargado **Then** su hueco ya está
  reservado y la página no salta al aparecer

## Diseño

- **Sitemap**: se quita `force-dynamic` y se declara `export const revalidate = 86400`.
  Según la documentación de esta versión, un `sitemap.ts` sin API de petición ni
  configuración dinámica se cachea por defecto, y `revalidate` fija cada cuánto se
  regenera. Un día coincide con la cadencia de la ingesta.
- **Compilación sin base de datos** (HU-044): al dejar de ser dinámico, el sitemap se
  genera también al compilar. Si no hay credenciales, el `try/catch` que ya existe
  devuelve las páginas fijas en vez de fallar, así que la verificación en GitHub sigue
  sin necesitar secretos.
- **Imágenes**: `loading="lazy"` y `decoding="async"` en las listas, salvo las primeras
  miniaturas de cada una, que van `eager` porque suelen verse al cargar y diferirlas
  empeoraría la carga. La imagen principal de la ficha va `eager` con
  `fetchPriority="high"`. Todas con `width` y `height`, que reservan el hueco; el tamaño
  en pantalla lo sigue poniendo el CSS.
- Cuántas miniaturas van de inmediato vive en una sola función con test, no repartido por
  cinco páginas.

## Cuidados

- **La caché no se ve en `next dev`**: en desarrollo todo se renderiza bajo demanda. Las
  mediciones de antes y después se hacen con `next build` y `next start` en local, y así
  se anota.
- **No dejar a los rastreadores un sitemap viejo de días**: un día como máximo.
- **No empeorar la carga inicial**: diferir una imagen que ya se ve al entrar es un error
  frecuente y hace más lenta justo la métrica que se quiere mejorar.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: la función que decide qué miniaturas se cargan de inmediato —
      `src/lib/imagenes.test.ts`, 4 tests
- [x] Integración: no aplica, no hay consulta nueva. Se ejecutó igualmente: 122 pasan
- [x] E2E: las primeras miniaturas de `/buscar` y de la portada no son diferidas y las
      siguientes sí; la imagen de la ficha no es diferida y va con prioridad; las
      imágenes llevan dimensiones; el sitemap conserva su contenido —
      `e2e/rendimiento.spec.ts`, 5 tests
- [x] Medición antes y después en compilación de producción local
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada`

### Medición antes y después

Con `next build` y `next start` en local, contra la base del NAS (15.411 URLs en el
sitemap). En `next dev` no se puede medir: ahí todo se renderiza bajo demanda.

| | Antes | Después |
|---|---|---|
| Sitemap, 1.ª / 2.ª / 3.ª petición | 553 / 399 / 501 ms | **40 / 6 / 4 ms** |
| Sitemap en la compilación | `ƒ` dinámico | `○` estático, se regenera a 1 día |
| `/buscar`: imágenes diferidas | 0 de 50 | **46 de 50** |
| `/buscar`: imágenes con dimensiones | 0 de 50 | **50 de 50** |

En producción el ahorro del sitemap será mayor que en local, porque allí tardaba
5.116 ms: la base está en Supabase Cloud y no al lado.

**Un matiz que conviene no ocultar**: la cabecera `Cache-Control` del sitemap sigue siendo
`public, max-age=0, must-revalidate`. La mejora no está en que el navegador guarde el
fichero, sino en que **el servidor ya no lo regenera**: sirve la versión compilada y la
rehace como mucho una vez al día. Cómo lo guarda Netlify en su caché está por comprobar
en el primer despliegue, midiendo igual que se midió el antes.

### Resultado de los tests

- Unitarios (`npm test`): 570 pasan, 4 nuevos.
- Integración (`npm run test:integration`): 122 pasan.
- E2E (`npx playwright test`): 200 pasan, 5 nuevos. Pasada completa limpia.

### Revisión de seguridad

Sin hallazgos:

- **No hay entrada nueva**: las imágenes siguen saliendo de la misma columna y los
  atributos añadidos son constantes.
- **El sitemap cacheado no expone nada que antes no estuviera**: es el mismo contenido
  público, regenerado con menos frecuencia.
- **La compilación sin base de datos no rompe**: sin credenciales, el `try/catch` que ya
  existía devuelve las páginas fijas, así que la verificación en GitHub (HU-044) sigue
  sin necesitar secretos.

### Visto de paso, fuera de esta historia

Durante esta historia apareció en el árbol de trabajo un cambio ajeno en
`src/app/layout.tsx` que carga Google Analytics sin consentimiento y contradice la
política de privacidad. No forma parte de este commit; se trata en HU-051.

### Corrección posterior del test (2026-09-15, durante HU-051)

Los dos tests de carga diferida fallaban en la suite completa y pasaban solos. No era
inestabilidad: HU-032 siembra cursos sin miniatura que, mientras existen, salen los
primeros. El test contaba la posición entre las **imágenes**, y el código decide por la
posición de la **tarjeta**; con una tarjeta sin imagen arriba, la quinta tarjeta (bien
marcada como `lazy`) pasaba por cuarta. El código era correcto: se corrige el test, que
ahora mide la posición de cada tarjeta dentro de su lista.
