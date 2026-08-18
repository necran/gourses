import { afterEach, describe, expect, it, vi } from "vitest";
import {
  crearEnviadorDesdeEntorno,
  crearEnviadorRegistrador,
  crearEnviadorResend,
} from "./enviar";
import type { MensajeAviso } from "./mensaje";

const MENSAJE: MensajeAviso = {
  asunto: "Ha bajado a 10.00 EUR: Un curso",
  texto: "cuerpo en texto",
  html: "<p>cuerpo en html</p>",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HU-021 — envío de los avisos", () => {
  // Lo que permite tener la Fase 4 entera hecha antes de dar de alta Resend.
  describe("sin clave configurada", () => {
    it("elige el registrador, que no envía nada", async () => {
      const enviador = crearEnviadorDesdeEntorno({} as unknown as NodeJS.ProcessEnv);
      expect(enviador.nombre).toMatch(/sin envío real/i);
    });

    it("no llama a ninguna API", async () => {
      const fetchFalso = vi.fn();
      vi.stubGlobal("fetch", fetchFalso);

      const lineas: string[] = [];
      await crearEnviadorRegistrador((l) => lineas.push(l)).enviar("alguien@example.com", MENSAJE);

      expect(fetchFalso).not.toHaveBeenCalled();
      // Sirve para comprobar que el job hace su trabajo...
      expect(lineas[0]).toContain(MENSAJE.asunto);
    });

    // ...pero sin decir a quién. Este job corre en GitHub Actions, y los logs de
    // un repositorio público los lee cualquiera: escribir ahí las direcciones
    // filtraría quién tiene guardado qué, que es exactamente lo que la RLS
    // protege en la base de datos.
    it("no escribe la dirección de nadie en el log", async () => {
      const lineas: string[] = [];
      await crearEnviadorRegistrador((l) => lineas.push(l)).enviar("alguien@example.com", MENSAJE);

      expect(lineas.join("\n")).not.toContain("alguien@example.com");
    });
  });

  describe("con clave configurada", () => {
    it("elige Resend", () => {
      const enviador = crearEnviadorDesdeEntorno({
        RESEND_API_KEY: "re_loquesea",
      } as unknown as NodeJS.ProcessEnv);
      expect(enviador.nombre).toBe("resend");
    });

    it("manda un único destinatario por correo", async () => {
      const fetchFalso = vi.fn(async () => new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchFalso);

      await crearEnviadorResend("re_clave").enviar("alguien@example.com", MENSAJE);

      const [, opciones] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
      const cuerpo = JSON.parse(String(opciones.body));

      // Agrupar destinatarios enseñaría la dirección de unas personas a otras.
      expect(cuerpo.to).toEqual(["alguien@example.com"]);
      expect(cuerpo.subject).toBe(MENSAJE.asunto);
      expect(cuerpo.text).toBe(MENSAJE.texto);
    });

    // GitHub Actions define la variable como cadena VACÍA cuando el secreto no
    // existe, en vez de dejarla sin definir. Con `??` eso pasaba de largo y se
    // enviaba `from: ""`, que Resend rechaza: habría fallado el primer envío
    // real, justo cuando ya no se está mirando.
    it("una cadena vacía como remitente cae al de por defecto", async () => {
      const fetchFalso = vi.fn(async () => new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchFalso);

      await crearEnviadorResend("re_clave", "").enviar("a@b.com", MENSAJE);

      const [, opciones] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(opciones.body)).from).toContain("avisos@gourses.com");
    });

    it("usa el remitente configurado si lo hay", async () => {
      const fetchFalso = vi.fn(async () => new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchFalso);

      await crearEnviadorResend("re_clave", "Otro <otro@ejemplo.com>").enviar("a@b.com", MENSAJE);

      const [, opciones] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(opciones.body)).from).toBe("Otro <otro@ejemplo.com>");
    });

    it("un error de Resend se propaga para que el job lo cuente", async () => {
      vi.stubGlobal("fetch", async () => new Response("nope", { status: 422 }));

      await expect(crearEnviadorResend("re_clave").enviar("a@b.com", MENSAJE)).rejects.toThrow(
        /422/
      );
    });

    // El cuerpo del error de Resend puede repetir la dirección; el mensaje que
    // acaba en el log no debe llevarla.
    it("el error no arrastra el cuerpo de la respuesta", async () => {
      vi.stubGlobal(
        "fetch",
        async () => new Response('{"message":"invalid to: victima@example.com"}', { status: 422 })
      );

      await expect(
        crearEnviadorResend("re_clave").enviar("victima@example.com", MENSAJE)
      ).rejects.toThrow(/^(?!.*victima@example\.com).*$/);
    });

    // La clave va en la cabecera y en ningún otro sitio.
    it("la clave no viaja en el cuerpo ni en la URL", async () => {
      const fetchFalso = vi.fn(async () => new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchFalso);

      await crearEnviadorResend("re_secreta").enviar("a@b.com", MENSAJE);

      const [url, opciones] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).not.toContain("re_secreta");
      expect(String(opciones.body)).not.toContain("re_secreta");
      expect((opciones.headers as Record<string, string>).Authorization).toBe("Bearer re_secreta");
    });
  });
});
