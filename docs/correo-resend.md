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
| Plantillas de los correos de acceso | en el repositorio, pendientes de subir al panel |

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

El script apunta a Supabase Cloud. El del NAS usa su proveedor integrado y solo
lo ve quien desarrolla, así que no se toca.
