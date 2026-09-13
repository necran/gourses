# Correo saliente (Resend) — HU-021

Los avisos de bajada de precio se envían con Resend. Este documento recoge la
configuración y **por qué** es la que es, porque varias decisiones no son obvias
y equivocarlas rompe el correo del dominio.

## Estado

| Pieza | Estado |
|---|---|
| Dominio en Resend | `gourses.com`, región Irlanda (eu-west-1) |
| Registros DNS en IONOS | **añadidos y verificados** (dominio *Verified* el 2026-08-20) |
| `RESEND_API_KEY` en GitHub | pendiente de rehacer si se creó una clave nueva (ver más abajo) |
| SMTP propio en Supabase | **configurado y funcionando** (2026-08-20) |
| Plantillas de los correos de acceso | **en español**, en Cloud (2026-08-24; contenido puesto al día el 2026-09-13) y en el NAS (2026-09-10) |
| Plantilla de cambio de correo (HU-037) | **en español**, en el NAS (2026-09-10) y en Cloud (2026-09-13) |
| Correo en desarrollo (NAS) | **Mailpit**, buzón en http://192.168.1.139:8025 (2026-09-10) |

El acceso a la web ya sale por Resend, con el límite de Auth en **30 correos por
hora** en vez de los 2 del proveedor integrado de Supabase. Los avisos de precio
(HU-021) van por otro camino —la API de Resend desde el workflow— y siguen
dependiendo de `RESEND_API_KEY`: mientras falte, ese paso se salta solo y las
bajadas se registran en el log en vez de enviarse.

## Los tres registros añadidos

Ninguno pisa nada de lo que ya existe: usan nombres nuevos (`send` y
`resend._domainkey`).

| Tipo | Nombre | Valor | Prioridad |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCqoEHZbr7ay5/hBpQxV+BdhD4bqyTp2NMUiS62OqvzH0Ry/jnTHPUHC2wnZ+ISIa1K+Sh79eXivHFiRfFvoT9mvTCRn2z+6l0p803w5knDJZFb4C7dlAAzEg7LGU7z/LGJ4w7oeuKAJ64IFqQXxFP4tXk9rVXDaueZfRewKIkLoQIDAQAB` | — |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

## Lo que Resend ofrece y NO se pone

Resend muestra más registros de los que hacen falta. Dos se descartan a
propósito:

**El MX de «Enable Receiving»** (`inbound-smtp.eu-west-1.amazonaws.com`). Va en la
raíz del dominio y chocaría con el correo de IONOS, que ya tiene ahí
`mx00.ionos.es` y `mx01.ionos.es`. Añadirlo desviaría el correo entrante del
dominio. Aquí solo se envía; no se recibe nada por Resend. En el panel de Resend,
«Enable Receiving» está apagado.

**El DMARC opcional** (`_dmarc` con `v=DMARC1; p=none;`). Ya existe uno publicado.
Un segundo registro DMARC no refuerza nada: el estándar ignora la política cuando
hay más de uno, así que añadirlo dejaría el dominio **peor** que ahora.

## Lo que ya había publicado (no se toca)

    gourses.com        MX    10 mx00.ionos.es / 10 mx01.ionos.es
    gourses.com        TXT   v=spf1 include:_spf-eu.ionos.com ~all
    _dmarc.gourses.com TXT   v=DMARC1; p=none;
    gourses.com        A     75.2.60.5  (Netlify)

El SPF de la raíz sigue siendo el de IONOS y así debe quedarse: Resend envía
desde el subdominio `send`, que lleva su propio SPF.

## Seguimiento de clics y aperturas

Desactivado, y debe seguir así: la política de privacidad promete que no usamos
analítica ni rastreadores, y el seguimiento de clics reescribiría cada enlace del
correo por uno de Resend para registrar quién pincha.

En el panel aparece como «Enable tracking metrics», y exige configurar un
subdominio de rastreo propio. No se ha configurado, así que no está activo.
**Comprobar en el primer correo real** que los enlaces apuntan a `gourses.com` y
no a un dominio de rastreo.

## Verificar el resultado

Tras añadir los registros, en Resend: «Verify DNS Records». Desde la terminal:

    node -e 'for (const [n,t] of [["resend._domainkey.gourses.com","TXT"],["send.gourses.com","MX"],["send.gourses.com","TXT"]]) fetch(`https://dns.google/resolve?name=${n}&type=${t}`).then(r=>r.json()).then(j=>console.log(n, t, (j.Answer||[]).map(a=>a.data).join(" | ")||"(no existe)"))'

