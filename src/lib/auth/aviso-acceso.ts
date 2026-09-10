// Avisos que la página de acceso puede mostrar por un parámetro de la
// dirección (HU-018).
//
// Los manda `acceder/callback` cuando el enlace del correo no sirve, porque el
// canje ocurre en una ruta de servidor que solo puede redirigir; sin esto, el
// parámetro se perdía y la persona volvía al formulario sin ninguna
// explicación.
//
// **Se traduce un código a un texto nuestro; nunca se muestra el parámetro.**
// La dirección la escribe quien quiera: reflejarla tal cual dejaría montar
// `/acceder?error=Tu+cuenta+está+bloqueada,+llama+al+900...` y enseñarlo con la
// pinta de un mensaje del sitio, que es media estafa hecha.
const AVISOS = {
  // A propósito no distingue caducado, ya usado o manipulado: el callback
  // tampoco lo hace. A quien tiene derecho a entrar no le aporta nada saberlo,
  // y a quien no, sí.
  enlace:
    "Ese enlace ya no sirve: puede que haya caducado o que ya lo hayas usado. Pide uno nuevo aquí abajo y ábrelo cuanto antes.",
} as const;

export type CodigoAviso = keyof typeof AVISOS;

/** Texto del aviso, o `undefined` si el parámetro no es uno de los nuestros. */
export function avisoAcceso(valor: string | string[] | undefined): string | undefined {
  // Repetir el parámetro (`?error=a&error=enlace`) lo convierte en un array.
  // No se elige uno: si no viene exactamente uno, no hay aviso que mostrar.
  if (typeof valor !== "string") return undefined;

  return Object.hasOwn(AVISOS, valor) ? AVISOS[valor as CodigoAviso] : undefined;
}
