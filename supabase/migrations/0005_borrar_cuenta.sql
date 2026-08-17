-- HU-020: borrado de la propia cuenta (derecho de supresión, RGPD art. 17)
-- Idempotente: puede reaplicarse sobre una base ya migrada sin fallar.

-- Borrar de auth.users es una operación de administración. La alternativa sería
-- usar la clave de servicio desde la web, y eso está prohibido en este proyecto:
-- esa clave salta la RLS entera, así que un fallo en cualquier otra parte del
-- sitio pasaría a dar acceso a todo (ver .claude/rules/seguridad.md).
--
-- En su lugar, esta función corre con los privilegios de su dueño pero solo
-- puede borrar **a quien la llama**: el WHERE está atado a auth.uid(), que sale
-- del JWT verificado, no de ningún parámetro. No recibe argumentos justamente
-- para que no haya nada que manipular.
create or replace function public.borrar_mi_cuenta()
returns void
language sql
security definer
-- Sin esto, quien llame a la función podría anteponer un esquema propio a la
-- ruta de búsqueda y hacer que `users` apunte a una tabla suya: es la forma
-- clásica de convertir una función `security definer` en escalada de
-- privilegios. Con la ruta vacía, todo va cualificado a la fuerza.
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

-- Sin sesión, auth.uid() es null y el delete no toca ninguna fila; aun así no se
-- deja al alcance de anon, para que ni siquiera sea invocable.
revoke all on function public.borrar_mi_cuenta() from public;
revoke all on function public.borrar_mi_cuenta() from anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;

-- Los favoritos se van en cascada por la clave foránea de 0004_favorites.sql.
