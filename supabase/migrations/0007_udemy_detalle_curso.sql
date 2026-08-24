-- HU-029: campos reales de detalle de Udemy (descripción, lo que aprenderás,
-- requisitos, número de reseñas y de alumnos). Antes solo se guardaba el
-- titular de una línea del listado, etiquetado como si fuera la descripción.
-- Idempotente: puede reaplicarse sobre una base ya migrada sin fallar ni duplicar estructuras.

alter table courses add column if not exists num_reviews integer;
alter table courses add column if not exists num_subscribers integer;
alter table courses add column if not exists what_you_will_learn text[];
alter table courses add column if not exists requirements text[];
