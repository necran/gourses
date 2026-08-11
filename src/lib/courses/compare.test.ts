import { describe, expect, it } from "vitest";
import { MAX_COMPARADOS, buildCompareRows, parseCompareIds } from "./compare";
import type { CourseDetail } from "./get-course";

const A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const B = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const C = "11111111-2222-4333-8444-555555555555";
const D = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const E = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

function curso(overrides: Partial<CourseDetail> = {}): CourseDetail {
  return {
    id: A,
    source: "udemy",
    title: "Curso de prueba",
    description: null,
    priceAmount: 19.99,
    priceCurrency: "EUR",
    rating: 4.5,
    level: "Beginner",
    language: "es",
    instructor: "Alguien",
    imageUrl: null,
    affiliateUrl: null,
    category: "desarrollo",
    duration: { minMinutes: 120, maxMinutes: 120 },
    priceHistory: [],
    ...overrides,
  };
}

describe("parseCompareIds", () => {
  it("acepta identificadores repetidos en la dirección", () => {
    expect(parseCompareIds([A, B])).toEqual([A, B]);
  });

  it("acepta también una lista separada por comas", () => {
    expect(parseCompareIds(`${A},${B}`)).toEqual([A, B]);
  });

  it("descarta los duplicados conservando el orden", () => {
    expect(parseCompareIds([A, B, A])).toEqual([A, B]);
  });

  it("no distingue mayúsculas al detectar duplicados", () => {
    expect(parseCompareIds([A, A.toUpperCase()])).toEqual([A]);
  });

  // Un enlace compartido con un curso retirado debe seguir comparando el resto.
  it("descarta los identificadores mal formados y conserva los válidos", () => {
    expect(parseCompareIds([A, "no-soy-un-uuid", B])).toEqual([A, B]);
  });

  it("recorta al máximo comparable", () => {
    const ids = parseCompareIds([A, B, C, D, E]);
    expect(ids).toHaveLength(MAX_COMPARADOS);
    expect(ids).toEqual([A, B, C, D]);
  });

  it("devuelve lista vacía cuando no hay nada utilizable", () => {
    expect(parseCompareIds(undefined)).toEqual([]);
    expect(parseCompareIds("")).toEqual([]);
    expect(parseCompareIds(["", "  ", "x"])).toEqual([]);
  });

  it("no deja pasar intentos de inyección por la dirección", () => {
    expect(parseCompareIds(["' or 1=1 --", "*", "id.neq.0"])).toEqual([]);
  });
});

describe("buildCompareRows", () => {
  it("crea una celda por curso, en el mismo orden", () => {
    const filas = buildCompareRows([
      curso({ title: "Uno", priceAmount: 10 }),
      curso({ title: "Dos", priceAmount: 20 }),
    ]);
    const precio = filas.find((f) => f.etiqueta === "Precio")!;

    expect(precio.celdas).toHaveLength(2);
    expect(precio.celdas[0].valor).toBe("10 EUR");
    expect(precio.celdas[1].valor).toBe("20 EUR");
  });

  // El caso que motiva la historia: comparar plataformas distintas.
  it("deja el hueco explícito cuando un curso no tiene un dato y otro sí", () => {
    const filas = buildCompareRows([
      curso({ source: "udemy", priceAmount: 19.99, priceCurrency: "EUR" }),
      curso({ source: "coursera", priceAmount: null, priceCurrency: null }),
    ]);
    const precio = filas.find((f) => f.etiqueta === "Precio")!;

    expect(precio.celdas[0].valor).toBe("19.99 EUR");
    // null, no "0" ni "-": un cero se leería como "gratis".
    expect(precio.celdas[1].valor).toBeNull();
  });

  it("omite una fila que ningún curso puede rellenar", () => {
    const filas = buildCompareRows([
      curso({ rating: null, instructor: null }),
      curso({ rating: null, instructor: null }),
    ]);

    expect(filas.find((f) => f.etiqueta === "Valoración")).toBeUndefined();
    expect(filas.find((f) => f.etiqueta === "Imparte")).toBeUndefined();
  });

  it("muestra siempre la plataforma, que es lo que distingue el origen", () => {
    const filas = buildCompareRows([
      curso({ source: "udemy" }),
      curso({ source: "coursera" }),
    ]);
    const plataforma = filas.find((f) => f.etiqueta === "Plataforma")!;

    expect(plataforma.celdas.map((c) => c.valor)).toEqual(["Udemy", "Coursera"]);
  });

  it("muestra la categoría con su nombre legible, no el identificador interno", () => {
    const filas = buildCompareRows([curso({ category: "datos-e-ia" })]);
    const categoria = filas.find((f) => f.etiqueta === "Categoría")!;

    expect(categoria.celdas[0].valor).toBe("Datos e IA");
  });

  it("no rompe con un solo curso ni con ninguno", () => {
    expect(buildCompareRows([curso()]).length).toBeGreaterThan(0);
    expect(buildCompareRows([])).toEqual([]);
  });
});
