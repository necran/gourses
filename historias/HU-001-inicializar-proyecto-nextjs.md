# HU-001 — Inicializar el proyecto Next.js

## Contexto

Fase 0 (cimientos). Antes de poder construir cualquier funcionalidad hace falta un esqueleto de aplicación que arranque en local, con TypeScript y la estructura mínima sobre la que colgarán las páginas y rutas de API de fases posteriores.

## Como desarrollador quiero un proyecto Next.js arrancado en local para poder empezar a construir páginas y rutas de API

## Criterios de aceptación

- **Given** el repo recién clonado **When** ejecuto la instalación de dependencias **Then** no hay errores y se genera `node_modules`.
- **Given** el proyecto instalado **When** ejecuto el servidor de desarrollo **Then** la app responde en `localhost` con una página de inicio mínima.
- **Given** el proyecto **When** reviso su configuración **Then** usa TypeScript y App Router, sin dependencias de UI todavía (no se elige librería de estilos en esta historia).

## Fuera de alcance

Diseño visual, páginas de negocio (buscador, favoritos, etc.), conexión a Supabase — eso es de fases/historias posteriores.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: no aplica (no hay lógica todavía) — se documenta explícitamente por qué se omite
- [x] Integración: no aplica en esta historia
- [x] E2E: `e2e/smoke.spec.ts` visita `/` y comprueba que la página carga — en verde (definido en HU-002)
- [x] `/security-review`: no aplica todavía (sin lógica de negocio ni datos) — se retoma en historias con auth/API

## Estado

Cerrada
