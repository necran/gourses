import { describe, expect, it } from "vitest";
import { enlacePagina } from "./buscar-enlaces";
import { parseCourseSearchFilters } from "./search-filters";

// El enlace se arma con los filtros **ya saneados**, no con lo que venía en la
// dirección. Lo que se prueba aquí es que no se pierda ninguno por el camino:
// perder un filtro al pasar de página es el fallo clásico de esta función, y
// no se ve hasta que alguien pulsa «Siguiente».

const filtros = (params: Record<string, string>) => parseCourseSearchFilters(params);

describe("enlacePagina", () => {
  it("sin filtros ni página es /buscar a secas", () => {
    expect(enlacePagina(filtros({}), 1)).toBe("/buscar");
  });

  it("la primera página no lleva número: sería otra dirección para lo mismo", () => {
    expect(enlacePagina(filtros({ keyword: "python" }), 1)).toBe("/buscar?keyword=python");
    expect(enlacePagina(filtros({ keyword: "python" }), 2)).toBe(
      "/buscar?keyword=python&pagina=2"
    );
  });

  it("conserva todos los filtros al cambiar de página", () => {
    const href = enlacePagina(
      filtros({
        keyword: "data",
        maxPrice: "20",
        minRating: "4",
        maxDuration: "3",
        language: "es",
        category: "datos-e-ia",
        sinDato: "1",
        orden: "duracion-asc",
      }),
      3
    );

    const params = new URL(href, "https://gourses.com").searchParams;
    expect(Object.fromEntries(params)).toEqual({
      keyword: "data",
      maxPrice: "20",
      minRating: "4",
      maxDuration: "3",
      language: "es",
      category: "datos-e-ia",
      sinDato: "1",
      orden: "duracion-asc",
      pagina: "3",
    });
  });

  // De cara a la persona la duración va en horas; por dentro son minutos
  // (HU-048). Al reconstruir el enlace tiene que volver a salir en horas, o
  // cada paso de página multiplicaría el filtro por sesenta.
  it("la duración vuelve a la dirección en horas, no en minutos", () => {
    expect(enlacePagina(filtros({ maxDuration: "2.5" }), 1)).toBe("/buscar?maxDuration=2.5");
    expect(enlacePagina(filtros({ maxDuration: "1" }), 2)).toBe(
      "/buscar?maxDuration=1&pagina=2"
    );
  });

  it("un filtro inventado o mal escrito no viaja en el enlace", () => {
    const href = enlacePagina(filtros({ maxDuration: "-3", orden: "lo-que-sea", nada: "x" }), 1);
    expect(href).toBe("/buscar");
  });
});
