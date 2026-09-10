// Qué contarle a quien pide el enlace de acceso, según lo que responda
// Supabase (HU-018).
//
// Vive aquí y no dentro del server action porque un fichero `"use server"`
// solo puede exportar funciones asíncronas: metida allí, esta decisión no
// tendría forma de probarse, y es justo la parte con criterio.

/** Código de Supabase Auth para «ya se mandó un correo a esta dirección hace
 *  muy poco» (HTTP 429). */
export const LIMITE_DE_ENVIO = "over_email_send_rate_limit";

export const ERROR_GENERICO =
  "No hemos podido enviar el enlace ahora mismo. Inténtalo de nuevo en unos minutos.";

export interface ResultadoEnvio {
  error?: string;
  enviado?: boolean;
}

/**
 * Decide la respuesta a partir del error de Supabase (o su ausencia).
 *
 * Toda la página se apoya en la misma idea: **la respuesta no debe depender de
 * lo que sepamos de esa dirección**. Si cambiara, el formulario serviría para
 * averiguar quién está registrado, o quién acaba de pedir acceso.
 */
export function resultadoEnvio(error?: { code?: string } | null): ResultadoEnvio {
  if (!error) return { enviado: true };

  // Pulsar dos veces seguidas es lo más normal cuando el correo tarda unos
  // segundos en aparecer, y Supabase lo rechaza: solo admite un envío por
  // minuto y dirección. Contarlo como fallo era mentir —el enlace ya está en la
  // bandeja de entrada— y encima empujaba a insistir, que es lo que no ayuda.
  //
  // Se responde lo mismo que en un envío correcto, y no un aviso aparte, por lo
  // dicho arriba: un mensaje distinto cuando el envío es reciente delataría que
  // alguien acaba de pedir acceso con esa dirección.
  if (error.code === LIMITE_DE_ENVIO) return { enviado: true };

  // Del resto no se devuelve el mensaje de Supabase tal cual: puede traer
  // detalles del estado de la cuenta o del propio servicio.
  return { error: ERROR_GENERICO };
}
