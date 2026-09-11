import { describe, expect, it } from "vitest";
import { avisoCambioCorreo } from "./aviso-cambio-correo";

describe("avisoCambioCorreo", () => {
  it("traduce los tres códigos que manda el callback, cada uno con su tono", () => {
    expect(avisoCambioCorreo("confirmado")).toEqual({
      texto: expect.stringMatching(/ya es el nuevo/i),
      tono: "listo",
    });
    expect(avisoCambioCorreo("confirmado-parcial")).toEqual({
      texto: expect.stringMatching(/abre también/i),
      tono: "pendiente",
    });
    expect(avisoCambioCorreo("enlace")).toEqual({
      texto: expect.stringMatching(/ya no vale/i),
      tono: "fallo",
    });
  });

  it("no dice nada cuando no hay parámetro", () => {
    expect(avisoCambioCorreo(undefined)).toBeUndefined();
  });

  // La dirección la escribe quien quiera. Si el parámetro se mostrara tal
  // cual, se podría montar un mensaje falso con la pinta de venir del sitio.
  it("nunca deja pasar un texto de la dirección", () => {
    expect(avisoCambioCorreo("Tu cuenta está bloqueada, llama al 900 123 456")).toBeUndefined();
    expect(avisoCambioCorreo("<script>alert(1)</script>")).toBeUndefined();
    expect(avisoCambioCorreo("caducado")).toBeUndefined();
  });

  it("no se cree las propiedades heredadas", () => {
    expect(avisoCambioCorreo("toString")).toBeUndefined();
    expect(avisoCambioCorreo("constructor")).toBeUndefined();
    expect(avisoCambioCorreo("__proto__")).toBeUndefined();
  });

  it("no elige cuando el parámetro viene repetido", () => {
    expect(avisoCambioCorreo(["confirmado"])).toBeUndefined();
    expect(avisoCambioCorreo(["confirmado", "enlace"])).toBeUndefined();
  });
});
