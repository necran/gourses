import { describe, expect, it } from "vitest";
import { escapeOrFilterValue, interleaveBySource } from "./search-courses";
import type { CourseSearchResult } from "./search-courses";

function curso(source: string, n: number): CourseSearchResult {
  return {
    id: `${source}-${n}`,
    source: source as CourseSearchResult["source"],
    title: `${source} ${n}`,
    description: null,
    priceAmount: null,
    priceCurrency: null,
    rating: null,
    language: null,
    imageUrl: null,
    affiliateUrl: null,
  };
}

describe("escapeOrFilterValue", () => {
  it("deja intacto un texto de búsqueda normal", () => {
    expect(escapeOrFilterValue("python para principiantes")).toBe(
      "python para principiantes"
    );
  });

  it("escapa coma y paréntesis, que PostgREST interpreta como sintaxis de filtro", () => {
    expect(escapeOrFilterValue("curso (avanzado), nivel 2")).toBe(
      "curso \\(avanzado\\)\\, nivel 2"
    );
  });
});

describe("interleaveBySource", () => {
  it("alterna una fuente y otra, conservando el orden dentro de cada una", () => {
    const udemy = [curso("udemy", 1), curso("udemy", 2), curso("udemy", 3)];
    const coursera = [curso("coursera", 1), curso("coursera", 2), curso("coursera", 3)];

    expect(interleaveBySource([udemy, coursera], 6).map((c) => c.id)).toEqual([
      "udemy-1",
      "coursera-1",
      "udemy-2",
      "coursera-2",
      "udemy-3",
      "coursera-3",
    ]);
  });

  // Es el caso que motivó el cambio: sin intercalar, los 312 cursos de Udemy
  // (todos con valoración) dejaban fuera de la página a los 100 de Coursera
  // (ninguno con valoración).
  it("garantiza presencia de la fuente pequeña aunque la otra tenga muchos más", () => {
    const udemy = Array.from({ length: 50 }, (_, i) => curso("udemy", i));
    const coursera = Array.from({ length: 5 }, (_, i) => curso("coursera", i));

    const resultado = interleaveBySource([udemy, coursera], 10);

    expect(resultado.filter((c) => c.source === "coursera")).toHaveLength(5);
    expect(resultado.filter((c) => c.source === "udemy")).toHaveLength(5);
  });

  it("completa con la fuente que queda cuando la otra se agota", () => {
    const udemy = [curso("udemy", 1), curso("udemy", 2), curso("udemy", 3)];
    const coursera = [curso("coursera", 1)];

    expect(interleaveBySource([udemy, coursera], 10).map((c) => c.id)).toEqual([
      "udemy-1",
      "coursera-1",
      "udemy-2",
      "udemy-3",
    ]);
  });

  it("respeta el límite total", () => {
    const udemy = Array.from({ length: 30 }, (_, i) => curso("udemy", i));
    const coursera = Array.from({ length: 30 }, (_, i) => curso("coursera", i));

    expect(interleaveBySource([udemy, coursera], 7)).toHaveLength(7);
  });

  it("no rompe si una fuente no devuelve nada", () => {
    const udemy = [curso("udemy", 1), curso("udemy", 2)];

    expect(interleaveBySource([udemy, []], 10).map((c) => c.id)).toEqual(["udemy-1", "udemy-2"]);
  });

  it("devuelve lista vacía si no hay resultados en ninguna fuente", () => {
    expect(interleaveBySource([[], []], 10)).toEqual([]);
  });
});
