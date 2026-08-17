"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "../../lib/supabase/session-client";
import { confirmacionCoincide } from "../../lib/auth/borrado";
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
