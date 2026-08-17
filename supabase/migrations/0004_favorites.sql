-- HU-019: favoritos por usuario (Fase 3 — cuentas y favoritos)
-- Idempotente: puede reaplicarse sobre una base ya migrada sin fallar ni duplicar estructuras.

create table if not exists favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- La clave primaria compuesta hace imposible guardar dos veces el mismo curso:
  -- no hace falta que el código se acuerde de comprobarlo.
  primary key (user_id, course_id)
);

-- La lista de una persona se pide siempre por user_id y ordenada por fecha.
create index if not exists favorites_user_id_created_at_idx
  on favorites (user_id, created_at desc);

-- Si se borra la cuenta, los favoritos se van con ella (on delete cascade de arriba).

-- RLS: cada quien ve y toca solo lo suyo.
--
-- Los favoritos dicen qué le interesa a una persona, así que el aislamiento no puede
-- depender de que la página se acuerde de filtrar por usuario: se hace cumplir aquí.
-- `auth.uid()` sale del JWT de la sesión, no de nada que mande el navegador en la
-- consulta, de modo que pedir explícitamente las filas de otro devuelve cero.
--
-- `anon` no recibe ninguna política, ni siquiera de lectura → denegado por defecto.

alter table favorites enable row level security;

drop policy if exists "favorites_owner_read" on favorites;
create policy "favorites_owner_read"
  on favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "favorites_owner_insert" on favorites;
create policy "favorites_owner_insert"
  on favorites for insert
  to authenticated
  -- `with check` impide guardar un favorito a nombre de otra persona.
  with check ((select auth.uid()) = user_id);

drop policy if exists "favorites_owner_delete" on favorites;
create policy "favorites_owner_delete"
  on favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- No hay política de update a propósito: una fila de favoritos no tiene nada que
-- actualizar. Se guarda o se quita.
