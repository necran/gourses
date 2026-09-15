-- HU-061. Buscar sin tildes: «diseno» tiene que encontrar «Diseño».
--
-- Medido el 2026-09-15: «diseno» encontraba 2 cursos y «diseño», 537.
--
-- Se añaden columnas con el título y la descripción sin tildes, generadas por
-- Postgres, y los índices de trigramas de HU-057 pasan a ellas. Idempotente.

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

-- `unaccent` no es inmutable (el diccionario podría cambiar) y una columna
-- generada exige una función inmutable. Con el diccionario fijado por nombre, lo
-- es a efectos prácticos: es el patrón habitual. Va en `extensions` y no en
-- `public` para que PostgREST no la ofrezca como llamada.
create or replace function extensions.sin_tildes(texto text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, texto)
$$;

-- Añadir una columna generada reescribe la tabla: en producción, fuera de la hora
-- de la ingesta.
alter table courses
  add column if not exists titulo_busqueda text
  generated always as (extensions.sin_tildes(title)) stored;

alter table courses
  add column if not exists descripcion_busqueda text
  generated always as (extensions.sin_tildes(description)) stored;

create index if not exists courses_titulo_busqueda_trgm_idx
  on courses using gin (titulo_busqueda extensions.gin_trgm_ops);

create index if not exists courses_descripcion_busqueda_trgm_idx
  on courses using gin (descripcion_busqueda extensions.gin_trgm_ops);

-- Los de HU-057 sobre las columnas originales ya no los usa ninguna búsqueda: se
-- quitan para que la base no crezca el doble.
drop index if exists courses_title_trgm_idx;
drop index if exists courses_description_trgm_idx;

notify pgrst, 'reload schema';
