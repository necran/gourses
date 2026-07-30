---
paths:
  - "**/ingesta/**"
  - "**/jobs/**"
  - "**/sources/**"
---

# Reglas de ingesta de catálogo

- Solo se conectan fuentes con endpoint de catálogo oficial y consultable (ver regla de admisión en `CLAUDE.md` y `docs/analisis-y-estrategia.md`). Nunca scraping, ni siquiera "temporal" o "solo para probar".
- Cada fuente tiene su propio adaptador que normaliza sus datos a un esquema común (precio, duración, nivel, instructor, URL de afiliado) antes de guardarlos — la web y el comparador nunca conocen las diferencias entre fuentes.
- Los jobs de ingesta escriben en la base de datos propia; ninguna ruta de la web llama en caliente a una API externa de curso.
- Respetar límites de cuota de cada API (rate limits, backoff). Si una fuente está en beta (ej. Coursera Catalog API), el adaptador debe fallar de forma controlada y registrar el error, no romper el resto de la ingesta.
