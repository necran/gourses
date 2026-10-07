-- HU-076. Demanda real por categoría (alumnos inscritos), para la guía que
-- compara el número de cursos con el número de alumnos. Mismo motivo que las
-- vistas anteriores: la web lee con la clave anónima y PostgREST no agrega.
--
-- Solo Udemy: Coursera no publica alumnos inscritos (comprobado, 0 de 262
-- cursos en español lo tienen).
create or replace view demanda_por_categoria
with (security_invoker = true) as
select category,
       count(*) as cursos,
       percentile_cont(0.5) within group (order by num_subscribers) as alumnos_mediana,
       avg(num_subscribers) as alumnos_media
  from courses
 where source = 'udemy' and language = 'es' and category is not null and num_subscribers is not null
 group by category;

do $$
declare
  rol text;
begin
  foreach rol in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = rol) then
      execute format('grant select on demanda_por_categoria to %I', rol);
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
