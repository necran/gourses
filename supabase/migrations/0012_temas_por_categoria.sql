-- HU-060. Resumen de los temas (HU-058) por categoría, para decidir en una sola
-- consulta qué temas superan el umbral y de qué categoría es cada uno.
--
-- Sin esto, la portada tendría que leer los ~4.400 cursos con tema en cinco
-- peticiones (PostgREST devuelve 1.000 filas como mucho) en cada visita, solo
-- para saber qué temas enlazar. La vista agrupa en la base: devuelve como
-- mucho una fila por tema y categoría.
--
-- `security_invoker`: la vista se consulta con los permisos de quien pregunta,
-- no con los de su dueño, así que respeta la RLS de `courses`. Sin él, una
-- vista en Postgres salta la RLS de las tablas que lee.
--
-- El 50 es RESENAS_MINIMAS de src/lib/courses/temas.ts. Un test de integración
-- comprueba que la vista y la función de TypeScript cuentan lo mismo, para que
-- no se desincronicen en silencio si uno de los dos cambia.
create or replace view temas_por_categoria
with (security_invoker = true) as
select t.tema,
       c.category,
       count(*) filter (where c.language = 'es') as en_espanol,
       count(*) filter (where c.language = 'es' and c.num_reviews >= 50) as en_espanol_con_resenas
  from courses c
  cross join lateral unnest(c.temas) as t(tema)
 group by t.tema, c.category;

-- En Supabase, `anon` y `authenticated` son los roles con los que lee la web.
-- En la base de test (Postgres a secas) no existen: se concede solo si existen.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on temas_por_categoria to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on temas_por_categoria to authenticated;
  end if;
end
$$;

-- PostgREST guarda el esquema en caché: una columna nueva la vio sola, pero una
-- vista nueva no («Could not find the table … in the schema cache», visto al
-- aplicar esta migración en el NAS). Se le pide que lo recargue. Sin PostgREST
-- escuchando (la base de test), no hace nada.
notify pgrst, 'reload schema';
