-- HU-011: duración normalizada a minutos.
-- Se guarda como rango porque las plataformas la expresan así a menudo
-- ("2-4 hours a week" durante 4 semanas son 8–16 h), y reducirlo a un punto
-- medio afirmaría una cifra que nadie ha publicado. Cuando es exacta, mínimo y
-- máximo coinciden. Nullable: lo que no se entiende con seguridad queda vacío.
alter table courses add column if not exists duration_min_minutes integer;
alter table courses add column if not exists duration_max_minutes integer;

-- El filtro/orden por duración llegará en una historia posterior.
create index if not exists courses_duration_min_idx on courses (duration_min_minutes);
