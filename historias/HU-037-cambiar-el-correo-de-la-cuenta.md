# HU-037 — Cambiar el correo de mi cuenta

## Contexto

Fase 3, cerrando deuda de HU-018 y de la política de privacidad.

El correo es **la identidad de la cuenta y el único dato personal que se guarda**. No
hay contraseña: se entra con un enlace mágico enviado a ese correo. De ahí dos
consecuencias que hoy no tienen solución:

1. **Recuperación.** Si alguien pierde el acceso a su buzón (cambia de trabajo, cierra
   una cuenta de correo antigua), pierde también su cuenta de Gourses y sus favoritos,
   sin ninguna vía para recuperarlos. El enlace mágico es la única llave y va a un
   sitio al que ya no llega.
2. **Rectificación (RGPD art. 16).** La política de privacidad dice que este derecho se
   ejerce «escribiendo a `hola@gourses.com`» — un buzón que no existe (deuda de HU-020
   y HU-024). El único dato rectificable es justamente el correo, y no hay forma de
   hacerlo.

Supabase Auth soporta el cambio de correo de forma nativa (`updateUser({ email })`),
con confirmación por enlace. La historia es envolverlo con las mismas precauciones que
el resto del acceso: no filtrar qué correos ya tienen cuenta, no dejar credenciales en
registros, y que la lógica se pruebe sin depender del correo real.

## Como persona con cuenta quiero cambiar el correo asociado para no perder mi cuenta si dejo de usar el correo con el que me di de alta, y para corregirlo si me equivoqué

## Criterios de aceptación

- **Given** que he entrado en mi cuenta
  **When** abro `/mi-cuenta`
  **Then** encuentro cómo cambiar mi correo, junto a las demás opciones de la cuenta

- **Given** que estoy en el formulario de cambio de correo
  **When** escribo una dirección con formato inválido y envío
  **Then** se me indica el problema y no se inicia ningún cambio

- **Given** que escribo una dirección nueva válida y envío
  **When** se procesa
  **Then** se me dice que hay que confirmar desde un enlace enviado al **correo
  nuevo** (y, si Supabase lo exige, también al antiguo), y que el cambio no surte
  efecto hasta entonces

- **Given** que la dirección nueva que escribo ya pertenece a otra cuenta
  **When** envío el formulario
  **Then** la respuesta es la misma que si estuviera libre: no se me revela que ese
  correo ya está registrado

- **Given** que he pedido el cambio y no he confirmado
  **When** vuelvo a `/mi-cuenta`
  **Then** sigo identificado con el correo antiguo y se me recuerda que hay un cambio
  pendiente de confirmar

- **Given** que abro el enlace de confirmación del cambio
  **When** es válido y no ha caducado
  **Then** mi cuenta pasa a tener el correo nuevo, conservo la sesión y mis favoritos,
  y los siguientes enlaces de acceso van al correo nuevo

- **Given** que abro un enlace de confirmación caducado, ya usado o manipulado
  **When** lo abro
  **Then** se me lleva a la cuenta con un aviso de que ese enlace ya no vale y de que
  puedo volver a pedir el cambio, sin mostrar un error crudo

- **Given** que pido varios cambios seguidos en poco tiempo
  **When** supero el límite de envíos
  **Then** se me responde como si se hubiera enviado, sin tratarlo como un fallo
  (mismo criterio que el acceso)

## Fuera de alcance

- **Cambiar el correo sin sesión iniciada**, como flujo de recuperación para quien ya
  no puede entrar. Es un caso distinto y más delicado (hay que probar la titularidad
  de la cuenta por otra vía); merece su propia historia y su propio análisis de
  riesgo. Esta cubre el cambio **teniendo sesión**, que ya sirve para no perder la
  cuenta si se actúa a tiempo.
- **Fusionar dos cuentas** si resulta que el correo nuevo ya tenía una. No se fusiona
  nada: el cambio simplemente no se completa, con la misma respuesta neutra.
- **Deshacer un cambio ya confirmado** desde la interfaz. Se vuelve a cambiar, con el
  mismo procedimiento.
- **Verificar el correo antiguo antes de permitir pedir el cambio.** Al darse de alta
  ya se confirmó; exigirlo otra vez no añade seguridad y sí fricción.
- **Avisar por otras vías** (SMS, notificación) de que se ha pedido un cambio. El aviso
  al correo antiguo, si Supabase lo manda, ya cumple esa función.

