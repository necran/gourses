import { describe, expect, it } from "vitest";
import {
  PLAZO_NOVEDADES_DIAS,
  UMBRAL_NOVEDADES,
  descripcionNovedades,
  enlaceNovedades,
  fechaLegible,
  inicioDelPlazo,
  resumenNovedades,
  superaUmbralNovedades,
  textoNovedades,
  tituloNovedades,
  type Novedad,
} from "./novedades";

function novedad(overrides: Partial<Novedad> = {}): Novedad {
  return {
    id: "1",
    source: "udemy",
    title: "Curso",
    description: null,
    priceAmount: 14.99,
    priceCurrency: "EUR",
    rating: 4.5,
    language: "es",
    imageUrl: null,
    duration: null,
    publicadoEn: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("plazo", () => {
  it("empieza 90 días antes de ahora", () => {
    expect(PLAZO_NOVEDADES_DIAS).toBe(90);
    expect(inicioDelPlazo(new Date("2026-09-15T12:00:00Z")).toISOString()).toBe("2026-06-17T12:00:00.000Z");
  });
});

describe("textos y enlaces", () => {
  it("título, descripción y enlace", () => {
    expect(tituloNovedades()).toBe("Cursos nuevos en español");
    expect(descripcionNovedades(1542)).toMatch(/^1\.542 cursos en español publicados/);
    expect(descripcionNovedades(1)).toMatch(/^1 curso en español/);
    expect(descripcionNovedades(99999).length).toBeLessThanOrEqual(160);
  });

  it("la primera página no lleva ?pagina=1", () => {
    expect(enlaceNovedades()).toBe("/novedades");
    expect(enlaceNovedades(2)).toBe("/novedades?pagina=2");
  });
});

describe("fechaLegible", () => {
  it("escribe la fecha en español, con la hora de Madrid", () => {
    expect(fechaLegible("2017-07-03T17:39:15.000Z")).toBe("3 de julio de 2017");
    // A las 23:30 UTC ya es día siguiente en Madrid.
    expect(fechaLegible("2026-09-14T23:30:00.000Z")).toBe("15 de septiembre de 2026");
  });

  it("acepta fechas sin hora, sin que el huso las mueva de día", () => {
    expect(fechaLegible("2026-06-04")).toBe("4 de junio de 2026");
  });

  it("una fecha inválida no se escribe", () => {
    expect(fechaLegible("ayer")).toBeNull();
  });
});

describe("resumen, texto y umbral", () => {
  it("cuenta por plataforma y lo cuenta con datos", () => {
    const r = resumenNovedades([novedad(), novedad({ id: "2" }), novedad({ id: "3", source: "coursera" })]);
    expect(r).toEqual({ total: 3, porPlataforma: { udemy: 2, coursera: 1 } });
    expect(textoNovedades(r)).toBe(
      "En los últimos 90 días se han publicado 3 cursos nuevos en español: 2 de Udemy y 1 de Coursera. Las fechas son las que publica cada plataforma."
    );
  });

  it("sin cursos lo dice, no enseña un cero", () => {
    expect(textoNovedades(resumenNovedades([]))).toBe("No hay cursos en español publicados en los últimos 90 días.");
  });

  it("con una sola plataforma no habla de la otra", () => {
    expect(textoNovedades(resumenNovedades([novedad()]))).not.toContain("Coursera");
  });

  it("indexable a partir del mismo mínimo que los temas", () => {
    const con = (n: number) => resumenNovedades(Array.from({ length: n }, (_, i) => novedad({ id: String(i) })));
    expect(superaUmbralNovedades(con(UMBRAL_NOVEDADES))).toBe(true);
    expect(superaUmbralNovedades(con(UMBRAL_NOVEDADES - 1))).toBe(false);
  });

  it("nunca promete «gratis»", () => {
    expect(textoNovedades(resumenNovedades([novedad()])) + descripcionNovedades(5)).not.toMatch(/gratis/i);
  });
});
