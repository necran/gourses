# HU-035 — «Mis favoritos» como sección propia de la cuenta

## Contexto

Fase 3 del roadmap (`docs/analisis-y-estrategia.md`), acabado a posteriori. HU-019
entregó la lista de favoritos en `/favoritos` y el botón de guardar en la ficha, pero
`/mi-cuenta` se quedó a medias: los favoritos figuran ahí como un enlace suelto
—`Ver mis favoritos`— encajado entre dos párrafos de nota, mientras que «Avisos de
bajada de precio», «Mis datos» y la zona de peligro son secciones con su `<h2>`, su
explicación y su acción. La página no dice cuántos cursos hay guardados; hay que
pulsar el enlace para saber si está vacía.

Y hay un problema de descubrimiento más de fondo: **a `/favoritos` no se llega desde
la navegación**. La cabecera solo ofrece «Buscar cursos» y «Mi cuenta»; la única otra
puerta es el enlace escondido de `/mi-cuenta`. Alguien que guarda un curso desde la
ficha no tiene forma evidente de volver a su lista.

Esta historia no añade datos ni cambia el modelo: es presentación y navegación sobre
lo que HU-019 ya dejó funcionando.

## Como persona con cuenta quiero ver mis favoritos como una parte más de mi cuenta, y llegar a ellos desde cualquier página, para no perder de vista lo que he guardado

## Criterios de aceptación

- **Given** que he entrado en mi cuenta y tengo cursos guardados
  **When** abro `/mi-cuenta`
  **Then** veo una sección «Mis favoritos» con cuántos hay y un enlace a la lista
  completa, con el mismo peso visual que las demás secciones de la página

- **Given** que he entrado en mi cuenta y no tengo ningún curso guardado
  **When** abro `/mi-cuenta`
  **Then** la sección «Mis favoritos» me dice que aún no he guardado nada y me lleva a
  buscar, sin que parezca un error ni un hueco

- **Given** que he entrado en mi cuenta
  **When** miro la cabecera en cualquier página
  **Then** tengo un enlace directo a «Favoritos», además del de «Mi cuenta»

- **Given** que no he entrado en mi cuenta
  **When** miro la cabecera
  **Then** no aparece el enlace a «Favoritos» (llevaría a la página de acceso sin
  explicar por qué)

- **Given** que estoy en `/favoritos`
  **When** miro los enlaces de navegación de esa página
  **Then** puedo volver a `/mi-cuenta` y seguir a `/buscar` (ya existe; no se rompe)

## Fuera de alcance

- **Adelantar los títulos de los favoritos en `/mi-cuenta`.** Se probó y se descartó:
  la sección enseña solo el recuento y el enlace. Repetir ahí un trozo de la lista
  añade ruido a una página que va sobre gestionar la cuenta, no sobre navegar el
  catálogo, y obliga a decidir cuántos y con qué pinta. Para ver los cursos está
  `/favoritos`, a un clic.
- **Ordenar, etiquetar o agrupar favoritos.** Sigue siendo una lista simple; ese
  deseo era ya «fuera de alcance» en HU-019 y lo sigue siendo.
- **Guardar desde la lista de resultados.** Deuda propia de HU-019, con su propio
  enredo de formularios anidados; no se toca aquí.
- **Un contador de favoritos en la cabecera** (tipo «Favoritos (7)»). El número cambia
  al guardar y quitar; mantenerlo al día en la cabecera de todas las páginas es
  trabajo desproporcionado para el valor. El enlace lleva a la lista y ahí está el
  número real.
- **Contar los favoritos de cursos que ya no están en el catálogo.** HU-019 dejó
  dicho que esas filas quedan pero no se muestran; el recuento de esta sección cuenta
  lo que se puede pintar, igual que hace `/favoritos`.

## Cuidados

