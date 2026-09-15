-- HU-063. Cifras por plataforma para la guía «Udemy o Coursera».
--
-- La web lee con la clave anónima por PostgREST, que no agrega: la vista hace
-- los recuentos y medianas en la base y devuelve una fila por plataforma.
-- `security_invoker` para que respete la RLS de `courses` (ver 0012).
--
-- Dos pasos: primero el precio más repetido en euros de cada plataforma, y
-- después el resto de cifras junto con cuántos cursos tienen ese precio. Así la
-- tabla se recorre dos veces en total, no una vez por cada curso.
create or replace view resumen_plataformas
with (security_invoker = true) as
with moda as (
  select source,
         mode() within group (order by price_amount)
           filter (where price_currency = 'EUR') as precio_habitual_eur
    from courses
   group by source
)
select c.source,
       count(*) as cursos,
       count(*) filter (where c.language = 'es') as en_espanol,
       count(distinct c.language) as idiomas,
       count(*) filter (where c.price_amount is not null) as con_precio,
       -- Precio solo en euros: mezclar monedas no significaría nada.
       count(*) filter (where c.price_currency = 'EUR') as con_precio_eur,
       min(c.price_amount) filter (where c.price_currency = 'EUR') as precio_minimo_eur,
       max(c.price_amount) filter (where c.price_currency = 'EUR') as precio_maximo_eur,
       m.precio_habitual_eur,
       count(*) filter (where c.price_currency = 'EUR' and c.price_amount = m.precio_habitual_eur)
         as cursos_con_precio_habitual,
       count(*) filter (where c.rating is not null) as con_valoracion,
       avg(c.rating) filter (where c.rating is not null) as valoracion_media,
       count(*) filter (where c.duration_min_minutes is not null) as con_duracion,
       percentile_cont(0.5) within group (order by (c.duration_min_minutes + c.duration_max_minutes) / 2.0)
         filter (where c.duration_min_minutes is not null) as duracion_mediana_minutos,
       count(*) filter (where c.num_reviews is not null) as con_resenas,
       count(*) filter (where c.level is not null) as con_nivel
  from courses c
  join moda m on m.source = c.source
 group by c.source, m.precio_habitual_eur;

-- Dónde tiene más cursos cada plataforma, para enlazar desde la guía a esas
-- categorías y temas. Como mucho once filas por plataforma (categorías) y una
-- por tema.
create or replace view categorias_por_plataforma
with (security_invoker = true) as
select source,
       category,
       count(*) as cursos,
       count(*) filter (where language = 'es') as en_espanol
  from courses
 where category is not null
 group by source, category;

create or replace view temas_por_plataforma
with (security_invoker = true) as
select c.source,
       t.tema,
       count(*) filter (where c.language = 'es') as en_espanol
  from courses c
  cross join lateral unnest(c.temas) as t(tema)
 group by c.source, t.tema;

-- Como en 0012: en la base de test no existen los roles de Supabase.
do $$
declare
  vista text;
  rol text;
begin
  foreach vista in array array['resumen_plataformas', 'categorias_por_plataforma', 'temas_por_plataforma'] loop
    foreach rol in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = rol) then
        execute format('grant select on %I to %I', vista, rol);
      end if;
    end loop;
  end loop;
end
$$;

notify pgrst, 'reload schema';
