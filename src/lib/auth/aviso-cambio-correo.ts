// Avisos que `/mi-cuenta` puede mostrar por un parámetro de la dirección
// (HU-037), tras volver del enlace de confirmación de un cambio de correo.
//
// Mismo patrón que `aviso-acceso.ts` (HU-018), por el mismo motivo: el canje
// ocurre en una ruta de servidor que solo puede redirigir, y **se traduce un
// código a un texto nuestro, nunca se muestra el parámetro tal cual** — la
// dirección la escribe quien quiera, y reflejarla dejaría montar un enlace que
// enseñe cualquier mensaje con la pinta de venir del sitio.
// El tono decide qué caja se pinta: un cambio a medias no es un error y no
// debe pintarse como tal, ni un aviso de enlace caducado debe parecer un
// éxito.
export type TonoAvisoCambioCorreo = "listo" | "pendiente" | "fallo";

export interface AvisoCambioCorreo {
  texto: string;
  tono: TonoAvisoCambioCorreo;
}

const AVISOS: Record<string, AvisoCambioCorreo> = {
  confirmado: { texto: "Listo. Tu correo de acceso ya es el nuevo.", tono: "listo" },
  // El cambio necesita dos confirmaciones (correo antiguo y nuevo) cuando el
  // cambio seguro está activado, y no hay forma de saber desde el enlace cuál
  // de las dos faltaba antes de este — solo que sigue faltando una.
  "confirmado-parcial": {
    texto:
      "Confirmado desde este correo. Para terminar, abre también el enlace que te llegó al otro " +
      "—si has abierto el del correo nuevo, falta el del antiguo, y al revés—. El cambio no se " +
      "aplica hasta que se confirmen los dos.",
    tono: "pendiente",
  },
  // A propósito no distingue caducado, ya usado o manipulado, igual que en el
  // acceso: a quien tiene derecho a cambiarlo no le aporta nada saberlo.
  enlace: {
    texto:
      "Ese enlace ya no vale: puede que haya caducado o que ya lo hayas usado. Pide el cambio " +
      "otra vez si sigue haciendo falta.",
    tono: "fallo",
  },
};

/** El aviso, o `undefined` si el parámetro no es uno de los nuestros. */
export function avisoCambioCorreo(valor: string | string[] | undefined): AvisoCambioCorreo | undefined {
  // Repetido (`?correo=a&correo=b`) llega como array. No se elige uno: si no
  // viene exactamente uno, no hay aviso que mostrar.
  if (typeof valor !== "string") return undefined;

  return Object.hasOwn(AVISOS, valor) ? AVISOS[valor] : undefined;
}
