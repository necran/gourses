import { describe, expect, it } from "vitest";
import {
  descripcionCategoria,
  enlaceCategoria,
  esCategoria,
  tituloCategoria,
} from "./categoria-seo";
import { COURSE_CATEGORIES } from "./categories";

describe("esCategoria — el identificador viene de la dirección", () => {
  it("acepta las categorías del catálogo", () => {
    for (const categoria of COURSE_CATEGORIES) expect(esCategoria(categoria)).toBe(true);
  });

  it.each([
    undefined,
    "",
    "  ",
    "inventada",
    "Desarrollo",
    "desarrollo ",
    "../../etc/passwd",
    "desarrollo' or 1=1 --",
  ])("rechaza %j", (slug) => {
    expect(esCategoria(slug)).toBe(false);
  });
});

describe("tituloCategoria", () => {
  it("nombra la categoría, no el sitio", () => {
    expect(tituloCategoria("diseno-y-creatividad")).toBe("Cursos de Diseño y creatividad");
  });

  it("conserva la forma de las siglas", () => {
    expect(tituloCategoria("it-y-software")).toBe("Cursos de IT y software");
  });

  it("cada categoría tiene un título distinto", () => {
    const titulos = COURSE_CATEGORIES.map(tituloCategoria);
    expect(new Set(titulos).size).toBe(COURSE_CATEGORIES.length);
  });
});

describe("descripcionCategoria", () => {
  it("dice cuántos cursos hay y de dónde salen", () => {
    expect(descripcionCategoria("idiomas", 56)).toBe(
      "Compara 56 cursos de Idiomas de Udemy y Coursera: precio, valoración, duración e idioma, uno al lado del otro."
    );
  });

  // En español, los números de cuatro cifras se escriben sin separador (2812) y
  // a partir de cinco sí lo llevan (15.744). Es lo que hace `toLocaleString`
  // con "es-ES", y conviene dejarlo fijado: escribir "2.812" sería incorrecto.
  it("agrupa los miles como se escriben en español", () => {
    expect(descripcionCategoria("negocios", 2812)).toContain("2812 cursos");
    expect(descripcionCategoria("negocios", 15744)).toContain("15.744 cursos");
  });

  it("con un solo curso no dice «1 cursos»", () => {
    expect(descripcionCategoria("idiomas", 1)).toContain("Compara 1 curso de");
  });

  it("nunca pasa de lo que Google enseña", () => {
    for (const categoria of COURSE_CATEGORIES) {
      expect(descripcionCategoria(categoria, 999_999).length).toBeLessThanOrEqual(160);
    }
  });
});

describe("enlaceCategoria", () => {
  it("la primera página no lleva número: sería otra dirección para lo mismo", () => {
    expect(enlaceCategoria("desarrollo")).toBe("/categoria/desarrollo");
    expect(enlaceCategoria("desarrollo", 1)).toBe("/categoria/desarrollo");
  });

  it("las demás sí, para poder compartirlas", () => {
    expect(enlaceCategoria("desarrollo", 3)).toBe("/categoria/desarrollo?pagina=3");
  });
});
