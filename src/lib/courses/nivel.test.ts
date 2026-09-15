import { describe, expect, it } from "vitest";
import { normalizarNivel } from "./nivel";

describe("normalizarNivel", () => {
  it.each([
    ["All Levels", "Todos los niveles"],
    ["Todos los niveles", "Todos los niveles"],
    ["Beginner", "Principiante"],
    ["Beginner Level", "Principiante"],
    ["Principiante", "Principiante"],
    ["Intermediate", "Intermedio"],
    ["Intermediate Level", "Intermedio"],
    ["Intermedio", "Intermedio"],
    ["Expert", "Experto"],
    ["Expert Level", "Experto"],
    ["Experto", "Experto"],
  ])("«%s» se guarda como «%s»", (entrada, salida) => {
    expect(normalizarNivel(entrada)).toBe(salida);
  });

  it("no distingue mayúsculas ni espacios de más", () => {
    expect(normalizarNivel("  all   LEVELS ")).toBe("Todos los niveles");
  });

  it("sin nivel, null", () => {
    expect(normalizarNivel(null)).toBeNull();
    expect(normalizarNivel(undefined)).toBeNull();
    expect(normalizarNivel("   ")).toBeNull();
  });

  it("un nivel que no conoce se conserva tal cual, recortado", () => {
    expect(normalizarNivel(" Avanzado ")).toBe("Avanzado");
  });
});
