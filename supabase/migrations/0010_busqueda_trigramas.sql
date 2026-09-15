-- HU-057. Índices de trigramas para la búsqueda por palabra clave.
--
-- La búsqueda filtra con `title ILIKE '%…%' OR description ILIKE '%…%'`, y un
-- ILIKE con comodín delante no puede usar un índice normal: cada búsqueda
-- recorría la tabla entera. Medido el 2026-09-15 con 15.395 cursos (descripción
-- media de 2.354 caracteres): ~0,7 s por consulta, y una búsqueda hace varias
-- (resultados y recuento). El rol `anon`, con el que lee la web, tiene
-- `statement_timeout = 3s`: bajo carga, la consulta se cancelaba y la persona
-- veía un error.
--
-- `pg_trgm` permite indexar ese mismo ILIKE sin cambiar la consulta ni sus
-- resultados: la búsqueda encuentra exactamente lo mismo, solo que sin leer
-- todas las descripciones.
--
-- En Supabase las extensiones van en el esquema `extensions`. Se crea si no
-- existe para que la migración valga también en la base de test, que es un
-- Postgres sin él. Idempotente.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create index if not exists courses_title_trgm_idx
  on courses using gin (title extensions.gin_trgm_ops);

create index if not exists courses_description_trgm_idx
  on courses using gin (description extensions.gin_trgm_ops);
