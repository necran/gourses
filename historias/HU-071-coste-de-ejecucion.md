# HU-071 — Que visitar una página no cueste 50 peticiones

## Contexto

Fase 6, hosting (2026-09-21). Netlify **pausó el sitio entero** (`503 usage_exceeded` en todas
las rutas, incluidas `robots.txt` y el sitemap) por agotar los 300 créditos del plan gratuito
en el periodo del 10 de septiembre al 9 de octubre. Desglose del panel, 330,1 créditos:

| Concepto | Créditos | Peso |
|---|---|---|
| Ejecución de funciones (compute) | 147,6 | 45 % |
| Ancho de banda (4,3 GB) | 84,4 | 26 % |
| Despliegues (4 × 15) | 60 | 18 % |
| Peticiones (190.705) | 38,1 | 12 % |

Los despliegues son solo el 18 %: **el resto es tráfico**. El mes anterior fueron 29.000
peticiones y 143 MB. Google rastreó unas 1.700 veces (Search Console), menos del 1 % de las
peticiones que cuenta Netlify.

### La causa, medida

`Header` está en el layout raíz y lee las cookies de sesión, así que **ninguna página es
estática**: hasta `/privacidad`, que es texto fijo, sale con `private, no-cache, no-store` y
se ejecuta en una función en cada petición.

Y `next/link` **prefetcha cada enlace que entra en pantalla**. Como cada página es dinámica,
cada prefetch es otra petición que ejecuta otra función. Medido sobre la build de producción
(`next start`), con un navegador que hace scroll hasta abajo, peticiones al servidor **por
visita**:

| Página | Peticiones | De ellas `?_rsc=` |
|---|---|---|
| Portada | 44 | 43 |
| Buscador (listado) | 58 | 57 |
| Categoría | 65 | 64 |
| Tema | 58 | 57 |
| Novedades | 36 | 35 |
| Ficha de curso | 13 | 12 |
| Política de privacidad | 14 | 13 |

Es decir, 1 petición útil y entre 12 y 64 de relleno. Encaja con que el 82 % de lo que
rastreó Google fueran «otros tipos de archivo»: los datos `_rsc`.

## Como responsable del sitio quiero que cada visita cueste una petición y no cincuenta, y que los rastreadores que no traen visitas no gasten créditos, para que el plan gratuito aguante con tráfico real

## Criterios de aceptación

- **Given** una visita a cualquier página pública, con scroll hasta el final **When** termina
  de cargar **Then** el servidor ha recibido como mucho 3 peticiones y ninguna `?_rsc=`
- **Given** un enlace del sitio **When** lo pulso **Then** llego a la página igual que antes:
  quitar el prefetch no rompe la navegación
- **Given** el código **When** se revisa **Then** ningún fichero importa `next/link`
  directamente: todos usan `Enlace`, así que no se puede volver a introducir un `Link` con
  prefetch sin que falle un test
- **Given** `robots.txt` **When** lo leen los rastreadores **Then** se les pide no rastrear
  `/buscar?…`, `?_rsc=` y las páginas de cuenta y comparación, y se bloquea a los
  rastreadores de IA y SEO sin valor
- **Given** `robots.txt` **When** se lee **Then** sigue permitiendo todo el contenido
  (portada, fichas, categorías, temas, novedades, guías, legales) y a los buscadores

## Fuera de alcance

- **Cachear el HTML en el CDN.** Con el layout leyendo cookies, Next marca toda página como
  `private, no-store` y ningún CDN puede cachearla; forzar `s-maxage` desde fuera va contra el
  diseño del framework, no puedo probar el CDN de Netlify en local y un error serviría a una
  persona la página de otra. Se haría sacando la sesión del servidor (cabecera y pie en el
  cliente, y el botón de favoritos), una historia propia y mayor. Con el prefetch fuera, su
  valor baja mucho: ya no hay 50 peticiones por visita que evitar.
- **Bloquear a quien ignora `robots.txt`.** Eso es el cortafuegos de Netlify (el plan gratuito
  incluye reglas de tráfico y límite de peticiones básico), configuración de la cuenta.
- **Reducir el coste de cada render**: consultas a Supabase en paralelo y región de las
  funciones (las de Netlify están por defecto lejos de Irlanda). Sin registro de peticiones no
  se sabe cuánto pesa; se mide con los créditos del próximo periodo.
- **Recortar el sitemap** (15.900 fichas). Es una decisión de posicionamiento.

## Diseño

- `src/components/enlace.tsx`: `Link` con `prefetch={false}` por defecto, y quien quiera
  prefetch en uno concreto lo pide explícito. Los 30 ficheros que importaban `next/link`
  pasan a importar `Enlace`; un test lo vigila.
