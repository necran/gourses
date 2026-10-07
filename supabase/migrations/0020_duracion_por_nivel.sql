-- HU-075. Duración y valoración por nivel, para la guía «cuánto dura un curso
-- según su nivel». Mismo motivo que las vistas anteriores (0015, 0019): la web
-- lee con la clave anónima y PostgREST no agrega.
--
-- Solo Udemy: Coursera no publica nivel (comprobado, 0 de 262 cursos en
-- español lo tienen). Solo en español: es de lo que habla la guía.
create or replace view duracion_por_nivel
with (security_invoker = true) as
select level,
       count(*) as cursos,
       -- El umbral de respaldo de HU-058/HU-069: cuántos de esos cursos llevan
       -- 50 reseñas o más, para poder decir de cuántos "probados" se habla.
       count(*) filter (where num_reviews >= 50) as con_respaldo,
       percentile_cont(0.5) within group (order by (duration_min_minutes + duration_max_minutes) / 2.0)
         as duracion_mediana_minutos,
       avg(rating) as valoracion_media
  from courses
 where source = 'udemy' and language = 'es' and level is not null and duration_min_minutes is not null
 group by level;

do $$
declare
  rol text;
begin
  foreach rol in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = rol) then
      execute format('grant select on duracion_por_nivel to %I', rol);
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