## Cuidados

- **La clave de servicio no entra aquí.** El cambio se hace con la sesión del
  visitante: `client.auth.updateUser({ email }, { emailRedirectTo })`. Es una
  operación sobre el propio usuario autenticado; no hace falta —ni debe usarse— la
  clave que salta la RLS. Igual que en HU-020 y HU-024.
- **`emailRedirectTo` sale de `urlSitio()`** (el helper de HU-«enlace de acceso en
  local»), nunca de `TITULAR.url` fijo ni de la cabecera `Host`: el enlace de
  confirmación viaja por correo y un destino tomado del `Host` lo convertiría en un
  redirector a un sitio ajeno. En producción hay que tener `NEXT_PUBLIC_SITE_URL`
  definida.
- **No se revela qué correos tienen cuenta.** Si la dirección nueva ya está registrada,
  Supabase no completará el cambio, pero la página debe responder lo mismo que si
  estuviera libre. Un mensaje distinto convertiría el formulario en un comprobador de
  usuarios, igual que se cuidó en HU-018.
- **El enlace de confirmación es una credencial.** No aparece en registros ni en
  direcciones que se compartan; el canje ocurre en una ruta de servidor que solo
  redirige, como el `callback` de acceso.
- **Confirmación segura de doble extremo.** Supabase, con `Secure email change`
  activado, envía enlace al correo **nuevo y al antiguo**, y exige ambos. Hay que
  decidir y documentar si se deja así (más seguro: quien controla el buzón antiguo se
  entera y puede frenar un secuestro) o se relaja. Por defecto, dejarlo activado.
- **La sesión y los favoritos no se tocan.** El `user.id` no cambia al cambiar el
  correo, así que los favoritos (ligados a `user_id`) siguen ahí y la sesión sigue
  siendo válida. Un test debe demostrarlo, porque es justo el miedo de quien duda en
  pulsar.
- **Límite de envíos.** El cambio de correo usa el mismo transporte que el acceso, con
  el mismo mínimo entre envíos. Pulsar dos veces no es un fallo: se responde como si
  se hubiera enviado (mismo criterio que se aplicó al enlace de acceso).
- **Coherencia con la política.** `/privacidad` dice hoy que la rectificación se
  ejerce escribiendo a `hola@gourses.com`. Tras esta historia, para el correo, se
  ejerce desde la cuenta; ese texto se actualiza como parte de la historia, no
  después.

## Notas de implementación

- **Sin migración.** El cambio de correo lo gestiona Supabase Auth en `auth.users`.
- Ruta nueva de confirmación (p. ej. `src/app/mi-cuenta/correo/callback/route.ts`) que
  canjea el token y redirige a `/mi-cuenta` con un parámetro de resultado, reutilizando
  el patrón de lista blanca de avisos que se hizo para `/acceder` (nunca reflejar el
  parámetro crudo).
- Server action `cambiarCorreo` en `src/app/mi-cuenta/`, con validación de formato
  reutilizando `isValidEmail` / `normalizeEmail` de `src/lib/auth/email.ts`, y
  traducción del error de Supabase a un texto genérico salvo el caso «demasiado
  reciente», que se trata como éxito (reutilizar `resultadoEnvio` o un hermano suyo).
- Componente de formulario con `useActionState`, con degradación sin JavaScript: el
  formulario se envía igual y la página se repinta con el aviso de «revisa tu correo».
- El «cambio pendiente» se puede leer de `user.new_email` que expone Supabase mientras
  la confirmación está en vuelo; si no está disponible de forma fiable, se puede
  omitir ese criterio o resolver con un aviso más genérico.
- Plantillas de correo: Supabase manda «Confirm email change». Hay que traducirla al
  español y sumarla al juego de `supabase/plantillas-correo/` y a los scripts
  `correo:plantillas` (Cloud) y `correo:plantillas-nas` (NAS), con su test de que no
  queda inglés de fábrica ni `{{ }}` sin rellenar.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: validación de formato del correo nuevo antes de llamar a Supabase
- [x] Unitarios: la traducción del resultado — formato inválido, envío correcto,
      «demasiado reciente» y correo ya existente (→ tratados como enviado, e
      indistinguibles entre sí), error genérico sin filtrar el mensaje de Supabase
