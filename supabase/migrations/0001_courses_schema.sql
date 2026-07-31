-- HU-004: esquema común de cursos (Fase 1 — catálogo y búsqueda)
-- Idempotente: puede reaplicarse sobre una base ya migrada sin fallar ni duplicar estructuras.

create extension if not exists pgcrypto;

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('udemy', 'coursera')),
  source_id text not null,
  title text not null,
  description text,
  price_amount numeric(10, 2),
  price_currency text,
  rating numeric(3, 2),
  level text,
  language text,
  instructor text,
  affiliate_url text,
  image_url text,
  updated_at timestamptz not null default now()
);

create unique index if not exists courses_source_source_id_key
  on courses (source, source_id);

create table if not exists course_price_history (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  price_amount numeric(10, 2),
  price_currency text,
  captured_at timestamptz not null default now()
);

create index if not exists course_price_history_course_id_idx
  on course_price_history (course_id);

-- RLS: lectura pública, escritura solo desde el rol de servicio (jobs de ingesta).
-- El rol service_role de Supabase tiene BYPASSRLS y no necesita política propia;
-- anon/authenticated solo obtienen la política de lectura de abajo, sin políticas
-- de insert/update/delete → denegado por defecto.

alter table courses enable row level security;
alter table course_price_history enable row level security;

drop policy if exists "courses_public_read" on courses;
create policy "courses_public_read"
  on courses for select
  to anon, authenticated
  using (true);

drop policy if exists "course_price_history_public_read" on course_price_history;
create policy "course_price_history_public_read"
  on course_price_history for select
  to anon, authenticated
  using (true);
