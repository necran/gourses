import type { SupabaseClient } from "@supabase/supabase-js";

// Cierra la sesión en todos los dispositivos (HU-038): revoca todos los
// tokens de refresco de la persona, no solo el de este navegador.
//
// Aparte del server action para poder probarlo con un cliente falso, sin
// levantar Next ni la base de datos — un fichero `"use server"` solo puede
// exportar funciones asíncronas, así que esta decisión no sería alcanzable
// desde un test si viviera dentro de la acción.

export interface ResultadoCierreGlobal {
  error?: string;
}

// `scope: "global"` revoca el token de refresco de **todas** las sesiones,
// incluida esta: no hace falta un `signOut()` aparte para cerrar la de este
// navegador, y las cookies se limpian igual que en el cierre normal, porque es
// la misma librería (`@supabase/ssr`) escribiéndolas a través del mismo
// cliente.
//
// Si falla, no se cierra nada: mejor dejarlo todo como estaba y decirlo que
// hacer creer que se ha cortado el acceso en todas partes cuando puede que no.
export async function cerrarSesionGlobalConCliente(
  client: SupabaseClient
): Promise<ResultadoCierreGlobal> {
  const { error } = await client.auth.signOut({ scope: "global" });

  if (error) {
    return {
      error: "No se ha podido cerrar la sesión en todos los dispositivos. Inténtalo de nuevo.",
    };
  }

  return {};
}
