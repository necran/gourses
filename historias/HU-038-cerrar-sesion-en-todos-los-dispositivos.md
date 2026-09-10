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

- [ ] Unitarios: la acción llama a `signOut` con `scope: "global"` y limpia cookies;
      si `signOut` lanza, no redirige como si hubiera funcionado
- [ ] Integración: tras el cierre global, un segundo cliente con un token de refresco
      previo del mismo usuario no consigue renovar sesión, contra Supabase real
- [ ] Integración: el cierre global de A no afecta a la sesión de B
- [ ] E2E: un test por cada criterio de aceptación de arriba
- [ ] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

`Abierta`