- [x] Unitarios: la plantilla de «cambio de correo» está en español, sin `{{ }}` sin
      rellenar y sin enlaces a dominios que no sean `gourses.com`
- [x] Integración: un cambio de correo confirmado contra Supabase real conserva
      `user.id`, la sesión y los favoritos
- [x] Integración: pedir el cambio a un correo que ya tiene cuenta no completa el
      cambio y no distingue su respuesta de la del caso libre
- [x] E2E: un test por cada criterio de aceptación de arriba
- [x] E2E: la política de privacidad, para el correo, ya no remite solo al buzón
- [x] `/security-review` ejecutado, sin hallazgos críticos/altos abiertos

## Estado

**Cerrada** (probada y fusionada; pendiente de desplegar con el siguiente lote).

El SSH al NAS, rechazado al escribir esto, volvió a responder poco después.
Subida la plantilla (`npm run correo:plantillas-nas`) y añadidas las variables
`GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE` / `GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE` al
`docker-compose.override.yml` del NAS —el script solo copia el fichero al
volumen compartido, no da de alta la variable que hace que GoTrue vaya a
buscarlo—. Comprobado con un envío real: asunto «Confirma el cambio de correo en
Gourses», cuerpo en español, sin `{{ }}` sin rellenar. Sigue pendiente Cloud, sin
`SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_REF` en este entorno; anotado como
deuda más abajo.

- Unitarios: 456 pasan (20 nuevos: `resultadoCambioCorreo`, `avisoCambioCorreo`, y
  la plantilla `cambio-de-correo` sumada a la suite de las tres).
- Integración: 115 pasan (4 nuevos, contra el Supabase real del NAS, con Mailpit
  para leer los dos enlaces de confirmación — ver `MAILPIT_URL` en `.env.example`).
- E2E: 8 propios (`cambiar-correo.spec.ts`) + 1 test de HU-036 reescrito porque su
  texto exacto cambió al mover la rectificación a su propio párrafo.
- Revisión de seguridad: sin hallazgos.

## Lo que se descubrió a mano que ningún test habría avisado

El flujo real (con `@supabase/ssr`, que usa PKCE) se comprobó a mano en el
navegador porque el comportamiento de las dos confirmaciones no está documentado
de forma obvia, y una implementación ingenua se equivoca:

- **La primera confirmación de las dos no trae `code`.** Redirige con
  `?message=Confirmation+link+accepted...` — sin `code` y sin `error`. La primera
  versión del callback trataba «sin `code`» como enlace inválido, así que
  confirmar el primero de los dos enlaces (que había funcionado) enseñaba «Ese
  enlace ya no vale». Se corrigió distinguiendo `error` (fallo de verdad) de «ni
  `code` ni `error`» (primera confirmación, éxito parcial).
- **Solo la segunda trae `code`**, y solo al canjearlo se completa el cambio y se
  limpia `new_email`.
- Los dos hallazgos se confirmaron reproduciendo el ciclo completo dos veces
  contra la cuenta real de desarrollo (cambiándola y devolviéndola a su correo
  original), y quedaron fijados en los comentarios de
  `mi-cuenta/correo/callback/route.ts` y en el test de integración.

## Ajustes respecto al plan

- **`resultadoCambioCorreo`, no reutilizar `resultadoEnvio`.** Además de
  «demasiado reciente» hay que tapar `email_exists` (comprobado: Supabase sí lo
  revela para este endpoint, a diferencia del acceso), y forzar ese caso en el
  módulo de `enviarEnlace` habría acoplado dos historias por un parecido de
  superficie. Mismo patrón, módulo propio.
- **De paso**, la política de privacidad reordena «Tus derechos» para que la
  rectificación se una a las otras tres que ya se ejercían desde la cuenta
  (acceso, portabilidad, supresión), y el párrafo del buzón se queda solo con
  oposición y limitación.

## Deuda que sigue abierta

- **La plantilla en Supabase Cloud (producción) sigue sin subirse.** Solo se subió
  al NAS. `npm run correo:plantillas` la sube en cuanto alguien con
  `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_REF` lo ejecute; hasta entonces, un
  cambio de correo en producción llegaría en inglés.
- Recuperar el acceso a la cuenta cambiando el correo **sin sesión iniciada**
  sigue fuera de alcance, como ya decía la historia (requiere probar la
  titularidad por otra vía, y merece su propio análisis de riesgo).
