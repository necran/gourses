"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server-client";
import { esTokenBaja } from "../../../lib/boletin/contenido";

// Baja del boletín desde el enlace del correo, sin sesión (HU-066).
//
// Con la clave anónima y la función `baja_boletin`, que solo desactiva la fila de
// ese token: aquí no aparece la clave de servicio. El token se valida antes de
// llegar a la base, porque viene de la dirección.
export async function darseDeBajaDelBoletin(formData: FormData): Promise<void> {
  const token = formData.get("t");
  if (!esTokenBaja(token)) redirect("/boletin/baja?estado=invalido");

  const { data, error } = await createSupabaseServerClient().rpc("baja_boletin", { p_token: token });

  if (error) redirect(`/boletin/baja?estado=error&t=${encodeURIComponent(token)}`);
  redirect(data === true ? "/boletin/baja?estado=hecho" : "/boletin/baja?estado=invalido");
}
