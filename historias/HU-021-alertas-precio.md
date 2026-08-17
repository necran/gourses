# HU-021 — Avisos de bajada de precio

## Contexto

Fase 4 del roadmap (`docs/analisis-y-estrategia.md`). Es la razón de ser de todo lo
anterior: el catálogo (Fase 1) da los precios, el histórico diario da la referencia con
la que compararlos, y los favoritos (HU-019) dicen qué cursos le importan a cada
persona. Aquí se juntan las tres cosas.

La pieza que faltaba es el envío de correo. Se deja **enchufada pero apagada**: el job
detecta y compone los avisos aunque no haya clave de Resend, y en ese caso los registra
en el log en vez de enviarlos. Así la lógica se puede probar entera hoy, y encender el
envío mañana es poner una variable de entorno, no escribir código.

## Como persona con cursos guardados quiero que me avisen cuando bajen de precio para comprarlos en el mejor momento sin tener que mirar todos los días

## Criterios de aceptación

- **Given** un curso que tengo en favoritos **When** su precio baja respecto al último
  conocido **Then** recibo un aviso con el precio anterior y el nuevo

- **Given** que ya me avisaron de una bajada **When** el job vuelve a ejecutarse y el
  precio no ha cambiado **Then** no me vuelven a avisar de lo mismo

- **Given** que ya me avisaron a un precio **When** el precio baja **todavía más**
  **Then** me avisan otra vez, porque es una novedad

- **Given** un curso que subió de precio, o que no ha cambiado **When** se ejecuta el
  job **Then** no se envía ningún aviso

- **Given** un curso que no tengo en favoritos **When** baja de precio **Then** no
  recibo nada

- **Given** que no quiero estos avisos **When** los desactivo en mi cuenta **Then**
  dejo de recibirlos, aunque siga teniendo favoritos

- **Given** que no hay clave de Resend configurada **When** se ejecuta el job
  **Then** detecta las bajadas y las registra, sin fallar y sin enviar nada

## Fuera de alcance

- Avisos de subida de precio, o de que un curso desaparece del catálogo.
- Elegir un precio objetivo («avísame si baja de 15 €»). Primero que funcione lo
  simple.
- Resumen periódico agrupando varias bajadas: un correo por bajada, que es lo que se
  entiende sin explicación.
- Avisos por cualquier vía que no sea el correo.
- Los cursos de Coursera no tienen precio en el catálogo, así que quedan fuera por
  construcción, no por decisión.

## Cuidados

- **No se manda correo sin poder dejar de recibirlo.** Hay un interruptor en la cuenta,
  y quitar el favorito también corta el aviso. Ambos caminos deben funcionar.
- **Nunca dos veces el mismo aviso.** Se guarda a qué precio se avisó por última vez;
  solo se vuelve a avisar si el precio baja por debajo de ese. Sin esto, cada ejecución
  diaria repetiría el mismo correo eternamente.
- Una bajada ridícula (céntimos, o un vaivén de cambio de divisa) no es noticia: hay un
  umbral mínimo para no convertir el aviso en ruido.
- Solo se comparan precios en la **misma divisa**. Comparar 20 USD con 19 EUR y cantar
  una bajada sería inventarse una.
- El job corre fuera de la web, con conexión directa a Postgres, como el de ingesta. Sus
  credenciales viven solo en el entorno del job (ver `.claude/rules/seguridad.md`).
- El correo de cada persona es un dato personal: aparece en el destinatario y en ningún
  sitio más. Nada de listas ni de copias ocultas con varios destinatarios.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: la decisión de avisar — bajada, subida, sin cambio, repetida, bajada
      mayor, divisas distintas, umbral mínimo (13 casos)
- [x] Unitarios: el texto del aviso incluye ambos precios y el enlace al curso
- [x] Unitarios: el envío — un solo destinatario, la clave solo en la cabecera, el
      error sin PII, y el registrador sin direcciones
- [x] Integración: el job recorre favoritos reales y solo avisa de lo que toca
- [x] Integración: sin clave de Resend el job termina bien y no envía
- [x] E2E: el interruptor de la cuenta desactiva los avisos
- [x] `/security-review` sin hallazgos críticos ni altos

## Estado

**Cerrada.**

- Unitarios: 235 pasan.
- Integración: 58 pasan.
- E2E: 59 pasan.
- Revisión de seguridad: dos hallazgos, ambos corregidos (abajo).

Comprobado además a mano, contra la base real: sembrada una bajada de 59,99 a 19,99 €
en un curso guardado, el job la detecta y compone el aviso; a la segunda ejecución
descarta con `ya-avisado=1` y no envía nada.

## El envío queda preparado, no a medias

Sin `RESEND_API_KEY` el job corre entero —consulta, decide, compone— y cuenta los
avisos que saldrían sin enviarlos. Encenderlo es crear el secreto en el repositorio,
sin tocar código. El paso ya está en el workflow, después de la ingesta.

Falta por hacer, y es tarea de fuera del repo: dar de alta Resend, verificar
`gourses.com` como dominio remitente y crear los secretos `RESEND_API_KEY` y
`RESEND_FROM`.

## Lo que encontró la revisión de seguridad

Dos hallazgos, los dos corregidos antes de cerrar. Uno era **alto**, y por tanto
bloqueaba:

**1. Direcciones de correo en los logs de GitHub Actions (alto).** El enviador de
respaldo registraba a quién iba cada aviso. Como el paso ya estaba en el workflow
—apuntando a la base de producción— y el secreto de Resend aún no existe, cada
ejecución nocturna habría escrito el correo de personas reales y qué curso tienen
guardado. **El repositorio es público**, así que esos logs los lee cualquiera: se
filtraría por la puerta de atrás justo lo que la RLS protege en la base de datos.

Arreglado por partida doble: el registrador ya no escribe ninguna dirección (con el
asunto basta para comprobar que el job funciona, y el asunto no dice a quién iba), y
además el script falla en CI si no hay clave, en vez de degradarse en silencio contra
producción.

**2. La divisa sin escapar en el HTML del correo (medio).** El título y la plataforma
sí se escapaban, pero la divisa no — y sale del campo `currency` de la plataforma, que
la ingesta guarda sin exigirle forma alguna. Que casi siempre sea `EUR` no la hace
segura: un valor con `<a href="…">` habría metido un enlace ajeno dentro de un correo
firmado con nuestro dominio, que es peor que el mismo enlace en spam corriente.

Los dos tienen test, y se comprobó que **fallan con el código anterior**.

## Deuda que sigue abierta

- Un precio objetivo por curso («avísame si baja de 15 €»).
- Agrupar varias bajadas del mismo día en un solo correo, si llega a molestar.
- Los cursos de Coursera no tienen precio, así que nunca generan avisos.
