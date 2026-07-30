# HU-002 — Entorno de testing (Vitest + Playwright)

## Contexto

Fase 0 (cimientos). Antes de escribir la primera línea de lógica de negocio, necesitamos que la puerta de calidad definida en `CLAUDE.md` (unitario → e2e → security-review) sea real: comandos que existen y corren, no una promesa en un documento.

## Como desarrollador quiero un pipeline de test vacío pero funcional para poder aplicar la regla de cierre de historias desde la primera funcionalidad real

## Criterios de aceptación

- **Given** el proyecto instalado **When** ejecuto el comando de test unitario **Then** Vitest corre y pasa un test trivial (smoke test).
- **Given** el proyecto con el servidor de desarrollo arrancado **When** ejecuto el comando de test e2e **Then** Playwright abre un navegador, visita `/` y comprueba que la página responde con contenido esperado.
- **Given** cualquiera de los dos comandos **When** los ejecuto sin haber tocado código **Then** ambos terminan en verde, dejando claro que el fallo futuro será una regresión real, no un problema de configuración.

## Fuera de alcance

Tests de lógica de negocio (no existe todavía ninguna). Configuración de CI remoto — de momento los tests se ejecutan en local/NAS.

## Checklist de tests (obligatorio antes de cerrar)

- [x] Unitarios: smoke test de Vitest en verde
- [ ] Integración: no aplica todavía (no hay base de datos conectada)
- [x] E2E: smoke test de Playwright visitando `/` en verde
- [ ] `/security-review`: no aplica todavía (sin lógica de negocio ni datos)

## Estado

Cerrada
