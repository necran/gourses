-- HU-058. Temas de cada curso («python», «excel», «inteligencia-artificial»…)
-- para las páginas /cursos/<tema>.
--
-- Se calculan en la ingesta a partir del título, con una función de TypeScript
-- probada con títulos reales (src/lib/courses/temas.ts), y se guardan aquí. Así la
-- web filtra con una consulta indexada en vez de evaluar expresiones regulares
-- sobre 15.000 títulos en cada visita, y la regla que decide si un curso es «de
-- Python» vive en un solo sitio.
--
-- Un array vacío es «sin tema», no «sin calcular»: la columna nace con valor por
-- defecto y el relleno de los cursos existentes lo hace
-- scripts/clasificar-temas.mjs. Idempotente.
alter table courses add column if not exists temas text[] not null default '{}';

create index if not exists courses_temas_idx on courses using gin (temas);
