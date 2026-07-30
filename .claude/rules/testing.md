---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "tests/**"
  - "e2e/**"
---

# Reglas de testing

- Ningún test se ajusta para que pase artificialmente (mocks que ocultan el bug real, `skip`/`todo` para esconder un fallo). Si un test falla, se arregla el código o se corrige el test porque estaba mal planteado — nunca se silencia.
- Unitarios (Vitest): lógica pura y aislada — normalización de precios entre fuentes, cálculo de descuentos, reglas de alertas. Sin llamadas de red reales.
- Integración: contra una base de datos de test (Supabase local en Docker), nunca contra la base de datos de desarrollo ni producción.
- E2E (Playwright vía MCP): un test por cada criterio de aceptación de la historia de usuario, no más ni menos. Si un criterio de aceptación no tiene test e2e, la historia no está completa.
- Antes de dar una historia por cerrada, ejecutar la suite completa, no solo los tests nuevos — para detectar regresiones.
