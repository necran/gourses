import { describe, expect, it } from "vitest";
import { ERROR_GENERICO, LIMITE_DE_ENVIO, resultadoEnvio } from "./resultado-envio";

describe("resultadoEnvio", () => {
  it("da por enviado cuando Supabase no devuelve error", () => {
    expect(resultadoEnvio(null)).toEqual({ enviado: true });
    expect(resultadoEnvio(undefined)).toEqual({ enviado: true });
  });

  // El caso que motivó todo esto: al pulsar dos veces seguidas, el primer
  // correo ya está en la bandeja de entrada. Decir que no se ha podido enviar
  // es falso y empuja a insistir.
  it("da por enviado cuando el envío es demasiado reciente", () => {
    expect(resultadoEnvio({ code: LIMITE_DE_ENVIO })).toEqual({ enviado: true });
  });

  // La respuesta al límite tiene que ser **indistinguible** de la de un envío
  // correcto: si se diferenciara, el formulario diría si alguien acaba de pedir
  // acceso con esa dirección.
  it("responde al límite exactamente igual que a un envío correcto", () => {
    expect(resultadoEnvio({ code: LIMITE_DE_ENVIO })).toEqual(resultadoEnvio(null));
  });

  it("devuelve un error genérico ante cualquier otro fallo", () => {
    expect(resultadoEnvio({ code: "unexpected_failure" })).toEqual({ error: ERROR_GENERICO });
    expect(resultadoEnvio({})).toEqual({ error: ERROR_GENERICO });
  });

  // El mensaje de Supabase puede traer detalles de la cuenta o del servicio.
  it("no deja salir el mensaje original de Supabase", () => {
    const resultado = resultadoEnvio({
      code: "email_address_invalid",
      // @ts-expect-error el error real de Supabase trae más campos que el que pide el tipo
      message: "Email address rgaminigarcia7@gmail.com is already registered",
    });

    expect(resultado.error).toBe(ERROR_GENERICO);
    expect(JSON.stringify(resultado)).not.toMatch(/registered|@/);
  });
});
