import { describe, expect, it } from "vitest";
import { preferredLanguageFrom } from "./preferred-language";

describe("preferredLanguageFrom (HU-032)", () => {
  it("sin cabecera, no hay idioma preferido", () => {
    expect(preferredLanguageFrom(undefined)).toBeNull();
    expect(preferredLanguageFrom(null)).toBeNull();
    expect(preferredLanguageFrom("")).toBeNull();
  });

  it("un solo idioma simple", () => {
    expect(preferredLanguageFrom("es")).toBe("es");
  });

  it("recorta la región a la subetiqueta principal", () => {
    expect(preferredLanguageFrom("es-ES")).toBe("es");
    expect(preferredLanguageFrom("zh-Hans-CN")).toBe("zh");
  });

  it("sin q explícito, se respeta el orden de la cabecera", () => {
    expect(preferredLanguageFrom("es,en")).toBe("es");
  });

  it("con q explícito, gana el más preferido aunque vaya después", () => {
    expect(preferredLanguageFrom("en;q=0.5,es;q=0.9")).toBe("es");
  });

  it("ignora un q=0: significa que no lo quiere", () => {
    expect(preferredLanguageFrom("es;q=0,en;q=0.8")).toBe("en");
  });

  it("ignora el comodín *", () => {
    expect(preferredLanguageFrom("*,es;q=0.5")).toBe("es");
  });

  it("no distingue mayúsculas", () => {
    expect(preferredLanguageFrom("ES-es")).toBe("es");
  });

  it("un q mal formado no rompe: se trata como preferencia normal", () => {
    expect(preferredLanguageFrom("es;q=abc")).toBe("es");
  });

  it("una etiqueta con caracteres que no son de idioma no cuela, pero no bloquea las demás", () => {
    expect(preferredLanguageFrom("' or 1=1 --,es")).toBe("es");
  });

  it("no valida contra una lista de idiomas reales: solo exige el formato de dos letras", () => {
    // No hay ningún curso en "xx", así que priorizarIdioma simplemente no
    // encontrará coincidencias — es un caso inofensivo, no uno a rechazar aquí.
    expect(preferredLanguageFrom("xx")).toBe("xx");
  });

  it("una etiqueta demasiado larga o corta no cuela", () => {
    expect(preferredLanguageFrom("xyz,e,es")).toBe("es");
  });

  it("cabecera completamente inservible devuelve null, no rompe", () => {
    expect(preferredLanguageFrom(",,,;q=")).toBeNull();
  });
});
