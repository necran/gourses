# Checklist manual — Alta en programas de afiliados

No es una historia de usuario: son gestiones externas que solo puede hacer el titular del proyecto (tú), no generan código ni tests, y algunas tardan días en aprobarse. Conviene iniciarlas ya para no bloquear la Fase 1 más adelante.

- [x] **Udemy Affiliate Program** — alta solicitada (2026-07-31), en espera de aprobación.
- [ ] **Impact.com** (red que gestiona la afiliación de Coursera) — crear cuenta de afiliado y solicitar el programa de Coursera dentro de Impact.
- [ ] Confirmar si Impact ofrece feed de producto o solo enlaces de tracking para Coursera — condiciona si Coursera aporta catálogo automático además de comisión (ver `docs/analisis-y-estrategia.md`).
- [ ] Revisar tiempos de aprobación de cada programa y anotarlos aquí una vez conocidos, para planificar cuándo empezar de verdad la ingesta de Fase 1.

## Estado

Udemy: alta solicitada, pendiente de aprobación (bloquea HU-005). Coursera/Impact: pendiente de aclarar qué token se ha recibido — ver nota abajo antes de usarlo en HU-006.

## Nota sobre el token de Impact.com (2026-07-31)

Confirmado: es un token de **Impact.com** (red de afiliación de Coursera), para generar enlaces de tracking/comisión — no da acceso al catálogo de Coursera, que es público vía `build.coursera.org` y no necesita autenticación. Por tanto no bloquea HU-004 ni la ingesta de catálogo; solo hace falta para la parte de generación de enlaces de afiliado.

Variable correspondiente: `IMPACT_COURSERA_API_TOKEN` (añadida a `.env.example`). No se ha escrito en ningún fichero del repo — pendiente de que el usuario lo añada a `.env.local` (ver `env-local-impact-token.txt` en la raíz del proyecto).
