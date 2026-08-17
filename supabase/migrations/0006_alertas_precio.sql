-- HU-021: avisos de bajada de precio (Fase 4)
-- Idempotente: puede reaplicarse sobre una base ya migrada sin fallar ni duplicar estructuras.

-- Preferencia por persona. Existe para que se pueda dejar de recibir correo sin
-- tener que borrar los favoritos: son dos cosas distintas y se piden por separado.
--
-- Fila por defecto implícita: si no hay fila, se considera que los avisos están
-- activados. Así no hace falta sembrar nada al crear la cuenta, y quien nunca ha
-- tocado el interruptor recibe los avisos que espera al guardar un favorito.
create table if not exists alert_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  price_alerts_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Qué se ha avisado ya, para no repetir el mismo correo cada día.
--
-- Se guarda el precio al que se avisó, no solo que se avisó: así una bajada
-- posterior —que sí es noticia— vuelve a disparar el aviso, mientras que el
-- mismo precio, día tras día, no.
create table if not exists price_alerts_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  price_amount numeric(10, 2) not null,
  price_currency text,
  sent_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- RLS: estas dos tablas son territorio del job, que entra por Postgres directo y
-- no pasa por PostgREST. La preferencia sí la toca la web, con la sesión de cada
-- quien; el registro de avisos no lo toca nadie desde el navegador.

alter table alert_preferences enable row level security;
alter table price_alerts_sent enable row level security;

drop policy if exists "alert_preferences_owner_read" on alert_preferences;
create policy "alert_preferences_owner_read"
  on alert_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "alert_preferences_owner_insert" on alert_preferences;
create policy "alert_preferences_owner_insert"
  on alert_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Aquí sí hace falta update: el interruptor se cambia de sí a no y vuelta.
-- `using` decide qué filas se pueden tocar y `with check` cómo pueden quedar;
-- sin la segunda se podría cambiar la fila para que fuese de otra persona.
drop policy if exists "alert_preferences_owner_update" on alert_preferences;
create policy "alert_preferences_owner_update"
  on alert_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- `price_alerts_sent` se queda sin ninguna política a propósito: nadie tiene por
-- qué leer ni escribir desde el navegador a qué precio se le avisó. El job entra
-- por otra puerta y no le afecta.
