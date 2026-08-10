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
  - Los tests de integración comparten la misma base (`gourses_test`) y limpian tablas entre casos, así que **se ejecutan sin paralelismo entre ficheros** (`--no-file-parallelism` en `npm run test:integration`). Si se paralelizan, un fichero borra las tablas mientras otro trabaja y los fallos aparecen de forma intermitente.
  - **Excepción documentada (HU-007):** las rutas de la web leen vía Supabase JS + anon key (PostgREST), y el NAS solo tiene una instancia de Supabase/PostgREST sirviendo la base de dev — no hay una segunda instancia apuntando a `gourses_test`. Los tests de integración de esas rutas siembran filas marcadas (p. ej. `source_id` con prefijo `test-`) en dev vía `DATABASE_URL`, consultan por el mismo camino que produción (supabase-js/anon, RLS real) y las borran al terminar (`finally`). Válida solo mientras no exista una segunda instancia de Supabase para test; si se levanta, esta excepción desaparece.
- E2E (Playwright vía MCP): un test por cada criterio de aceptación de la historia de usuario, no más ni menos. Si un criterio de aceptación no tiene test e2e, la historia no está completa.
- Antes de dar una historia por cerrada, ejecutar la suite completa, no solo los tests nuevos — para detectar regresiones.