- **El recuento sale por la sesión del visitante**, con el cliente de
  `createSupabaseSessionClient` y la RLS de `favorites` (0004_favorites.sql). Ninguna
  consulta filtra por `user_id` a mano: si se filtrara, un olvido futuro filtraría
  datos ajenos; con la RLS, el olvido devuelve cero filas.
- **El recuento reutiliza `listarFavoritos`** en vez de un `count` de la tabla: así
  cuenta lo mismo que se ve al abrir `/favoritos` —lo pintable, sin los cursos
  retirados del catálogo—. Un `count(*)` de `favorites` diría un número más alto que
  la lista, y eso confunde.
- **La cabecera ya decide server-side si hay sesión** (`getUsuarioActual`, que valida
  el token contra Supabase, no se fía de la cookie). El enlace a «Favoritos» cuelga de
  esa misma comprobación; no se añade una segunda forma de saber si hay sesión.
- **`/favoritos` y la sección de `/mi-cuenta` siguen siendo `noindex`** y fuera del
  sitemap: son datos personales y no deben acabar en un buscador. Esta historia no
  añade rutas nuevas, así que no hay sitemap que tocar, pero conviene que el test lo
  fije.
- **Si falla la lectura de favoritos**, `/mi-cuenta` no debe caerse entera: la sección
  muestra un texto neutro («no hemos podido cargar tus favoritos ahora mismo») y el
  resto de la página —cerrar sesión, borrar cuenta, exportar— sigue disponible. Es
  navegación, no una condición para gestionar la cuenta.

## Notas de implementación

- **Sin migración.** Solo se leen `favorites` con la sesión ya existente.
- Tocará `src/app/mi-cuenta/page.tsx` y su `page.module.css` (nueva `.seccion` de
  favoritos, quitando el enlace suelto actual), y `src/components/header.tsx` +
  `header.module.css` (nuevo enlace condicionado a `usuario`).
- `contarFavoritos(client)` en `src/lib/favorites/favorites.ts`, que devuelve
  `(await listarFavoritos(client)).length`: un solo dueño del «cuántos», probable con
  un cliente falso sin base de datos.
- La página guarda el resultado como `number | null`: `null` cuando la lectura falla,
  para poder distinguir «no se pudo cargar» de «tienes 0».

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: `contarFavoritos` cuenta los pintables; con lista vacía devuelve 0
      sin fallar; no cuenta el favorito de un curso retirado del catálogo
- [x] Integración: el recuento de A no incluye nada de B (RLS), contra base de datos
      de test
- [x] Integración: con 0 favoritos no se consultan datos de curso y no se lanza
- [x] E2E: un test por cada criterio de aceptación de arriba (5 de 5)
- [x] E2E: la cabecera con sesión enseña «Favoritos»; sin sesión, no
- [x] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

**Cerrada** (probada y fusionada; pendiente de desplegar con el siguiente lote).

- Unitarios: 425 pasan (4 nuevos de `contarFavoritos`).
- Integración: 109 pasan (2 nuevos: aislamiento del recuento entre cuentas, cuenta
  vacía).
- E2E: los 12 de `favoritos.spec.ts` pasan (5 nuevos, uno por criterio de HU-035).
  Dos fallos intermitentes en la suite completa —`favoritos.spec.ts:116` (de
  HU-019) y `seo.spec.ts:13` (de HU-016)— son anteriores y ajenos: pasan 3/3 en
  aislamiento y no tocan nada de esta historia.
- Revisión de seguridad: sin hallazgos. El cambio es presentación y un recuento de
  solo lectura sobre el patrón de sesión + RLS ya establecido; no añade consultas,
  ni entrada de usuario a ninguna consulta, ni `dangerouslySetInnerHTML`.

## Qué se descartó por el camino

El primer borrado enseñaba también un adelanto con los títulos de los tres
favoritos más recientes. Se quitó tras verlo montado: repetir un trozo de la lista
en una página que va sobre gestionar la cuenta es ruido, y obliga a decidir
cuántos y con qué pinta. La sección se quedó en recuento + enlace.
