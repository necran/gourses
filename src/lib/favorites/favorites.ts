import type { SupabaseClient } from "@supabase/supabase-js";
import { getCoursesByIds, isValidCourseId, type CourseDetail } from "../courses/get-course";

// Un favorito se muestra igual que un curso en la lista de resultados: no hace
// falta el histórico de precios para pintarlo.
export type FavoriteCourse = Omit<CourseDetail, "priceHistory">;

// Todas estas funciones esperan un cliente **con la sesión del visitante**
// (`createSupabaseSessionClient`), no el cliente anónimo. Quien decide qué filas
// se ven es la RLS a partir de `auth.uid()`, así que un cliente sin sesión no
// devuelve nada — que es justo lo correcto, no un fallo que haya que sortear.
//
// Por eso ninguna consulta filtra por usuario a mano: si se filtrara aquí, el
// día que alguien olvidara el filtro se filtrarían datos ajenos. Con la RLS, el
// olvido no cambia nada (ver 0004_favorites.sql).

// Ids de los cursos guardados, del más reciente al más antiguo.
async function idsFavoritos(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client
    .from("favorites")
    .select("course_id")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Fallo al leer los favoritos: ${error.message}`);
  }

  return ((data ?? []) as Array<{ course_id: string }>).map((f) => f.course_id);
}

// La lista completa, ya con los datos del curso para poder pintarla.
export async function listarFavoritos(client: SupabaseClient): Promise<FavoriteCourse[]> {
  const ids = await idsFavoritos(client);
  if (ids.length === 0) return [];

  // `getCoursesByIds` respeta el orden de los ids que recibe, así que la lista
  // sale ordenada por cuándo se guardó cada uno sin ordenar dos veces.
  //
  // Si un curso desaparece del catálogo, deja de aparecer en la lista pero la
  // fila sigue ahí; no se rompe nada. Limpiarlas es tarea de la ingesta.
  return getCoursesByIds(client, ids);
}

export async function esFavorito(client: SupabaseClient, courseId: string): Promise<boolean> {
  if (!isValidCourseId(courseId)) return false;

  const { data, error } = await client
    .from("favorites")
    .select("course_id")
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) {
    throw new Error(`Fallo al comprobar el favorito: ${error.message}`);
  }

  return data !== null;
}

// Guarda un favorito. `userId` va explícito porque la columna es obligatoria;
// la RLS comprueba además que coincida con la sesión, así que no se puede
// guardar a nombre de otra persona aunque se manipule esta llamada.
//
// Guardar dos veces el mismo curso no es un error para quien lo pulsa (doble
// clic, o un botón que se quedó desactualizado), así que no debe reventar.
//
// `ignoreDuplicates` es imprescindible, no un adorno: sin él, PostgREST manda
// `ON CONFLICT DO UPDATE`, Postgres aplica entonces las políticas de UPDATE de
// la tabla —que no existen, porque una fila de favoritos no tiene nada que
// actualizar— y el segundo guardado falla con un error de RLS. Con él manda
// `ON CONFLICT DO NOTHING`, que es lo que de verdad se quiere: la fila ya está.
export async function guardarFavorito(
  client: SupabaseClient,
  userId: string,
  courseId: string
): Promise<void> {
  if (!isValidCourseId(courseId)) {
    throw new Error("Identificador de curso no válido.");
  }

  const { error } = await client
    .from("favorites")
    .upsert(
      { user_id: userId, course_id: courseId },
      { onConflict: "user_id,course_id", ignoreDuplicates: true }
    );

  if (error) {
    throw new Error(`Fallo al guardar el favorito: ${error.message}`);
  }
}

// Quitar algo que no estaba guardado no es un error: el resultado que la
// persona quería —que no esté— ya se cumple.
export async function quitarFavorito(
  client: SupabaseClient,
  courseId: string
): Promise<void> {
  if (!isValidCourseId(courseId)) {
    throw new Error("Identificador de curso no válido.");
  }

  // Sin `.eq("user_id", ...)` a propósito: la RLS solo deja borrar lo propio.
  const { error } = await client.from("favorites").delete().eq("course_id", courseId);

  if (error) {
    throw new Error(`Fallo al quitar el favorito: ${error.message}`);
  }
}
