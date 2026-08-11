# HU-013 — Páginas legales y transparencia de afiliación

## Contexto

Fase 6, previo a publicar. Tres motivos, en orden de peso:

1. **Obligación legal.** Un sitio con ánimo de lucro dirigido a España debe identificar a su titular (LSSI-CE, art. 10) e informar del tratamiento de datos personales (RGPD). Además, la divulgación de que se usan enlaces de afiliado es exigible tanto en la UE como en EE. UU. (FTC).
2. **Requisito práctico.** Las redes de afiliación revisan el sitio antes de aprobar la solicitud, y la ausencia de estas páginas es un motivo habitual de rechazo (ver `HU-009`).
3. **Honestidad con el visitante.** El modelo de negocio es cobrar comisión por los enlaces; decirlo claro es lo mínimo.

Auditoría de lo que la web trata **hoy** (2026-08-10), para no publicar una política copiada que describa cosas que no hacemos:

- Sin cookies propias, sin analítica, sin rastreadores, sin cuentas de usuario.
- Los formularios son búsquedas por GET; no recogen datos personales.
- **Sí hay una cesión real a terceros**: las imágenes de los cursos se cargan directamente desde los servidores de Udemy y Coursera, así que el navegador del visitante les comunica su IP y su user-agent.
- El proveedor de alojamiento registra las peticiones, con IP incluida.

## Como visitante quiero saber quién está detrás de esta web, qué hace con mis datos y cómo gana dinero para decidir si me fío de sus recomendaciones

## Criterios de aceptación

- **Given** cualquier página del sitio **When** la visito **Then** encuentro enlaces accesibles al aviso legal, la política de privacidad y la información sobre afiliación.
- **Given** la política de privacidad **When** la leo **Then** describe únicamente lo que la web hace de verdad, incluida la carga de imágenes desde servidores de terceros, sin declarar cookies ni analítica que no existen.
- **Given** la página de afiliación **When** la leo **Then** explica que el sitio puede cobrar comisión por los enlaces, que eso no encarece el precio y que no condiciona el orden de los resultados.
- **Given** el aviso legal **When** lo leo **Then** identifica al titular del sitio y ofrece una vía de contacto.
- **Given** una ficha de curso **When** la veo **Then** hay una indicación visible de que el enlace de salida puede ser de afiliado, sin necesidad de ir a buscar la página legal.

## Fuera de alcance

- **Banner de cookies**: hoy no se usan cookies propias ni de terceros que lo exijan. Si en el futuro se añade analítica o el tracking de afiliación pone cookies, hará falta y se tratará entonces.
- Política de devoluciones o condiciones de compra: no se vende nada desde aquí; la compra ocurre en la plataforma de origen.
- Traducción a otros idiomas.
- Revisión por un profesional del derecho: **estos textos son un borrador razonado, no asesoramiento legal**, y conviene que los revise alguien cualificado antes de operar con ingresos.

## Checklist de tests (obligatorio antes de cerrar)

- [x] E2E: las tres páginas cargan y son alcanzables desde la portada y desde el buscador (`e2e/legales.spec.ts`)
- [x] E2E: la ficha de curso muestra la advertencia de enlace de afiliado junto al botón de salida
- [x] E2E: la privacidad menciona la carga de imágenes desde terceros y declara explícitamente que no hay cookies ni analítica
- [x] `/security-review`: sin hallazgos — páginas de contenido sin entrada de usuario, y se verificó que ninguna credencial de servidor llega al bundle del cliente

## Notas de implementación

- **La política de privacidad se escribió desde una auditoría del código, no desde una plantilla.** Por eso declara algo que la mayoría omite: las imágenes de los cursos se cargan desde los servidores de Udemy y Coursera, así que el navegador del visitante les comunica su IP sin haber salido de la web. Y por eso *no* declara cookies ni analítica: hoy no existen, y decir lo contrario sería tan falso como no informar.
- **La divulgación de afiliación va junto al botón de salida**, en la propia ficha, no escondida en una página legal. Es donde la persona decide si pulsa.
- Los datos del titular viven en un único sitio (`src/lib/legal/titular.ts`). Mientras `nombre` y `nif` estén vacíos, el aviso legal lo advierte de forma visible en lugar de publicar datos inventados, y así el sitio puede funcionar sin fingir que está completo.
- El pie va en el layout raíz para que las tres páginas sean alcanzables desde cualquier parte, que es lo que exige el criterio.

## Pendiente

- ~~Nombre y NIF del titular~~ — completados el 2026-08-11. Se verificó además que el dígito de control del NIF es correcto.
- **Crear el buzón `hola@gourses.com`** en IONOS (el plan incluye dos cuentas). Ya figura como contacto en las tres páginas.
- **Revisión por un profesional del derecho** antes de operar con ingresos: estos textos son un borrador razonado, no asesoramiento legal.

## Estado

Cerrada.
