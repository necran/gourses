"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "../../lib/supabase/session-client";
import { guardarFavorito, quitarFavorito } from "../../lib/favorites/favorites";
import { isValidCourseId } from "../../lib/courses/get-course";

// Alternar un favorito (HU-019).
//
// El id llega de un formulario, así que es entrada externa y se valida antes de
// tocar la base de datos. Aun así, la última palabra la tiene la RLS: aunque
// alguien llame a esta acción con el id de otra persona, solo puede escribir lo
// suyo (ver 0004_favorites.sql).
async function alternar(formData: FormData, guardar: boolean) {
  const courseId = String(formData.get("courseId") ?? "");

  if (!isValidCourseId(courseId)) {
    // Un id con otra forma no puede corresponder a ningún curso, así que no se
    // consulta siquiera. Se vuelve a la lista en vez de mostrar un error: no hay
    // nada que la persona pueda hacer con ese aviso.
    redirect("/favoritos");
  }

  const client = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  // Sin sesión no se guarda nada y se lleva a acceder, que es el paso que falta.
  if (!user) redirect("/acceder");

  if (guardar) {
    await guardarFavorito(client, user.id, courseId);
  } else {
    await quitarFavorito(client, courseId);
  }

  // Las dos páginas que muestran el estado del favorito tienen que reflejarlo
  // ya: la ficha (por su botón) y la lista.
  revalidatePath(`/curso/${courseId}`);
  revalidatePath("/favoritos");
}

export async function guardarEnFavoritos(formData: FormData) {
  await alternar(formData, true);
}

export async function quitarDeFavoritos(formData: FormData) {
  await alternar(formData, false);
}
