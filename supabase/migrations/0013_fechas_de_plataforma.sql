-- HU-059. Fechas que publican las plataformas, para «Cursos nuevos en español».
--
-- - publicado_en: `published_time` de Udemy o `startDate` de Coursera (en cursos
--   a demanda funciona como lanzamiento). No es cuándo entró en este catálogo:
--   eso refleja nuestras pasadas de ingesta, no la vida del curso.
-- - actualizado_en_plataforma: `last_update_date` de Udemy. Coursera no la da.
--
-- Las rellena la ingesta: el listado de Udemy ya trae las dos fechas, sin
-- peticiones adicionales (comprobado el 2026-09-15). Nulas hasta entonces.
alter table courses add column if not exists publicado_en timestamptz;
alter table courses add column if not exists actualizado_en_plataforma date;

-- La página de novedades filtra por idioma y ordena por fecha de publicación.
create index if not exists courses_publicado_en_idx on courses (language, publicado_en desc);

notify pgrst, 'reload schema';
