"use server";

import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "../../lib/supabase/session-client";
import { isValidEmail, normalizeEmail } from "../../lib/auth/email";
import { TITULAR } from "../../lib/legal/titular";

export interface AccederEstado {
  error?: string;
  enviado?: boolean;
}

// Envía el enlace de acceso (HU-018).
//
// La respuesta es **la misma exista o no una cuenta con ese correo**: si
// distinguiéramos, la página se convertiría en un comprobador de quién está
// registrado en el sitio, que es una fuga de datos personales.
export async function enviarEnlace(
  _previo: AccederEstado,
  formData: FormData
): Promise<AccederEstado> {
  const correo = normalizeEmail(String(formData.get("email") ?? ""));

  if (!isValidEmail(correo)) {
    return { error: "Escribe una dirección de correo válida." };
  }

  const client = await createSupabaseSessionClient();
  const { error } = await client.auth.signInWithOtp({
    email: correo,
    options: {
      emailRedirectTo: `${TITULAR.url}/acceder/callback`,
    },
  });

  if (error) {
    // No se devuelve el mensaje de Supabase tal cual: puede revelar detalles
    // del estado de la cuenta o del propio servicio.
    return {
      error:
        "No hemos podido enviar el enlace ahora mismo. Inténtalo de nuevo en unos minutos.",
    };
  }

  return { enviado: true };
}

export async function cerrarSesion() {
  const client = await createSupabaseSessionClient();
  await client.auth.signOut();
  redirect("/");
}
