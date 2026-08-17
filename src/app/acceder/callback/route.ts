import { NextResponse } from "next/server";
import { createSupabaseSessionClient } from "../../../lib/supabase/session-client";

// Canjea el código del enlace mágico por una sesión (HU-018).
//
// Es una ruta de servidor y no una página porque necesita escribir cookies. El
// código llega en la dirección, así que **nunca se registra ni se refleja en la
// respuesta**: es una credencial de un solo uso.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/acceder?error=enlace", url.origin));
  }

  const client = await createSupabaseSessionClient();
  const { error } = await client.auth.exchangeCodeForSession(code);

  if (error) {
    // Enlace caducado, ya usado o manipulado. El motivo exacto no se muestra:
    // no aporta nada a quien tiene derecho a entrar y sí a quien no.
    return NextResponse.redirect(new URL("/acceder?error=enlace", url.origin));
  }

  // El destino es fijo, nunca un parámetro de la dirección: si se aceptara uno,
  // el enlace del correo podría usarse para llevar a la persona a otro sitio
  // justo después de identificarse.
  return NextResponse.redirect(new URL("/mi-cuenta", url.origin));
}
