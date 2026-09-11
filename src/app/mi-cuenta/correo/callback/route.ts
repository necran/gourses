import { NextResponse } from "next/server";
import { createSupabaseSessionClient } from "../../../../lib/supabase/session-client";

// Canjea el enlace de confirmación de un cambio de correo (HU-037).
//
// Con el cambio seguro activado en Supabase Auth, la confirmación exige un
// enlace en la dirección antigua **y** otro en la nueva; el cambio no se
// aplica hasta que se canjean los dos. Comprobado contra el Supabase real del
// proyecto, los dos canjes no se comportan igual:
//
// - El **primero** de los dos no trae `code`: GoTrue redirige con
//   `?message=Confirmation link accepted. Please proceed to confirm link
//   sent to the other email` y no hay nada que canjear todavía — no
//   establece sesión, solo dice que ese lado ya quedó confirmado. La versión
//   sin JavaScript de cliente de este sitio no puede leer ese `message` como
//   lo haría un SPA (ni falta que hace): con que no traiga `code` ni `error`
//   basta para saber que es este caso.
// - El **segundo** sí trae `code`, y al canjearlo el cambio ya está aplicado
//   del todo.
//
// El código no se registra ni se refleja en la respuesta: es una credencial de
// un solo uso, igual que el del acceso.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // Enlace caducado, ya usado o manipulado. Mismo aviso genérico que en el
  // acceso: el motivo exacto no ayuda a quien tiene derecho a cambiarlo, y sí
  // a quien no.
  if (error) {
    return NextResponse.redirect(new URL("/mi-cuenta?correo=enlace", url.origin));
  }

  if (!code) {
    // Sin `code` y sin `error`: es la primera de las dos confirmaciones.
    return NextResponse.redirect(new URL("/mi-cuenta?correo=confirmado-parcial", url.origin));
  }

  const client = await createSupabaseSessionClient();
  const { error: errorCanje } = await client.auth.exchangeCodeForSession(code);

  if (errorCanje) {
    return NextResponse.redirect(new URL("/mi-cuenta?correo=enlace", url.origin));
  }

  // Comprobación de más: `new_email` debería estar ya vacío en cuanto llega un
  // `code` que canjea bien, porque es justo la segunda confirmación la que
  // completa el cambio. Se vuelve a mirar por si el comportamiento cambiara
  // algún día, para no anunciar «listo» cuando todavía falta algo.
  const {
    data: { user },
  } = await client.auth.getUser();

  const destino = user?.new_email ? "correo=confirmado-parcial" : "correo=confirmado";
  return NextResponse.redirect(new URL(`/mi-cuenta?${destino}`, url.origin));
}