El DNS puede tardar en propagarse; si no aparece al momento, no es un error.

## SMTP propio en Supabase (Auth)

Configurado en *Authentication → Emails → SMTP Settings* del proyecto `gourses`:

| Campo | Valor |
|---|---|
| Remitente | `avisos@gourses.com` |
| Nombre | `Gourses` |
| Servidor | `smtp.resend.com` |
| Puerto | `465` |
| Intervalo mínimo por usuario | `60` s |
| Usuario | `resend` |
| Contraseña | la clave de API de Resend |

**El usuario es literalmente `resend`**, no el correo ni el nombre del proyecto:
así lo exige Resend para SMTP, y la clave de API va como contraseña. El
navegador autocompletó ahí el nombre del proyecto de Supabase, que habría hecho
fallar la autenticación sin decir por qué.

Con SMTP propio, el límite de correos de Auth sube de 2 a **30 por hora**.

### Ojo mientras el dominio no esté verificado

Activar el SMTP propio antes de que Resend verifique `gourses.com` **rompe el
acceso**: Resend rechaza enviar desde un dominio sin verificar. Comprobado
llamando a `/auth/v1/otp` en producción:

    HTTP 500 {"error_code":"unexpected_failure","msg":"Error sending confirmation email"}

Se arregla solo en cuanto el dominio pase a *Verified*; no hay nada que tocar.
Si hiciera falta que el acceso funcione antes, la salida es desactivar
temporalmente «Enable custom SMTP», que devuelve el proveedor integrado de
Supabase con sus 2 correos/hora — pero al reactivarlo hay que volver a escribir
la clave, porque Supabase no la muestra una vez guardada.

### Cómo diagnosticar «No hemos podido enviar el enlace» (2026-08-20)

El dominio pasó a *Verified* y el acceso seguía fallando. La página solo dice
que no ha podido enviar el enlace, que es lo correcto de cara al visitante pero
no sirve para arreglar nada. El error de verdad está en dos sitios:

**Supabase → Logs → Auth**, filtrando por el intento:

    status 500 · path /otp · action user_confirmation_requested
    error: 535 "Authentication credentials invalid"

**Resend → Logs**: vacío. Si Resend no registra ni un intento, la petición no
llegó a salir de Supabase, así que el problema está entre los dos y no en el
dominio ni en el DNS.

`535` es SMTP rechazando usuario/contraseña. Con el usuario en `resend` (que es
lo correcto), solo puede ser la clave. Se confirma en **Resend → API keys**: la
columna *Last used* decía «No activity», o sea que esa clave no se había usado
nunca — lo guardado en Supabase no era esa clave, o se pegó incompleta.

Arreglo: volver a pegar la clave en SMTP Settings → Password. Como Resend solo
enseña la clave entera al crearla, si no está guardada hay que crear una nueva y
actualizarla **en dos sitios**, o los avisos de precio fallarán aunque el acceso
funcione:

1. Supabase → Authentication → Emails → SMTP Settings → Password.
2. GitHub → `necran/gourses` → Settings → Secrets → `RESEND_API_KEY`.

Al reintentar, contar hasta 60: *Minimum interval per user* está en 60 s, así
que dos intentos seguidos con el mismo correo fallan aunque ya esté arreglado.

## Plantillas de los correos de acceso (2026-08-24)

Con el SMTP propio ya funcionando, el correo de acceso seguía llegando en la
plantilla de fábrica de Supabase, en inglés («Follow this link to login»), en un
sitio que está entero en español. El primer correo que recibe alguien que se da
de alta era ese.

### Dónde vive ahora la plantilla

En `supabase/plantillas-correo/*.html`, no en el panel. El panel no tiene
historial ni revisión: un cambio hecho ahí no aparece en ningún diff, y no hay
forma de saber qué se está enviando de verdad. Con el fichero en el repositorio
sí, y además los tests de `src/lib/correo/plantillas-auth.test.ts` comprueban lo
que se manda antes de mandarlo.

    npm run correo:plantillas            # compara panel ↔ repositorio, no escribe
    npm run correo:plantillas -- --aplicar

Por defecto no escribe: enseña las diferencias y sale con error. Equivocarse
escribiendo en la configuración de Auth deja a todo el mundo sin poder entrar,
así que subir se pide a propósito. Necesita `SUPABASE_ACCESS_TOKEN` (token
personal de la Management API) y `SUPABASE_PROJECT_REF` en `.env.local`.

### Son dos plantillas, no una

Esto es lo que no es obvio: `signInWithOtp` **no manda siempre el mismo correo**.

