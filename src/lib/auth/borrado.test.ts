import { describe, expect, it } from "vitest";
import { confirmacionCoincide } from "./borrado";

const CORREO = "alguien@example.com";

describe("HU-020 — confirmación para borrar la cuenta", () => {
  it("acepta el correo exacto", () => {
    expect(confirmacionCoincide(CORREO, CORREO)).toBe(true);
  });

  it("acepta variaciones de mayúsculas y espacios sobrantes", () => {
    for (const escrito of ["  alguien@example.com", "ALGUIEN@EXAMPLE.COM", " Alguien@Example.com "]) {
      expect(confirmacionCoincide(escrito, CORREO)).toBe(true);
    }
  });

  it("rechaza otro correo, aunque se parezca", () => {
    for (const escrito of [
      "alguien@example.co",
      "alguien@examples.com",
      "otro@example.com",
      "alguien+etiqueta@example.com",
    ]) {
      expect(confirmacionCoincide(escrito, CORREO)).toBe(false);
    }
  });

  // Lo que nunca puede pasar: que enviar el formulario vacío borre la cuenta.
  it("rechaza la cadena vacía y los espacios", () => {
    for (const escrito of ["", "   ", "\n"]) {
      expect(confirmacionCoincide(escrito, CORREO)).toBe(false);
    }
  });

  // Si por lo que sea la cuenta no tuviera correo, escribir vacío no debe
  // "coincidir" y borrarla.
  it("no coincide cuando la cuenta no tiene correo", () => {
    expect(confirmacionCoincide("", "")).toBe(false);
    expect(confirmacionCoincide("   ", "")).toBe(false);
  });
});
