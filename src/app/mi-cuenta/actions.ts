"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "../../lib/supabase/session-client";
import { confirmacionCoincide } from "../../lib/auth/borrado";
import { cerrarSesionGlobalConCliente } from "../../lib/auth/cerrar-sesion-global";
import { isValidEmail, normalizeEmail } from "../../lib/auth/email";
import { resultadoCambioCorreo, type ResultadoCambioCorreo } from "../../lib/auth/resultado-cambio-correo";
import { urlSitio } from "../../lib/auth/sitio";
import { guardarPreferenciaAvisos } from "../../lib/alertas/preferencias";

export interface AvisosEstado {
  guardado?: boolean;
  activados?: boolean;
}

// Activa o desactiva los avisos de bajada de precio (HU-021).
//
// El valor llega de una casilla del formulario, pero de quién es la preferencia
// no: eso sale de la sesión verificada. Así el formulario no puede tocar la de
// otra persona, y la RLS lo impediría igualmente.
//
// Devuelve estado en vez de no devolver nada para poder confirmar en pantalla
// que se guardó. Sin esa confirmación, pulsar «Guardar» no produce ningún
// cambio visible y no hay forma de saber si surtió efecto.
export async function cambiarAvisos(
  _previo: AvisosEstado,
  formData: FormData
): Promise<AvisosEstado> {
  const client = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect("/acceder");

  // Una casilla sin marcar no se envía: su ausencia es el "no".
  const activados = formData.get("avisos") !== null;

  await guardarPreferenciaAvisos(client, user.id, activados);
  revalidatePath("/mi-cuenta");

  return { guardado: true, activados };
}

export interface BorradoEstado {
  error?: string;
}

// Borra la cuenta de quien la pide (HU-020).
//
// El borrado en sí lo hace `borrar_mi_cuenta()`, una función de la base de datos
// atada a `auth.uid()`. Aquí no aparece la clave de servicio por ninguna parte:
// esa clave salta la RLS entera y no puede vivir en código alcanzable desde una
// página (ver .claude/rules/seguridad.md).
//
// La comprobación del correo escrito es una barrera contra el clic accidental,
// no una medida de seguridad: quien tiene la sesión ya podría borrarse. Por eso
// se compara contra el correo de la sesión verificada, nunca contra uno que
// venga del formulario.
export async function borrarCuenta(
  _previo: BorradoEstado,
  formData: FormData
): Promise<BorradoEstado> {
  const client = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect("/acceder");

  const escrito = String(formData.get("confirmacion") ?? "");

  if (!confirmacionCoincide(escrito, user.email ?? "")) {
    return {
      error: "Escribe tu dirección de correo exactamente como aparece arriba para confirmar.",
    };
  }

  const { error } = await client.rpc("borrar_mi_cuenta");

  if (error) {
    return {
      error: "No hemos podido borrar la cuenta ahora mismo. Inténtalo de nuevo en unos minutos.",
    };
  }

  // La cuenta ya no existe, pero la cookie de sesión sigue en el navegador:
  // hay que retirarla o quedaría apuntando a un usuario borrado.
  await client.auth.signOut();

  redirect("/cuenta-borrada");
}

export interface CierreGlobalEstado {
  error?: string;
}

// Cierra la sesión en todos los dispositivos (HU-038), no solo en este
// navegador. La decisión de qué hacer con el error de Supabase vive en
// `cerrarSesionGlobalConCliente`, que se prueba aparte con un cliente falso;
// aquí solo se resuelve la sesión y se redirige.
// El botón no lleva ningún campo: los dos parámetros están aquí porque
// `useActionState` los exige, no porque haya nada que leer de ninguno.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function cerrarSesionGlobal(
  _previo: CierreGlobalEstado,
  _formData: FormData
): Promise<CierreGlobalEstado> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const client = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect("/acceder");

  const resultado = await cerrarSesionGlobalConCliente(client);
  if (resultado.error) return resultado;

  redirect("/");
}

// Pide el cambio de correo de la cuenta (HU-037).
//
// No completa nada por sí solo: Supabase manda un enlace de confirmación a la
// dirección nueva y, con el cambio seguro activado (que es lo que hay
// configurado), otro a la antigua — el cambio no se aplica hasta que se
// confirman las dos (comprobado contra el Supabase real del proyecto). Esta
// acción solo dispara ese envío.
export async function cambiarCorreo(
  _previo: ResultadoCambioCorreo,
  formData: FormData
): Promise<ResultadoCambioCorreo> {
  const client = await createSupabaseSessionClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect("/acceder");

  const nuevo = normalizeEmail(String(formData.get("correo") ?? ""));

  if (!isValidEmail(nuevo)) {
    return { error: "Escribe una dirección de correo válida." };
  }

  // No es una medida de seguridad —Supabase lo comprobaría igual—, es evitar
  // un viaje de ida y vuelta por correo para no cambiar nada.
  if (user.email && normalizeEmail(user.email) === nuevo) {
    return { error: "Esa ya es la dirección de tu cuenta." };
  }

  const { error } = await client.auth.updateUser(
    { email: nuevo },
    // Nunca `TITULAR.url` fijo ni la cabecera `Host`: este enlace viaja por
    // correo, y un destino tomado de lo que mande quien llama lo convertiría
    // en un redirector a un sitio ajeno (mismo motivo que en el acceso).
    { emailRedirectTo: `${urlSitio()}/mi-cuenta/correo/callback` }
  );

  return resultadoCambioCorreo(error);
}
