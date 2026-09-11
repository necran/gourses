# HU-038 — Cerrar la sesión en todos los dispositivos

## Contexto

Fase 3, higiene de seguridad de las cuentas de HU-018.

El acceso es por enlace mágico y **la sesión dura mucho**: dentro de la cookie viaja
un token de refresco que, como se anotó en la revisión de seguridad de HU-018, «dura
meses». Hoy `/mi-cuenta` solo ofrece «Cerrar sesión», que cierra **la de este
navegador**. No hay forma de cerrar las demás.

Eso deja a la persona sin salida en dos situaciones normales:

- Entró desde un ordenador prestado o público y se le olvidó salir.
- Cree que alguien ha tenido acceso a su buzón (y por tanto pudo pedir un enlace y
  entrar), y quiere cortar cualquier sesión abierta ahora mismo.

Supabase Auth lo resuelve de raíz: `signOut({ scope: 'global' })` revoca **todos** los
tokens de refresco del usuario, así que todas las sesiones caducan en cuanto intentan
renovarse. La historia es exponerlo con una explicación honesta de qué hace y qué no.

## Como persona con cuenta quiero cerrar la sesión en todos los sitios donde la haya dejado abierta para cortar el acceso si he usado un equipo ajeno o sospecho que alguien ha entrado en mi correo

## Criterios de aceptación

- **Given** que he entrado en mi cuenta
  **When** abro `/mi-cuenta`
  **Then** encuentro, junto a «Cerrar sesión», una opción para cerrar la sesión en
  todos los dispositivos, con una frase que explique la diferencia

- **Given** que pulso «Cerrar sesión en todos los dispositivos»
  **When** se procesa
  **Then** mi sesión de este navegador se cierra y se me lleva a la portada o a la
  página de acceso, como en el cierre normal

- **Given** que tenía la sesión abierta en otro navegador
  **When** he cerrado en todos los dispositivos desde el primero
  **Then** ese otro navegador deja de estar identificado la próxima vez que carga una
  página privada (al no poder renovar el token)

- **Given** que he cerrado en todos los dispositivos
  **When** quiero volver a entrar
  **Then** puedo hacerlo con un enlace de acceso nuevo, con normalidad

- **Given** que no he entrado en mi cuenta
  **When** pido la acción directamente
  **Then** no ocurre nada y se me lleva a la página de acceso

## Fuera de alcance

- **Listar las sesiones activas** (dispositivo, lugar, última actividad) para cerrarlas
  una a una. Supabase no expone ese detalle de forma sencilla desde el cliente, y para
  el caso de uso —«córtalo todo ya»— no hace falta. Si algún día se quiere, es su
  propia historia.
- **Cerrar sesiones al cambiar el correo** (HU-037) o al detectar algo raro, de forma
  automática. Aquí es una acción que la persona decide y pulsa.
- **Un aviso por correo de «se han cerrado todas tus sesiones».** El efecto ya es
  visible (deja de estar dentro); un correo más no aporta y sí ruido.
- **Caducar la sesión por inactividad.** Es otra decisión de producto, con sus
  contrapartidas de comodidad; no entra aquí.

## Cuidados

- **Es `signOut({ scope: 'global' })` con la sesión del visitante.** No requiere la
  clave de servicio: revoca los tokens del propio usuario autenticado. La clave que
  salta la RLS no aparece, como en el resto de acciones de cuenta.
- **Después hay que limpiar las cookies de este navegador** igual que hace el cierre
  normal (`cerrarSesion` en `src/app/acceder/actions.ts`): el `signOut` global revoca
  en el servidor, pero la cookie local se borra en la misma acción para no dejar un
  estado a medias en la pestaña actual.
- **La otra sesión no cae al instante, cae al renovar.** El token de acceso ya emitido
  sigue siendo válido hasta que expira (minutos); lo que se revoca es la capacidad de
  **renovarlo**. La explicación en pantalla no debe prometer un corte inmediato en el
  otro dispositivo, porque no lo es; sí lo es en la práctica en cuanto ese dispositivo
  navega y necesita refrescar.
- **Degradación sin JavaScript.** Es un `<form action={...}>` con server action, como
  «Cerrar sesión» y «Borrar cuenta»: funciona sin script.
- **No confundir las dos acciones.** «Cerrar sesión» y «Cerrar en todos los
  dispositivos» van juntas pero se distinguen a simple vista; la global no debe quedar
  como la opción por defecto ni como un botón más grande — la mayoría de las veces se
  quiere la normal.

