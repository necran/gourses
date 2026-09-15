import { describe, expect, it } from "vitest";
import {
  IDIOMAS_DEL_FILTRO,
  filtrosPlegadosAplicados,
  nombreIdioma,
  nombrePlataforma,
  opcionesIdioma,
  valorIdiomaSeleccionado,
} from "./presentacion";
import { parseCourseSearchFilters } from "./search-filters";

describe("nombrePlataforma", () => {
  it("nombra las plataformas conocidas como se escriben", () => {
    expect(nombrePlataforma("udemy")).toBe("Udemy");
    expect(nombrePlataforma("coursera")).toBe("Coursera");
  });

  it("una plataforma desconocida se enseña tal cual", () => {
    expect(nombrePlataforma("edx")).toBe("edx");
  });
});

describe("nombreIdioma", () => {
  it("da el nombre en español, con mayúscula inicial", () => {
    expect(nombreIdioma("es")).toBe("Español");
    expect(nombreIdioma("en")).toBe("Inglés");
    expect(nombreIdioma("pt-BR")).toBe("Portugués de Brasil");
  });

  it("no distingue mayúsculas en el código", () => {
    expect(nombreIdioma("ES")).toBe("Español");
  });

  it("un código que no conoce se enseña tal cual", () => {
    expect(nombreIdioma("xx")).toBe("xx");
  });

  // Viene de la base o de la dirección: nunca debe tumbar la página.
  it("un código mal formado se enseña tal cual, sin lanzar", () => {
    expect(nombreIdioma("no es un código!")).toBe("no es un código!");
    expect(nombreIdioma("")).toBe("");
  });
});

describe("opcionesIdioma", () => {
  it("empieza por español e inglés y nombra cada opción", () => {
    const opciones = opcionesIdioma(null);
    expect(opciones.slice(0, 2)).toEqual([
      { valor: "es", nombre: "Español" },
      { valor: "en", nombre: "Inglés" },
    ]);
    expect(opciones).toHaveLength(IDIOMAS_DEL_FILTRO.length);
  });

  it("añade el idioma de la dirección si no está en la lista, para no perderlo", () => {
    const opciones = opcionesIdioma("ca");
    expect(opciones.at(-1)).toEqual({ valor: "ca", nombre: "Catalán" });
  });

  it("no duplica un idioma que ya está, aunque venga en otras mayúsculas", () => {
    expect(opcionesIdioma("ES")).toHaveLength(IDIOMAS_DEL_FILTRO.length);
  });
});

describe("valorIdiomaSeleccionado", () => {
  it("sin idioma, la opción «todos»", () => {
    expect(valorIdiomaSeleccionado(null)).toBe("");
  });

  it("encaja con la opción de la lista aunque cambien las mayúsculas", () => {
    expect(valorIdiomaSeleccionado("ES")).toBe("es");
    expect(valorIdiomaSeleccionado("pt-br")).toBe("pt-BR");
  });

  it("un idioma fuera de la lista se conserva tal cual", () => {
    expect(valorIdiomaSeleccionado("ca")).toBe("ca");
  });
});

describe("filtrosPlegadosAplicados", () => {
  it("sin filtros, cero", () => {
    expect(filtrosPlegadosAplicados(parseCourseSearchFilters({}))).toBe(0);
  });

  it("la palabra clave no cuenta: se ve siempre", () => {
    expect(filtrosPlegadosAplicados(parseCourseSearchFilters({ keyword: "python" }))).toBe(0);
  });

  it("cuenta cada filtro plegado aplicado, orden incluido", () => {
    expect(
      filtrosPlegadosAplicados(
        parseCourseSearchFilters({
          maxPrice: "20",
          minRating: "4",
          maxDuration: "10",
          language: "es",
          category: "desarrollo",
          orden: "precio-asc",
        })
      )
    ).toBe(6);
  });

  it("un filtro inválido no cuenta, porque no se aplica", () => {
    expect(filtrosPlegadosAplicados(parseCourseSearchFilters({ maxPrice: "gratis" }))).toBe(0);
  });
});
