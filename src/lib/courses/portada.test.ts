import { describe, expect, it } from "vitest";
import { CATEGORIAS_EN_PORTADA, TEMAS_EN_PORTADA, primeros, quedanMas } from "./portada";
import { COURSE_CATEGORIES } from "./categories";

describe("cuánto se enseña en la portada (HU-070)", () => {
  it("son menos categorías de las que hay, o no habría nada que recortar", () => {
    expect(CATEGORIAS_EN_PORTADA).toBeLessThan(COURSE_CATEGORIES.length);
    expect(CATEGORIAS_EN_PORTADA).toBeGreaterThan(0);
    expect(TEMAS_EN_PORTADA).toBeGreaterThan(0);
  });

  it("recorta sin reordenar", () => {
    expect(primeros(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
  });

  it("si hay menos de los que caben, se enseñan todos", () => {
    expect(primeros(["a", "b"], 6)).toEqual(["a", "b"]);
    expect(quedanMas(["a", "b"], 6)).toBe(false);
  });

  it("«ver todas» solo se ofrece cuando de verdad queda algo fuera", () => {
    expect(quedanMas(["a", "b", "c"], 2)).toBe(true);
    expect(quedanMas(["a", "b"], 2)).toBe(false);
    expect(quedanMas([], 2)).toBe(false);
  });

  it("con las once categorías reales, se recortan y queda resto", () => {
    expect(primeros(COURSE_CATEGORIES, CATEGORIAS_EN_PORTADA)).toHaveLength(CATEGORIAS_EN_PORTADA);
    expect(quedanMas(COURSE_CATEGORIES, CATEGORIAS_EN_PORTADA)).toBe(true);
  });
});