- `robots.ts`: una regla para `*` (permite `/`, no rastrea las rutas sin interés) y otra que
  bloquea entera a la lista de rastreadores de IA y SEO. No se bloquean buscadores ni los
  rastreadores de búsqueda con IA (`OAI-SearchBot`, `PerplexityBot`), que sí pueden traer
  visitas. La lista de bloqueados incluye `ClaudeBot`, entre otros de entrenamiento de IA;
  si se prefiere, se quita de `RASTREADORES_SIN_VALOR`.
- Tests de producción aparte (`e2e-produccion/`, `npm run test:e2e:produccion`), como los de
  analítica: el prefetch **solo existe en producción**, y el servidor de desarrollo de la
  suite normal no puede mostrarlo.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: `Enlace` sin prefetch y ningún `next/link` directo; reglas de `robots.ts`
- [x] E2E de producción: peticiones por visita y navegación por enlaces
- [x] E2E: `robots.txt` servido con las reglas nuevas
- [x] Suites completas sin regresiones
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

`Cerrada` (2026-09-21), **sin desplegar**: el sitio está pausado por Netlify y publicar exige
reactivarlo antes. Los cambios están en la rama `HU-071-coste-de-ejecucion`, sin fusionar ni
publicar.

### Resultado medido

Peticiones al servidor por visita, con scroll hasta el final, sobre la build de producción:

| Página | Antes | Después |
|---|---|---|
| Portada | 44 | **1** |
| Buscador (listado) | 58 | **1** |
| Buscador con palabra clave | 59 | **1** |
| Categoría | 65 | **1** |
| Tema | 58 | **1** |
| Novedades | 36 | **1** |
| Ficha de curso | 13 | **1** |
| Política de privacidad | 14 | **1** |

`robots.txt` servido: `Disallow` de `/buscar?`, `/*_rsc=`, `/comparar`, `/favoritos`,
`/mi-cuenta`, `/acceder`, `/boletin/` y `/cuenta-borrada`, y 19 rastreadores de IA y SEO
bloqueados por entero. Buscadores y rastreadores de búsqueda con IA, sin tocar.

**Comprobado que el test detecta el problema**: devolviendo `Enlace` al comportamiento
antiguo, el test de producción falla y lista las 12 páginas con entre 13 y 75 peticiones cada
una (`/buscar` 66, `/categoria/negocios` 75). Restaurado el arreglo, pasa.

### Resultado de los tests

- Unitarios (`npm test`): 838 pasan (12 nuevos).
- Integración (`npm run test:integration`): 162 pasan.
- E2E (`npx playwright test`): 290 pasan en 2,2 min, sin fallos (3 nuevos).
- E2E de producción (`npm run test:e2e:produccion`): 2 pasan (nuevos).

Un fallo mío por el camino, no de la web: el test de peticiones hace 12 visitas con scroll y
espera (~4 s cada una) y agotaba los 30 s por defecto de un test. Se le dio su propio límite.

### Qué comprobar cuando el sitio vuelva

Esto no se puede probar en local: hace falta el sitio publicado.

1. **Créditos por día** en Netlify (Usage & billing → Credits). Antes del 16 de septiembre
   rondaban 8 al día; desde entonces, entre 25 y 50. Debería volver a la primera cifra o menos.
2. **Search Console → Estadísticas de rastreo**: el «otro tipo de archivo» (82 % de lo que
   rastreaba Google, casi todo `_rsc`) debería caer en unos días.
3. **Peticiones por día** en Netlify (Usage → Web requests): de decenas de miles a miles.

Si tras eso el consumo sigue alto, el problema no es el prefetch y la siguiente sospecha son
rastreadores que ignoran `robots.txt`: se atajan con las reglas de tráfico del cortafuegos de
Netlify, que el plan gratuito incluye.

### Lo que no se ha hecho, y por qué

- **Cachear el HTML en el CDN.** Ver «Fuera de alcance»: con la cabecera leyendo cookies en el
  servidor, ninguna página es cacheable, y forzarlo desde fuera podría servir a una persona la
  página de otra. Se retoma, si hace falta, con la sesión fuera del servidor.
- **Un ahorro que sí está disponible y no se ha tocado**: `getUsuarioActual()` se llama en la
  cabecera, el pie y la ficha, y con sesión cada llamada es una consulta a Supabase Auth. Con
  `React.cache` serían una por petición. Se deja porque no se puede probar fuera de Next
  (`cache` solo existe en componentes de servidor) y afecta solo a quien tiene sesión.

### Revisión de seguridad

Sin hallazgos. `Enlace` solo cambia un valor por defecto del enlace; no hay entrada de usuario
ni endpoints nuevos. `robots.txt` es público por naturaleza y **no es una medida de
seguridad**: bloquear `/mi-cuenta` o `/favoritos` ahí solo pide a los rastreadores que no
entren, la protección real sigue siendo la sesión y la RLS. No se expone nada que no se
expusiera ya: las rutas eran públicas y aparecen en la navegación del sitio.
