// Qué contarle a quien pide cambiar el correo de su cuenta, según lo que
// responda Supabase (HU-037).
//
// Aparte del server action por lo de siempre: un fichero `"use server"` solo
// puede exportar funciones asíncronas, y esta decisión es la parte con
// criterio, la que hay que poder probar.

/** Mismo código que en el acceso (HU-018): ya se mandó un correo a esta
 *  dirección hace muy poco (HTTP 429). */
export const LIMITE_DE_ENVIO = "over_email_send_rate_limit";

/**
 * Comprobado contra Supabase: pedir el cambio a un correo que ya tiene cuenta
 * devuelve esto en el momento, a diferencia del acceso (`signInWithOtp`), que
 * no distingue. Aquí sí hay que interceptarlo a mano.
 */
export const CORREO_YA_EXISTE = "email_exists";

export const ERROR_GENERICO =
  "No hemos podido pedir el cambio ahora mismo. Inténtalo de nuevo en unos minutos.";

export interface ResultadoCambioCorreo {
  error?: string;
  enviado?: boolean;
}

/**
 * Decide la respuesta a partir del error de Supabase (o su ausencia).
 *
 * La respuesta no puede depender de si esa dirección ya tiene cuenta: si
 * cambiara, este formulario se convertiría en un comprobador de quién está
 * registrado, exactamente el motivo por el que `enviarEnlace` (HU-018)
 * responde siempre igual. La diferencia aquí es que Supabase sí lo revela
 * —`email_exists`, HTTP 422— así que hay que taparlo a propósito; en el
 * acceso, `signInWithOtp` ya no distingue por su cuenta.
 */
export function resultadoCambioCorreo(error?: { code?: string } | null): ResultadoCambioCorreo {
  if (!error) return { enviado: true };

  if (error.code === LIMITE_DE_ENVIO || error.code === CORREO_YA_EXISTE) {
    return { enviado: true };
  }

  // Del resto no se devuelve el mensaje de Supabase tal cual: puede traer
  // detalles del estado de la cuenta o del propio servicio.
  return { error: ERROR_GENERICO };
}
