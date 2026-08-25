-- HU-030: resumen generado con IA, apoyado en la descripción real del curso.
-- Idempotente: puede reaplicarse sobre una base ya migrada sin fallar ni duplicar estructuras.

alter table courses add column if not exists resumen_ia text;
-- Cuándo se generó, para saber si hace falta rehacerlo: si la descripción ha
-- cambiado desde entonces (updated_at más reciente), el resumen está desfasado.
alter table courses add column if not exists resumen_ia_generado_en timestamptz;
