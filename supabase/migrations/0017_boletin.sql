-- HU-066: boletín semanal, solo para quien se apunta.
-- Idempotente: puede reaplicarse sobre una base ya migrada sin fallar.

-- Una fila por persona que ha tocado la casilla. Sin fila, no está apuntada: al
-- revés que los avisos de precio (0006), aquí el valor por defecto es «no», porque
-- es comunicación comercial y exige consentimiento expreso.
create table if not exists boletin_suscripciones (
  user_id uuid primary key references auth.users (id) on delete cascade,
  activo boolean not null default false,
  -- Cuándo marcó la casilla por última vez: la prueba de que lo pidió.
  consentido_en timestamptz,
  -- Va en el enlace de baja de cada correo, para darse de baja sin iniciar sesión.
  -- 122 bits aleatorios: no se puede adivinar el de otra persona.
  token_baja uuid not null unique default gen_random_uuid(),
  updated_at timestamptz not null default now()
);

-- Qué semanas se ha enviado a cada quien, para no repetir si el job se relanza.
create table if not exists boletines_enviados (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Lunes de la semana del envío.
  semana date not null,
  enviado_en timestamptz not null default now(),
  primary key (user_id, semana)
);

alter table boletin_suscripciones enable row level security;
alter table boletines_enviados enable row level security;

drop policy if exists "boletin_suscripciones_owner_read" on boletin_suscripciones;
create policy "boletin_suscripciones_owner_read"
  on boletin_suscripciones for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "boletin_suscripciones_owner_insert" on boletin_suscripciones;
create policy "boletin_suscripciones_owner_insert"
  on boletin_suscripciones for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "boletin_suscripciones_owner_update" on boletin_suscripciones;
create policy "boletin_suscripciones_owner_update"
  on boletin_suscripciones for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- `boletines_enviados` sin políticas, a propósito: solo lo toca el job, que entra
-- por Postgres directo.

-- Baja desde el enlace del correo, sin sesión. Corre con los privilegios de su
-- dueño, pero lo único que puede hacer es desactivar la fila cuyo token coincide:
-- ni lee datos ni devuelve nada más que si el token existía.
create or replace function public.baja_boletin(p_token uuid)
returns boolean
language sql
security definer
-- Ruta de búsqueda vacía: mismo motivo que en `borrar_mi_cuenta` (0005).
set search_path = ''
as $$
  with baja as (
    update public.boletin_suscripciones
       set activo = false, updated_at = now()
     where token_baja = p_token
    returning 1
  )
  select exists (select 1 from baja);
$$;

revoke all on function public.baja_boletin(uuid) from public;
grant execute on function public.baja_boletin(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
