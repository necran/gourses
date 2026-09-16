-- HU-069. Precios y duración por categoría, en español, para la guía «cuánto
-- cuesta un curso». Mismo motivo que 0015: la web lee con la clave anónima y
-- PostgREST no agrega, así que los recuentos y las medianas se hacen aquí.
--
-- `security_invoker` para que respete la RLS de `courses`, como el resto de
-- vistas del proyecto.
--
-- Solo cursos en español: es de lo que habla la guía. Una categoría con pocos
-- cursos sale igualmente, con su recuento, y es la web la que decide que por
-- debajo del umbral no se dan cifras (idiomas tiene 4 cursos: de ahí no sale una
-- «duración típica»).
create or replace view precios_por_categoria
with (security_invoker = true) as
select category,
       count(*) as cursos,
       -- Precio solo en euros: mezclar monedas no significaría nada (como en 0015).
       count(*) filter (where price_currency = 'EUR') as con_precio,
       mode() within group (order by price_amount)
         filter (where price_currency = 'EUR') as precio_habitual_eur,
       min(price_amount) filter (where price_currency = 'EUR') as precio_minimo_eur,
       max(price_amount) filter (where price_currency = 'EUR') as precio_maximo_eur,
       count(*) filter (where duration_min_minutes is not null) as con_duracion,
       percentile_cont(0.5) within group (order by (duration_min_minutes + duration_max_minutes) / 2.0)
         filter (where duration_min_minutes is not null) as duracion_mediana_minutos,
       -- Cuántos llevan respaldo de reseñas (el umbral de HU-058), para poder
       -- decir de cuántos cursos «probados» se está hablando.
       count(*) filter (where num_reviews >= 50) as con_respaldo
  from courses
 where language = 'es' and category is not null
 group by category;

do $$
declare
  rol text;
begin
  foreach rol in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = rol) then
      execute format('grant select on precios_por_categoria to %I', rol);
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
