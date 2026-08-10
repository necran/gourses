-- HU-010: categoría común a todas las fuentes.
-- El valor pertenece al vocabulario definido en src/lib/courses/categories.ts,
-- no a la taxonomía original de cada plataforma (ver historias/HU-010).
-- Nullable a propósito: una etiqueta desconocida se guarda como null en vez de
-- inventar una categoría.
alter table courses add column if not exists category text;

-- El buscador filtrará por categoría (HU-011).
create index if not exists courses_category_idx on courses (category);
