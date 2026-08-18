# Correo saliente (Resend) — HU-021

Los avisos de bajada de precio se envían con Resend. Este documento recoge la
configuración y **por qué** es la que es, porque varias decisiones no son obvias
y equivocarlas rompe el correo del dominio.

## Estado

| Pieza | Estado |
|---|---|
| Dominio en Resend | `gourses.com`, región Irlanda (eu-west-1) |
| Registros DNS en IONOS | **añadidos y propagados** (2026-08-18) |
| `RESEND_API_KEY` en GitHub | pendiente |
| SMTP propio en Supabase | pendiente |

Mientras falte la clave, el paso de avisos del workflow se salta solo y la web
sigue usando el correo integrado de Supabase, limitado a **2 mensajes por hora en
todo el proyecto**.

El dominio queda en «Pending» hasta que los resolutores de Resend vean los
registros. Los tres están publicados y comprobados contra el DNS público, y el
DKIM coincide carácter por carácter (218) con el que Resend espera, así que no
hay nada más que hacer: es esperar. Resend avisa de que puede tardar horas.

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