| Quién escribe su correo | Plantilla de Supabase | Fichero |
|---|---|---|
| Ya tiene cuenta | *Magic Link* | `enlace-de-acceso.html` |
| Es la primera vez | *Confirm signup* | `confirmar-registro.html` |

Traducir solo la primera deja en inglés justo la mitad que reciben los que
llegan nuevos, que es la que más importa. Un test comprueba que están las dos.

### Qué se vigila en los tests

- Que no quede ningún `{{ }}` sin rellenar. Una errata como `{{ .ConfirmationUrl }}`
  no falla en Supabase: manda el correo con el enlace **vacío**, y nadie entra.
- Que el enlace aparezca también como texto copiable, no solo dentro del `href`.
- Que ningún enlace apunte a un dominio que no sea `gourses.com` — la política de
  privacidad promete que no hay rastreadores, y el seguimiento de clics de Resend
  reescribe los enlaces sin que se note.
- Que no sobreviva ninguna frase de la plantilla de fábrica.

### El Supabase del NAS sigue en inglés

El script apunta a Supabase Cloud. El del NAS usa Mailpit y sus propias
plantillas; se suben con `npm run correo:plantillas-nas` (ver abajo).

## Correo en desarrollo: Mailpit en el NAS (2026-09-10)

Este documento decía que el NAS «usa su proveedor integrado». No existe tal
cosa: un Supabase self-hosted no trae ninguno. Lo que tenía era la configuración
de ejemplo del compose —`SMTP_HOST=supabase-mail`, puerto 2500, que es el
Inbucket de la demo— apuntando a **un contenedor que nunca se levantó**. Por eso
el acceso en local fallaba siempre con:

    POST /auth/v1/otp → 500 {"error_code":"unexpected_failure","msg":"Error sending confirmation email"}

Que es indistinguible, desde la web, del fallo de credenciales de Resend de
agosto. Se separan mirando el log de Auth: aquel decía `535 Authentication
credentials invalid`; este no llegaba ni a conectar.

### Qué hay montado ahora

Un **Mailpit** en `/volume1/docker/gourses-supabase/docker-compose.override.yml`,
con el nombre de contenedor `supabase-mail` para que la configuración de GoTrue
valga tal cual. Buzón web en **http://192.168.1.139:8025** — ahí llegan los
enlaces de acceso de desarrollo.

Mailpit y no el SMTP de Resend a propósito: en desarrollo se prueba el acceso
con direcciones reales, y un SMTP de verdad las entrega de verdad. Mailpit no
sale a internet, no gasta cuota y no puede escribirle a nadie por error.

### Las tres cosas que había que tocar, y por qué

1. **`COMPOSE_FILE`** en el `.env` del NAS estaba fijado a `docker-compose.yml`,
   y eso **desactiva la carga automática** de `docker-compose.override.yml`. Sin
   añadirlo a mano, el servicio nuevo no existe (`no such service`). Ahora es
   `docker-compose.yml:docker-compose.override.yml`.
2. **`SMTP_USER` / `SMTP_PASS` vaciados.** Con las credenciales de ejemplo
   puestas, GoTrue intenta autenticarse y se niega a mandar la contraseña por un
   canal en claro: `error: "unencrypted connection"`, otra vez 500. Mailpit no
   pide autenticación, así que lo correcto es no mandarla. Si algún día se pone
   un SMTP real aquí, vuelven a hacer falta — con TLS.
3. **`ADDITIONAL_REDIRECT_URLS`** estaba vacío, así que GoTrue solo aceptaba su
   `SITE_URL` (`http://192.168.1.139:3000`) y **sobrescribía en silencio** el
   `redirect_to` que pedía la app. El enlace del correo te sacaba de local. Ahora
   incluye `http://localhost:3000/**` y `http://127.0.0.1:3000/**`.

Copia del fichero anterior en `.env.bak-antes-mailpit`, en esa misma carpeta.

### La otra mitad: `NEXT_PUBLIC_SITE_URL`

`emailRedirectTo` estaba fijado a `TITULAR.url` (`https://gourses.com`), o sea
que el enlace de acceso generado en local apuntaba a producción. Ahora sale de
`urlSitio()` (`src/lib/auth/sitio.ts`), que lee `NEXT_PUBLIC_SITE_URL`.

No se deduce de la cabecera `Host`: quien llama la controla y acabaría dentro de
un enlace enviado por correo, que es la forma de convertir el acceso en un
redirector a un sitio ajeno.