## Notas de implementación

- **Sin migración.**
- Nuevo server action `cerrarSesionGlobal` en `src/app/acceder/actions.ts` (o en
  `src/app/mi-cuenta/`), que llama a `client.auth.signOut({ scope: "global" })`,
  limpia cookies y `redirect("/")`.
- Toca `src/app/mi-cuenta/page.tsx` y su CSS: la sección de cierre pasa a tener dos
  botones (o uno principal y un enlace secundario), con la frase explicativa.
- Revisar que el `try/catch` de escritura de cookies de `session-client` no trague un
  fallo del `signOut` sin que la persona se entere; si el `signOut` global falla,
  mejor no cerrar tampoco la local y mostrar «no se ha podido, inténtalo de nuevo».

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: la acción llama a `signOut` con `scope: "global"` (no el local por
      defecto); si `signOut` devuelve error, no dice que ha funcionado ni filtra el
      mensaje de Supabase
- [x] Integración: tras el cierre global, un segundo cliente con un token de refresco
      previo del mismo usuario no consigue renovar sesión, contra Supabase real
- [x] Integración: el cierre global de A no afecta a la sesión de B
- [x] E2E: un test por cada criterio de aceptación de arriba, salvo uno (ver abajo)
- [x] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

**Cerrada** (probada y fusionada; pendiente de desplegar con el siguiente lote).

- Unitarios: 436 pasan (3 nuevos de `cerrarSesionGlobalConCliente`).
- Integración: 111 pasan (2 nuevos, contra el Supabase real del NAS).
- E2E: los 4 de `cerrar-sesion-global.spec.ts`. En la suite completa hay dos fallos
  intermitentes ajenos —`favoritos.spec.ts:116` (HU-019) y
  `paginacion.spec.ts:27` (HU-025)—, ambos pasan 3/3 en aislamiento.

  **Corrección (2026-09-11):** `favoritos.spec.ts:116` no era intermitente ni ajeno:
  lo rompió esta historia. El test pulsaba el botón que contuviera «cerrar sesión», y
  el nuevo «Cerrar sesión en todos los dispositivos» también lo contiene, así que
  Playwright encuentra dos y falla siempre. Se detectó al unir esta rama con la de
  comparación (HU-040 a HU-042) y se corrigió pidiendo el botón exacto «Cerrar
  sesión», que es el que el test quiere pulsar. No se relajó nada de lo que comprueba.
- Revisión de seguridad: sin hallazgos. La acción no acepta ningún identificador de
  usuario ni de sesión desde el formulario —opera solo sobre la sesión con la que
  Supabase identifica la petición—, así que no hay manera de que cierre la de otra
  persona; comprobado también con el test de integración de aislamiento.

## Un criterio que no se prueba en e2e, y por qué

«Otro navegador con la sesión abierta deja de estar identificado» no tiene test de
navegador: el token de acceso ya emitido sigue siendo válido hasta que expira
(minutos), y lo que revoca el cierre global es la capacidad de **renovarlo** — no hay
forma de observar la diferencia en un navegador automatizado sin esperar esa
expiración de verdad. Se prueba donde sí es determinista y rápido: el test de
integración llama a `refreshSession()` con el token de refresco del «segundo
dispositivo» después del cierre global y comprueba que Supabase lo rechaza, que es
exactamente lo que ese navegador haría al necesitar un token nuevo.

## Ajustes respecto al plan

- **La lógica vive en `src/lib/auth/cerrar-sesion-global.ts`**, no directamente en el
  server action: un fichero `"use server"` solo puede exportar funciones asíncronas,
  así que `cerrarSesionGlobalConCliente(client)` es lo que se prueba con un cliente
  falso, y la acción en `mi-cuenta/actions.ts` solo resuelve la sesión y redirige.
- **No hace falta limpiar cookies a mano.** `scope: "global"` también cierra la
  sesión de quien lo pide, y las cookies se limpian por el mismo mecanismo que ya
  usa `cerrarSesion` (el cliente de `createSupabaseSessionClient` las escribe via
  `setAll` en la misma respuesta). Comprobado en el navegador: tras pulsar el botón,
  `/mi-cuenta` vuelve a pedir acceso.
- **Botón de texto, no un segundo `.boton`**, para que no compita en peso visual con
  «Cerrar sesión» — es la opción que se usa casi nunca, y la mayoría de las veces se
  quiere la normal.
