import { describe, expect, it } from "vitest";
import {
  agregarRecuentos,
  descripcionTema,
  enlaceTema,
  resumenTema,
  textoPresentacion,
  tituloTema,
  type CursoDeTema,
} from "./temas-datos";
import { RESENAS_MINIMAS, TEMAS } from "./temas";

function curso(overrides: Partial<CursoDeTema> = {}): CursoDeTema {
  return {
    id: "1",
    source: "udemy",
    title: "Curso",
    description: null,
    priceAmount: 14.99,
    priceCurrency: "EUR",
    rating: 4.5,
    numReviews: 100,
    level: null,
    language: "es",
    imageUrl: null,
    duration: { minMinutes: 600, maxMinutes: 600 },
    ...overrides,
  };
}

describe("títulos, descripciones y enlaces", () => {
  it("el título dice el tema y el idioma", () => {
    expect(tituloTema("python")).toBe("Cursos de Python en español");
    expect(tituloTema("power-bi")).toBe("Cursos de Power BI en español");
  });

  it("un tema que es nombre común va en minúscula en el título", () => {
    expect(tituloTema("inteligencia-artificial")).toBe("Cursos de inteligencia artificial en español");
  });

  it("la descripción lleva el número de cursos y no pasa de 160 caracteres en ningún tema", () => {
    expect(descripcionTema("excel", 50)).toContain("50 cursos de Excel en español");
    expect(descripcionTema("excel", 1)).toContain("1 curso de Excel");
    for (const tema of TEMAS) expect(descripcionTema(tema, 12345).length).toBeLessThanOrEqual(160);
  });

  it("la primera página no lleva ?pagina=1", () => {
    expect(enlaceTema("sql")).toBe("/cursos/sql");
    expect(enlaceTema("sql", 1)).toBe("/cursos/sql");
    expect(enlaceTema("sql", 3)).toBe("/cursos/sql?pagina=3");
  });
});

describe("resumenTema", () => {
  it("cuenta por plataforma y guarda el total de todos los idiomas", () => {
    const r = resumenTema([curso(), curso({ id: "2", source: "coursera", rating: null, priceAmount: null, priceCurrency: null })], 10);
    expect(r).toMatchObject({ enEspanol: 2, total: 10, porPlataforma: { udemy: 1, coursera: 1 } });
  });

  it("la valoración media es solo de Udemy, con un decimal", () => {
    const r = resumenTema(
      [curso({ rating: 4.2 }), curso({ id: "2", rating: 4.9 }), curso({ id: "3", source: "coursera", rating: null })],
      3
    );
    expect(r.valoracionMediaUdemy).toBe(4.6);
  });

  it("sin valoraciones, no hay media (no un cero)", () => {
    expect(resumenTema([curso({ rating: null })], 1).valoracionMediaUdemy).toBeNull();
  });

  it("la duración típica es la mediana del punto medio de cada rango", () => {
    const r = resumenTema(
      [
        curso({ duration: { minMinutes: 60, maxMinutes: 60 } }),
        curso({ id: "2", duration: { minMinutes: 100, maxMinutes: 300 } }),
        curso({ id: "3", duration: { minMinutes: 900, maxMinutes: 900 } }),
        curso({ id: "4", duration: null }),
      ],
      4
    );
    expect(r.duracionMedianaMinutos).toBe(200);
  });

  it("el precio habitual y el más bajo, en la moneda más frecuente, sin mezclar monedas", () => {
    const r = resumenTema(
      [
        curso({ priceAmount: 14.99 }),
        curso({ id: "2", priceAmount: 14.99 }),
        curso({ id: "3", priceAmount: 12.99 }),
        curso({ id: "4", priceAmount: 1.99, priceCurrency: "USD" }),
      ],
      4
    );
    expect(r.precio).toEqual({ habitual: 14.99, desde: 12.99, moneda: "EUR" });
  });

  it("el recuento para el umbral cuenta cursos con suficientes reseñas", () => {
    const r = resumenTema(
      [curso({ numReviews: RESENAS_MINIMAS }), curso({ id: "2", numReviews: RESENAS_MINIMAS - 1 }), curso({ id: "3", numReviews: null })],
      3
    );
    expect(r.recuento).toEqual({ enEspanol: 3, enEspanolConResenas: 1 });
  });
});

describe("textoPresentacion", () => {
  const completo = resumenTema(
    [
      curso({ priceAmount: 14.99 }),
      curso({ id: "2", priceAmount: 12.99, rating: 4.7 }),
      curso({ id: "3", source: "coursera", rating: null, priceAmount: null, priceCurrency: null }),
    ],
    9
  );

  it("cuenta cursos, plataformas, valoración, duración y precio con datos", () => {
    const texto = textoPresentacion("python", completo).join(" ");
    expect(texto).toContain("Hay 3 cursos de Python en español (9 contando todos los idiomas): 2 de Udemy y 1 de Coursera.");
    expect(texto).toContain("valoración media de 4,6 sobre 5; Coursera no publica valoraciones.");
    expect(texto).toContain("La duración típica ronda 10 h.");
    expect(texto).toContain("El precio más habitual es 14,99 €, y los hay desde 12,99 €");
  });

  it("nunca promete «gratis»", () => {
    for (const tema of TEMAS) expect(textoPresentacion(tema, completo).join(" ")).not.toMatch(/gratis|gratuit/i);
  });

  it("omite la frase de un dato que no existe, en vez de decir «0»", () => {
    const sinDatos = resumenTema([curso({ rating: null, duration: null, priceAmount: null, priceCurrency: null })], 1);
    const texto = textoPresentacion("yoga", sinDatos);
    expect(texto).toEqual(["Hay 1 curso de yoga en español."]);
  });

  it("las cifras de cuatro dígitos llevan punto de miles, como en el resto del sitio", () => {
    const grande = resumenTema([curso()], 1542);
    expect(textoPresentacion("excel", grande)[0]).toContain("(1.542 contando todos los idiomas)");
  });

  it("sin cursos de Coursera no habla de Coursera", () => {
    const soloUdemy = resumenTema([curso()], 1);
    expect(textoPresentacion("excel", soloUdemy).join(" ")).not.toContain("Coursera");
  });
});

describe("agregarRecuentos", () => {
  it("cuenta por tema solo los cursos en español, y los que tienen reseñas", () => {
    const recuentos = agregarRecuentos([
      { temas: ["python", "trading"], language: "es", num_reviews: 500 },
      { temas: ["python"], language: "es", num_reviews: 3 },
      { temas: ["python"], language: "en", num_reviews: 9000 },
      { temas: ["tema-retirado"], language: "es", num_reviews: 100 },
      { temas: null, language: "es", num_reviews: 100 },
    ]);
    expect(recuentos.get("python")).toEqual({ enEspanol: 2, enEspanolConResenas: 1 });
    expect(recuentos.get("trading")).toEqual({ enEspanol: 1, enEspanolConResenas: 1 });
    expect(recuentos.get("excel")).toEqual({ enEspanol: 0, enEspanolConResenas: 0 });
    expect(recuentos.size).toBe(TEMAS.length);
  });
});
