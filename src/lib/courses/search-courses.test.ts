import { describe, expect, it } from "vitest";
import { escapeOrFilterValue } from "./search-courses";

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
