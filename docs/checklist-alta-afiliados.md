# Checklist manual — Alta en programas de afiliados

No es una historia de usuario: son gestiones externas que solo puede hacer el titular del proyecto (tú), no generan código ni tests, y algunas tardan días en aprobarse. Conviene iniciarlas ya para no bloquear la Fase 1 más adelante.

- [ ] **Udemy Affiliate Program** — solicitar alta. Al aprobarse, guardar la clave de API en el gestor de contraseñas (irá en `UDEMY_AFFILIATE_API_KEY` de `.env.local`, nunca en el repo).
- [ ] **Impact.com** (red que gestiona la afiliación de Coursera) — crear cuenta de afiliado y solicitar el programa de Coursera dentro de Impact.
- [ ] Confirmar si Impact ofrece feed de producto o solo enlaces de tracking para Coursera — condiciona si Coursera aporta catálogo automático además de comisión (ver `docs/analisis-y-estrategia.md`).
- [ ] Revisar tiempos de aprobación de cada programa y anotarlos aquí una vez conocidos, para planificar cuándo empezar de verdad la ingesta de Fase 1.

## Estado

Pendiente de que el usuario las inicie. Avisar a Claude Code cuando las claves estén disponibles para incorporarlas a HU-004 (ingesta de catálogo) en Fase 1.
