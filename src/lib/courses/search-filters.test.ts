import { describe, expect, it } from "vitest";
import { parseCourseSearchFilters } from "./search-filters";

describe("parseCourseSearchFilters", () => {
  it("combina palabra clave, precio, valoración e idioma cuando todos son válidos", () => {
    const filters = parseCourseSearchFilters({
      keyword: "  python  ",
      maxPrice: "49.99",
      minRating: "4",
      language: " es ",
    });

    expect(filters).toEqual({
      keyword: "python",
      category: null,
      maxPrice: 49.99,
      minRating: 4,
      language: "es",
    });
  });

  it("devuelve todo a null cuando no se pasa ningún parámetro", () => {
    expect(parseCourseSearchFilters({})).toEqual({
      keyword: null,
      category: null,
      maxPrice: null,
      minRating: null,
      language: null,
    });
  });

  it("descarta una palabra clave vacía o solo espacios", () => {
    expect(parseCourseSearchFilters({ keyword: "   " }).keyword).toBeNull();
  });

  it("recorta una palabra clave desproporcionadamente larga", () => {
    const filters = parseCourseSearchFilters({ keyword: "a".repeat(500) });
    expect(filters.keyword).toHaveLength(200);
  });

  it("descarta un precio máximo negativo o no numérico", () => {
    expect(parseCourseSearchFilters({ maxPrice: "-5" }).maxPrice).toBeNull();
    expect(parseCourseSearchFilters({ maxPrice: "gratis" }).maxPrice).toBeNull();
  });

  it("trata una cadena vacía como ausencia de filtro, no como cero", () => {
    expect(parseCourseSearchFilters({ maxPrice: "", minRating: "" })).toEqual(
      expect.objectContaining({ maxPrice: null, minRating: null })
    );
  });

  it("acepta precio máximo cero", () => {
    expect(parseCourseSearchFilters({ maxPrice: "0" }).maxPrice).toBe(0);
  });

  it("recorta una valoración mínima por encima del máximo posible (5)", () => {
    expect(parseCourseSearchFilters({ minRating: "999" }).minRating).toBe(5);
  });

  it("descarta una valoración mínima negativa", () => {
    expect(parseCourseSearchFilters({ minRating: "-1" }).minRating).toBeNull();
  });

  it("toma el primer valor cuando un parámetro llega repetido", () => {
    expect(parseCourseSearchFilters({ keyword: ["primero", "segundo"] }).keyword).toBe("primero");
  });

  it("ignora intentos de inyección tratándolos como texto de búsqueda normal", () => {
    const filters = parseCourseSearchFilters({ keyword: "'; drop table courses; --" });
    expect(filters.keyword).toBe("'; drop table courses; --");
  });

  // HU-022: la portada enlazaba por la etiqueta visible ("Desarrollo") como
  // texto libre, y como los títulos del catálogo están en inglés, las seis
  // categorías llevaban a una página vacía. Se filtra por el identificador
  // estable, y solo si es uno conocido.
  describe("categoría", () => {
    it("acepta un identificador del vocabulario", () => {
      expect(parseCourseSearchFilters({ category: "desarrollo" }).category).toBe("desarrollo");
      expect(parseCourseSearchFilters({ category: "datos-e-ia" }).category).toBe("datos-e-ia");
    });

    it("tolera espacios y mayúsculas", () => {
      expect(parseCourseSearchFilters({ category: "  Desarrollo  " }).category).toBe("desarrollo");
    });

    it("descarta la etiqueta visible, que no es el identificador", () => {
      expect(parseCourseSearchFilters({ category: "Datos e IA" }).category).toBeNull();
      expect(parseCourseSearchFilters({ category: "IT y software" }).category).toBeNull();
    });

    it("descarta una categoría inventada en vez de romper la búsqueda", () => {
      for (const raw of ["", "   ", "no-existe", "'; drop table courses--", "*"]) {
        expect(parseCourseSearchFilters({ category: raw }).category).toBeNull();
      }
    });

    it("sin categoría en la dirección, no se filtra", () => {
      expect(parseCourseSearchFilters({}).category).toBeNull();
    });
  });
});
