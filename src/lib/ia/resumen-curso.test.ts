import { describe, expect, it } from "vitest";
import {
  LONGITUD_MINIMA_DESCRIPCION,
  construirPrompt,
  limpiarResumen,
  necesitaResumen,
  type CursoConEstadoResumen,
} from "./resumen-curso";

describe("construirPrompt", () => {
  it("incluye el título y la descripción real, tal cual", () => {
    const prompt = construirPrompt({
      title: "Curso de prueba",
      description: "Este curso enseña exactamente esto y aquello.",
    });

    expect(prompt).toContain("Curso de prueba");
    expect(prompt).toContain("Este curso enseña exactamente esto y aquello.");
  });

  // El riesgo de esta función es que se le cuele una instrucción que invite a
  // inventar: por eso se prueba explícitamente lo contrario.
  it("pide explícitamente no inventar nada que el texto no diga", () => {
    const prompt = construirPrompt({ title: "X", description: "Y" });

    expect(prompt).toMatch(/no inventes/i);
    expect(prompt).toMatch(/usa solo lo que dice el texto/i);
  });

  it("pide el resumen en español, corto", () => {
    const prompt = construirPrompt({ title: "X", description: "Y" });

    expect(prompt).toMatch(/en español/i);
    expect(prompt).toMatch(/2 o 3 frases/i);
  });
});

describe("limpiarResumen", () => {
  it("recorta espacios sobrantes", () => {
    expect(limpiarResumen("  Un resumen.  ")).toBe("Un resumen.");
  });

  it("quita un encabezado tipo «Resumen:» que el modelo haya añadido pese a lo pedido", () => {
    expect(limpiarResumen("Resumen: Este curso enseña X.")).toBe("Este curso enseña X.");
    expect(limpiarResumen("Summary: This teaches X.")).toBe("This teaches X.");
  });

  it("quita comillas envolventes", () => {
    expect(limpiarResumen('"Un resumen entrecomillado."')).toBe("Un resumen entrecomillado.");
  });

  it("recorta un resumen desproporcionadamente largo sin partir una palabra", () => {
    const largo = "palabra ".repeat(200).trim();
    const resultado = limpiarResumen(largo);

    expect(resultado.length).toBeLessThan(largo.length);
    expect(resultado.endsWith("…")).toBe(true);
    expect(resultado.endsWith(" …")).toBe(false);
  });

  it("no toca un resumen ya limpio y de longitud normal", () => {
    expect(limpiarResumen("Un curso que enseña X, Y y Z en pocas horas.")).toBe(
      "Un curso que enseña X, Y y Z en pocas horas."
    );
  });
});

describe("necesitaResumen", () => {
  function curso(overrides: Partial<CursoConEstadoResumen> = {}): CursoConEstadoResumen {
    return {
      id: "1",
      title: "Curso",
      description: "d".repeat(LONGITUD_MINIMA_DESCRIPCION),
      updatedAt: "2026-01-02T00:00:00.000Z",
      resumenIA: null,
      resumenIAGeneradoEn: null,
      ...overrides,
    };
  }

  it("hace falta cuando no hay resumen todavía", () => {
    expect(necesitaResumen(curso())).toBe(true);
  });

  // El caso que evita pagar dos veces por lo mismo.
  it("no hace falta si ya hay resumen y la descripción no ha cambiado desde entonces", () => {
    expect(
      necesitaResumen(
        curso({
          resumenIA: "Ya resumido.",
          resumenIAGeneradoEn: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        })
      )
    ).toBe(false);
  });

  it("hace falta regenerar si el curso ha cambiado después del último resumen", () => {
    expect(
      necesitaResumen(
        curso({
          resumenIA: "Resumen desactualizado.",
          resumenIAGeneradoEn: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-05T00:00:00.000Z",
        })
      )
    ).toBe(true);
  });

  it("no hace falta si la descripción es demasiado corta para merecer resumen", () => {
    expect(necesitaResumen(curso({ description: "Corta." }))).toBe(false);
  });

  it("el umbral de longitud es una frontera exacta: justo por debajo no, justo en el límite sí", () => {
    expect(
      necesitaResumen(curso({ description: "d".repeat(LONGITUD_MINIMA_DESCRIPCION - 1) }))
    ).toBe(false);
    expect(
      necesitaResumen(curso({ description: "d".repeat(LONGITUD_MINIMA_DESCRIPCION) }))
    ).toBe(true);
  });
});