En producción se fija en `netlify.toml`, en `[build.environment]`, y no en el
panel de Netlify: no es un secreto —`NEXT_PUBLIC_` la incrusta en el bundle del
navegador— y en el panel no habría diff ni historial. Lleva el mismo valor que
la canónica, así que **no arregla ningún fallo en producción**: solo evita que
la vuelta del enlace de acceso dependa de un dato pensado para el sitemap. Y
como `NEXT_PUBLIC_` se resuelve al compilar, solo surte efecto al volver a
publicar — motivo de más para que viaje con el siguiente lote de historias en
vez de gastar un despliegue propio.

Los `TITULAR.url` de sitemap, robots y datos estructurados se quedan como están:
ahí la dirección canónica es lo que toca.

### Las plantillas en español, también en el NAS

    npm run correo:plantillas-nas

Mismo fichero de origen que en Cloud (`supabase/plantillas-correo/*.html`), otro
camino de subida, porque un Supabase self-hosted no tiene Management API.
Necesita `NAS_SSH_DESTINO` y `NAS_SUPABASE_DIR` en `.env.local`.

Dos cosas de `GOTRUE_MAILER_TEMPLATES_*` que cuestan un rato averiguar:

**Es una URL, no una ruta de fichero.** Montar los HTML en el contenedor y
apuntar a `/etc/gotrue/...` no funciona: GoTrue lo resuelve contra su `SITE_URL`
y sale a buscarlo por HTTP.

    templatemailer: template type "magic_link":
    Get "http://192.168.1.139:3000/etc/gotrue/plantillas/enlace-de-acceso.html":
    connection refused

**Y cuando no la encuentra, no falla: cae en la plantilla de fábrica en inglés.**
El correo llega, el `/otp` devuelve 200 y no hay ni un aviso de que la plantilla
propia se ha ignorado. La única forma de saberlo es mirar el correo que llega o
el log de Auth.

Por eso las sirve un contenedor `supabase-plantillas` dentro de la red de Docker.
Es un **busybox httpd**, no un nginx: los ficheros están en un volumen del NAS
con ACL extendida, y nginx baja sus procesos de trabajo al usuario `nginx`, al
que la ACL le niega la lectura aunque el fichero sea 777 — daba 403 y, otra vez,
el correo en inglés sin decir nada. `httpd` no baja privilegios.

GoTrue cachea las plantillas, así que el script reinicia `auth` al terminar.

### Una plantilla nueva no basta con copiarla (2026-09-11)

`npm run correo:plantillas-nas` copia el fichero al volumen y reinicia `auth`,
pero **eso no basta para una plantilla nueva** (no para actualizar una que ya
existía): hace falta además dar de alta su `GOTRUE_MAILER_SUBJECTS_*` y
`GOTRUE_MAILER_TEMPLATES_*` en `auth.environment`, dentro de
`docker-compose.override.yml` del NAS. El script no toca ese fichero —no sabe
qué claves de GoTrue corresponden a qué plantilla—, así que al añadir
`cambio-de-correo.html` (HU-037) el fichero se copió bien pero GoTrue lo
ignoró en silencio hasta añadir a mano:

    GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE: "Confirma el cambio de correo en Gourses"
    GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE: http://supabase-plantillas/cambio-de-correo.html

Mismo síntoma de siempre —cae en la plantilla de fábrica sin avisar—, así que se
comprueba igual: pedir el cambio y mirar qué llega a Mailpit, no solo confiar en
que el script terminó sin error.

### «No hemos podido enviar el enlace» cuando sí se ha enviado

Supabase solo admite **un correo por minuto y dirección**. Pulsar dos veces
seguidas —lo más normal del mundo cuando el correo tarda unos segundos— devolvía
`429 over_email_send_rate_limit`, y la página lo contaba como un fallo de envío
aunque el enlace estuviera ya en la bandeja de entrada. Encima empujaba a seguir
insistiendo, que es lo único que no ayuda.

Ahora el 429 responde **lo mismo** que un envío correcto («Revisa tu correo»).
Igual que no distingue si la cuenta existe: un mensaje distinto cuando el envío
es reciente delataría que alguien acaba de pedir acceso con esa dirección. La
decisión vive en `src/lib/auth/resultado-envio.ts`, fuera del server action,
porque un fichero `"use server"` solo puede exportar funciones asíncronas y ahí
dentro no habría forma de probarla.

En el NAS el mínimo está bajado a `5s` (`GOTRUE_SMTP_MAX_FREQUENCY` en el
override), que con 60 s probar el acceso es un suplicio. En producción se queda
el valor por defecto: son la defensa contra usar el formulario para inundar el
buzón de otra persona.
