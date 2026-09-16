-- HU-067: el orden por defecto de la portada y el buscador.
-- Idempotente: puede reaplicarse sobre una base ya migrada sin fallar.
--
-- Un 5,00 con 11 reseñas no es mejor que un 4,7 con 12.000: es falta de datos.
-- Esta columna separa los cursos con respaldo suficiente de los demás, para que
-- el orden pueda ponerlos delante sin esconder a nadie.
--
-- 50 reseñas es el mismo umbral que ya usan las páginas de tema (HU-058,
-- RESENAS_MINIMAS). Generada y almacenada, no calculada en la consulta: así se
-- puede indexar y PostgREST puede ordenar por ella.
--
-- `coalesce` y no `num_reviews >= 50` a secas: sin reseñas el resultado sería
-- nulo, que en un orden descendente se comporta como un tercer valor y no como
-- lo que es, un «no llega al umbral». Coursera no publica reseñas: sus 4.106
-- cursos caen aquí.
alter table courses
  add column if not exists bien_valorado boolean
  generated always as (coalesce(num_reviews, 0) >= 50) stored;

-- Orden por defecto de Udemy: primero los bien valorados, luego valoración y
-- número de reseñas, y `id` para desempatar (la paginación de HU-025 depende de
-- que el orden sea total).
create index if not exists courses_orden_destacados_idx
  on courses (source, bien_valorado desc, rating desc nulls last, num_reviews desc nulls last, id);

-- Orden por defecto de Coursera, que no publica valoración: por fecha de
-- publicación. El índice de 0013 es (language, publicado_en) y no sirve para
-- este orden por fuente.
create index if not exists courses_orden_publicacion_idx
  on courses (source, publicado_en desc nulls last, id);

notify pgrst, 'reload schema';
