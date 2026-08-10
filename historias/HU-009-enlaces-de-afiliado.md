# HU-009 — Enlaces de afiliado reales

## Contexto

Transversal a la Fase 1, ya cerrada. Hoy `affiliate_url` guarda la **URL directa** del curso en ambas fuentes (decisión consciente y documentada en `HU-006` y `HU-005` a falta de confirmar el formato de tracking), así que la web enseña cursos y manda tráfico a las plataformas **sin generar ninguna comisión**. Esta historia convierte ese enlace en uno de afiliado real.

Hallazgo que condiciona el diseño: el programa de afiliados de **Udemy también se gestiona vía Impact.com**, la misma red que Coursera, así que **una única integración cubre las dos fuentes** cambiando solo el identificador de programa. Por eso las variables de entorno se llaman `IMPACT_*`, sin apellido de plataforma.\n\nOjo: que ambos programas *existan* en Impact no significa que estén aprobados para esta cuenta. A 2026-08-10 no hay ninguna asociación aprobada (ver Estado).

## Como titular del proyecto quiero que los enlaces a los cursos lleven mi identificador de afiliado para cobrar la comisión cuando alguien compre desde la web

## Criterios de aceptación

- **Given** un curso ingerido de una fuente con programa de afiliados configurado **When** termina la ingesta **Then** su `affiliate_url` es un enlace de tracking de la red de afiliación, no la URL directa del curso.
- **Given** la ficha de un curso con enlace de afiliado **When** pulso el botón principal **Then** el destino es ese enlace de tracking, que redirige al curso en la plataforma de origen.
- **Given** una fuente sin programa de afiliados configurado (o cuyas credenciales faltan) **When** se ingiere **Then** `affiliate_url` mantiene la URL directa del curso y la ingesta no falla — se prefiere un enlace sin comisión a no tener enlace.
- **Given** que la generación del enlace de tracking falla para un curso concreto **When** ocurre durante la ingesta **Then** ese curso se guarda con la URL directa y el fallo queda registrado, sin detener el resto del catálogo.
- **Given** un curso ya ingerido con URL directa **When** vuelvo a ejecutar la ingesta con la afiliación ya configurada **Then** su `affiliate_url` pasa a ser el enlace de tracking.

## Fuera de alcance

- Informes de comisiones, conversiones o ingresos: esta historia solo genera el enlace.
- Alta o aprobación en las redes de afiliación (gestión manual, ver `docs/checklist-alta-afiliados.md`).
- Rakuten como red alternativa para Udemy: solo se integra la red que esté realmente aprobada.
- Reescribir enlaces en caliente desde la web: el enlace se calcula en la ingesta y se guarda, como el resto de datos del curso.

## Checklist de tests (obligatorio antes de cerrar)

- [ ] Unitarios: construcción del enlace de tracking a partir de la URL del curso, incluyendo el caso de fuente sin afiliación configurada (devuelve la URL directa)
- [ ] Unitarios: un fallo al generar el enlace no rompe la normalización del curso
- [ ] Integración: ingesta con afiliación configurada que deja `affiliate_url` como enlace de tracking en la BD de test
- [ ] E2E: la ficha de un curso enlaza al dominio de tracking y no a la URL directa
- [ ] `/security-review`: las credenciales de la red de afiliación solo se usan en el job (server-side) y nunca llegan al cliente; el enlace generado se valida antes de guardarse

## Notas de investigación (2026-08-10)

- La API de Impact requiere **Basic Auth con `AccountSID` como usuario y el token como contraseña**. Con ambos autentica; sin el SID devuelve `401`.
- Endpoint de creación: `POST https://api.impact.com/Mediapartners/{AccountSID}/Programs/{ProgramId}/TrackingLinks`, con `DeepLink` (la URL del curso) y `MediaPartnerPropertyId` (la propiedad/web dada de alta).
- Aviso relevante para el diseño: Impact **limita a 5000 los tracking links** por programa y devuelve `403` al superarlo. Con 412 cursos hoy y crecimiento previsto, conviene comprobar si el formato de deeplink admite construcción directa por URL (sin crear un link por curso) antes de generar uno por curso.

## Estado

Aparcada hasta la **Fase 6** (despliegue). No por falta de trabajo de código, sino porque es prematura.

Diagnóstico cerrado el 2026-08-10: la cuenta de Impact existe, las credenciales autentican y **los permisos del token están correctos** (Campaigns, Media Properties y Tracking Links activados). Pero la cuenta está vacía: `MediaProperties` y `Campaigns` devuelven `total: 0`.

Faltan, en este orden y todo fuera de nuestro control:

1. Dar de alta la web como *media property* — además, su id es parámetro obligatorio para crear enlaces de tracking.
2. Solicitar los programas y que la plataforma los apruebe.

Y el motivo de fondo para aparcarla: **las redes de afiliación aprueban en función de un sitio publicado**. Mientras el proyecto corra en local, una solicitud apuntando a `localhost` se rechaza. Por eso el orden correcto es Fase 6 → alta de propiedad → solicitud → esta historia.

Mientras tanto, `affiliate_url` sigue guardando la URL directa del curso, que funciona para el usuario aunque no genere comisión.
