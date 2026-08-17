import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("quita espacios y pasa a minúsculas", () => {
    expect(normalizeEmail("  Hola@Gourses.COM  ")).toBe("hola@gourses.com");
  });
});

describe("isValidEmail", () => {
  it("acepta direcciones normales", () => {
    for (const v of [
      "hola@gourses.com",
      "ruben.garcia@example.co.uk",
      "a+etiqueta@example.org",
      "  Usuario@Example.com  ",
    ]) {
      expect(isValidEmail(v), v).toBe(true);
    }
  });

  it("rechaza lo que no tiene forma de dirección", () => {
    for (const v of [
      "",
      "   ",
      "sinarroba.com",
      "@sinusuario.com",
      "usuario@",
      "usuario@sinpunto",
      "usuario@@doble.com",
      "con espacio@example.com",
      "usuario@example .com",
    ]) {
      expect(isValidEmail(v), v).toBe(false);
    }
  });

  it("rechaza valores que no son texto", () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });

  // Una dirección desmesurada no la acepta ningún servidor de correo, y sirve
  // para colar cargas raras en formularios.
  it("rechaza direcciones más largas de lo que permite el estándar", () => {
    expect(isValidEmail("a".repeat(250) + "@example.com")).toBe(false);
  });

  it("rechaza intentos de meter saltos de línea, que sirven para inyectar cabeceras", () => {
    expect(isValidEmail("usuario@example.com\nBcc: otro@example.com")).toBe(false);
    expect(isValidEmail("usuario@example.com\r\nSubject: falso")).toBe(false);
  });
});
