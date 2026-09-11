import { describe, expect, it } from "vitest";
import {
  CORREO_YA_EXISTE,
  ERROR_GENERICO,
  LIMITE_DE_ENVIO,
  resultadoCambioCorreo,
} from "./resultado-cambio-correo";

describe("resultadoCambioCorreo", () => {
  it("da por enviado cuando Supabase no devuelve error", () => {
    expect(resultadoCambioCorreo(null)).toEqual({ enviado: true });
    expect(resultadoCambioCorreo(undefined)).toEqual({ enviado: true });
  });

  it("da por enviado cuando el envío es demasiado reciente", () => {
    expect(resultadoCambioCorreo({ code: LIMITE_DE_ENVIO })).toEqual({ enviado: true });
  });

  // El caso propio de esta historia: comprobado contra Supabase real, pedir el
  // cambio a un correo que ya tiene cuenta devuelve 422 email_exists en el
  // momento. Si se dejara pasar tal cual, el formulario diría quién está
  // registrado con solo probar direcciones.
  it("da por enviado cuando el correo ya tiene cuenta, sin decirlo", () => {
    expect(resultadoCambioCorreo({ code: CORREO_YA_EXISTE })).toEqual({ enviado: true });
  });

  // Las tres respuestas de éxito tienen que ser indistinguibles entre sí: es
  // lo que impide usar el formulario para averiguar nada.
  it("los tres casos de éxito responden exactamente igual", () => {
    const normal = resultadoCambioCorreo(null);
    expect(resultadoCambioCorreo({ code: LIMITE_DE_ENVIO })).toEqual(normal);
    expect(resultadoCambioCorreo({ code: CORREO_YA_EXISTE })).toEqual(normal);
  });

  it("devuelve un error genérico ante cualquier otro fallo", () => {
    expect(resultadoCambioCorreo({ code: "unexpected_failure" })).toEqual({
      error: ERROR_GENERICO,
    });
    expect(resultadoCambioCorreo({})).toEqual({ error: ERROR_GENERICO });
  });

  it("no deja salir el mensaje original de Supabase", () => {
    const resultado = resultadoCambioCorreo({
      code: "over_request_rate_limit",
      // @ts-expect-error el error real de Supabase trae más campos que el que pide el tipo
      message: "Detalle interno con la dirección alguien@example.com",
    });

    expect(resultado.error).toBe(ERROR_GENERICO);
    expect(JSON.stringify(resultado)).not.toMatch(/@|interno/);
  });
});
