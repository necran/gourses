import type { MensajeAviso } from "./mensaje.ts";

export interface Enviado {
  destinatario: string;
  asunto: string;
}

export interface EnviadorCorreo {
  // Qué es este enviador, para que el log del job lo diga sin ambigüedad.
  readonly nombre: string;
  enviar(destinatario: string, mensaje: MensajeAviso): Promise<void>;
}

// Remitente. Debe ser un dominio verificado en Resend o los correos se rechazan.
const REMITENTE_POR_DEFECTO = "Gourses <avisos@gourses.com>";

// Enviador real (Resend).
//
// Se llama a la API por HTTP en vez de añadir el SDK: es una única petición con
// un JSON, y así el job no arrastra una dependencia más ni su cadena de
// actualizaciones.
export function crearEnviadorResend(apiKey: string, remitente?: string): EnviadorCorreo {
  // Aquí `??` no vale: GitHub Actions define la variable como cadena **vacía**
  // cuando el secreto no existe, en vez de dejarla sin definir, y `??` solo
  // atrapa null/undefined. Se enviaría `from: ""` y Resend rechazaría todos los
  // correos — el primer envío real, justo cuando ya nadie está mirando.
  const from = remitente?.trim() || REMITENTE_POR_DEFECTO;

  return {
    nombre: "resend",
    async enviar(destinatario, mensaje) {
      const respuesta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          // Un destinatario por envío, siempre. Agrupar varios correos en un
          // mismo mensaje enseñaría la dirección de unas personas a otras.
          to: [destinatario],
          subject: mensaje.asunto,
          text: mensaje.texto,
          html: mensaje.html,
        }),
      });

      if (!respuesta.ok) {
        // El cuerpo del error de Resend puede repetir la dirección; se registra
        // el código, que es lo que sirve para diagnosticar, y no el detalle.
        throw new Error(`Resend respondió ${respuesta.status} al enviar el aviso.`);
      }
    },
  };
}

// Enviador de mentira, para cuando aún no hay clave configurada.
//
// No es un apaño ni un modo de pruebas escondido: mientras Resend no esté dado
// de alta, el job debe poder ejecutarse entero —detectar bajadas, componer los
// avisos, contar cuáles saldrían— sin fallar y sin enviar nada. Encender el
// envío de verdad es entonces poner RESEND_API_KEY, no tocar código.
//
// **No registra la dirección de nadie.** Este job corre en GitHub Actions, cuyos
// logs son legibles por cualquiera en un repositorio público; escribir ahí quién
// tiene guardado qué filtraría por la puerta de atrás justo lo que la RLS
// protege. Con el asunto basta para comprobar que el job funciona, y el asunto
// no dice a quién iba.
export function crearEnviadorRegistrador(log: (linea: string) => void = console.log): EnviadorCorreo {
  return {
    nombre: "registrador (sin envío real)",
    async enviar(_destinatario, mensaje) {
      log(`[aviso no enviado] ${mensaje.asunto}`);
    },
  };
}

// Elige el enviador según el entorno. Es el único sitio donde se decide, para
// que ni el job ni los tests tengan que saber de esto.
export function crearEnviadorDesdeEntorno(env: NodeJS.ProcessEnv = process.env): EnviadorCorreo {
  const clave = env.RESEND_API_KEY;
  return clave ? crearEnviadorResend(clave, env.RESEND_FROM) : crearEnviadorRegistrador();
}
