# HU-035 — «Mis favoritos» como sección propia de la cuenta

## Contexto

Fase 3 del roadmap (`docs/analisis-y-estrategia.md`), acabado a posteriori. HU-019
entregó la lista de favoritos en `/favoritos` y el botón de guardar en la ficha, pero
`/mi-cuenta` se quedó a medias: los favoritos figuran ahí como un enlace suelto
—`Ver mis favoritos`— encajado entre dos párrafos de nota, mientras que «Avisos de
bajada de precio», «Mis datos» y la zona de peligro son secciones con su `<h2>`, su
explicación y su acción. La página no dice cuántos cursos hay guardados ni deja
entrever la lista; hay que pulsar el enlace para saber si está vacía.

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

- **Given** que tengo al menos un curso guardado
  **When** miro la sección «Mis favoritos» de `/mi-cuenta`
  **Then** veo un adelanto de los más recientes (título enlazando a su ficha), y queda
  claro que la lista completa está a un clic

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

- **Ordenar, etiquetar o agrupar favoritos.** Sigue siendo una lista simple; ese
  deseo era ya «fuera de alcance» en HU-019 y lo sigue siendo.
- **Guardar desde la lista de resultados.** Deuda propia de HU-019, con su propio
  enredo de formularios anidados; no se toca aquí.
- **Quitar un favorito desde el adelanto de `/mi-cuenta`.** El adelanto es de solo
  lectura; quitar se hace en `/favoritos` o en la ficha, que ya lo permiten. Meter un
  formulario de borrado en el adelanto solo multiplica los sitios desde los que se
  puede equivocar uno.
- **Un contador de favoritos en la cabecera** (tipo «Favoritos (7)»). El número cambia
  al guardar y quitar; mantenerlo al día en la cabecera de todas las páginas es
  trabajo desproporcionado para el valor. El enlace lleva a la lista y ahí está el
  número real.
- **Contar los favoritos de cursos que ya no están en el catálogo.** HU-019 dejó
  dicho que esas filas quedan pero no se muestran; el recuento de esta sección cuenta
  lo que se puede pintar, igual que hace `/favoritos`.

## Cuidados

- **El recuento y el adelanto salen por la sesión del visitante**, con el cliente de
  `createSupabaseSessionClient` y la RLS de `favorites` (0004_favorites.sql). Ninguna
  consulta filtra por `user_id` a mano: si se filtrara, un olvido futuro filtraría
  datos ajenos; con la RLS, el olvido devuelve cero filas.
- **El adelanto reutiliza `listarFavoritos`** y se queda con los primeros N. No se
  escribe una consulta nueva «parecida»: dos caminos para lo mismo se desincronizan
  (distinto orden, distinto trato de los cursos retirados).
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
- El adelanto puede ser una función pequeña `adelantoFavoritos(client, n)` en
  `src/lib/favorites/favorites.ts` que llama a `listarFavoritos` y hace `slice(0, n)`,
  para que la lógica de «cuántos y cuáles» tenga un solo dueño y se pruebe sin la
  base de datos de por medio con un cliente falso.
- El número que se enseña es `favoritos.length` tras `listarFavoritos` (lo pintable),
  no un `count` de la tabla: así coincide con lo que la persona ve al abrir la lista.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: `adelantoFavoritos` respeta el orden de `listarFavoritos` y recorta a
      N; con lista vacía devuelve vacío sin fallar
- [ ] Integración: el recuento y el adelanto de A no incluyen nada de B (RLS), contra
      base de datos de test
- [ ] Integración: con 0 favoritos la sección no consulta datos de curso y no lanza
- [ ] E2E: un test por cada criterio de aceptación de arriba
- [ ] E2E: la cabecera con sesión enseña «Favoritos»; sin sesión, no
- [ ] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Abierta`
