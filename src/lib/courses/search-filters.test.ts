import { describe, expect, it } from "vitest";
import { MAX_PAGINA, parseCourseSearchFilters } from "./search-filters";

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
      pagina: 1,
    });
  });

  it("devuelve todo a null cuando no se pasa ningún parámetro", () => {
    expect(parseCourseSearchFilters({})).toEqual({
      keyword: null,
      category: null,
      maxPrice: null,
      minRating: null,
      language: null,
      // La página es el único filtro que no puede ser nulo: siempre se está
      // mirando alguna, y sin parámetro se mira la primera.
      pagina: 1,
    });
  });

  describe("página (HU-025)", () => {
    it("sin parámetro empieza por la primera", () => {
      expect(parseCourseSearchFilters({}).pagina).toBe(1);
    });

    it("acepta una página válida", () => {
      expect(parseCourseSearchFilters({ pagina: "7" }).pagina).toBe(7);
    });

    // Una dirección compartida con la página estropeada tiene que seguir
    // enseñando cursos: se vuelve a la primera en vez de romper o vaciar.
    it.each(["0", "-3", "abc", "2.5", "", "   ", "Infinity", "NaN"])(
      "vuelve a la primera con %j",
      (raw) => {
        expect(parseCourseSearchFilters({ pagina: raw }).pagina).toBe(1);
      }
    );

    // "1e3" es 1000 y se admite como tal: no es basura, es la misma página
    // escrita de otra forma. Acaba recortada por el tope, como cualquier 1000.
    it("lee la notación exponencial como el número que es", () => {
      expect(parseCourseSearchFilters({ pagina: "1e3" }).pagina).toBe(MAX_PAGINA);
      expect(parseCourseSearchFilters({ pagina: "1e1" }).pagina).toBe(10);
    });

    // El tope no es de producto: acota lo que puede pedir un extraño, porque la
    // consulta trae los resultados hasta el final de la página pedida.
    it("recorta una página desproporcionada al tope", () => {
      expect(parseCourseSearchFilters({ pagina: "99999999" }).pagina).toBe(MAX_PAGINA);
    });

    it("se queda con el primer valor si llega repetida", () => {
      expect(parseCourseSearchFilters({ pagina: ["3", "9"] }).pagina).toBe(3);
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
