import { describe, expect, it } from "vitest";
import {
  CESTA_VACIA,
  anadir,
  describirCambio,
  estaEnCesta,
  estaLlena,
  hrefComparar,
  leerCesta,
  nombreEnCesta,
  quitar,
  serializarCesta,
  vaciar,
  type Cesta,
} from "./cesta-comparar";
import { MAX_COMPARADOS, parseCompareIds } from "./compare";

const A = "a1b2c3d4-0000-4000-8000-000000000001";
const B = "a1b2c3d4-0000-4000-8000-000000000002";
const C = "a1b2c3d4-0000-4000-8000-000000000003";
const D = "a1b2c3d4-0000-4000-8000-000000000004";
const E = "a1b2c3d4-0000-4000-8000-000000000005";

const curso = (id: string, titulo = `Curso ${id.slice(-1)}`) => ({ id, titulo });
const llena: Cesta = [curso(A), curso(B), curso(C), curso(D)];

describe("leerCesta — lo guardado es entrada externa", () => {
  it.each([null, "", "{no es json", '{"id":"x"}', "42", "null"])(
    "%j da una cesta vacía, sin lanzar",
    (bruto) => {
      expect(leerCesta(bruto)).toEqual([]);
    }
  );

  it("lee una cesta bien formada, en su orden", () => {
    expect(leerCesta(serializarCesta([curso(B), curso(A)]))).toEqual([curso(B), curso(A)]);
  });

  it("descarta ids que no son de curso y elementos que no son objetos", () => {
    const bruto = JSON.stringify([
      { id: "no-soy-un-uuid", titulo: "x" },
      { id: 42, titulo: "x" },
      null,
      "texto",
      { titulo: "sin id" },
      curso(A),
    ]);
    expect(leerCesta(bruto)).toEqual([curso(A)]);
  });

  it("descarta repetidos, también si solo cambian mayúsculas", () => {
    const bruto = JSON.stringify([curso(A), { id: A.toUpperCase(), titulo: "otra" }]);
    expect(leerCesta(bruto)).toEqual([curso(A)]);
  });

  it(`recorta a ${MAX_COMPARADOS} cursos`, () => {
    const bruto = serializarCesta([...llena, curso(E)]);
    expect(leerCesta(bruto).map((c) => c.id)).toEqual([A, B, C, D]);
  });

  it("un título que no es texto se queda vacío; uno largo se recorta", () => {
    const bruto = JSON.stringify([
      { id: A, titulo: { html: "<b>" } },
      { id: B, titulo: `  ${"x".repeat(1000)}  ` },
    ]);
    const [a, b] = leerCesta(bruto);
    expect(a.titulo).toBe("");
    expect(b.titulo).toHaveLength(300);
  });
});

describe("anadir / quitar / vaciar", () => {
  it("añade al final", () => {
    expect(anadir([curso(A)], curso(B))).toEqual([curso(A), curso(B)]);
  });

  it("no cambia nada (misma cesta) si ya estaba, si está llena o si el id no vale", () => {
    const una: Cesta = [curso(A)];
    expect(anadir(una, curso(A))).toBe(una);
    expect(anadir(llena, curso(E))).toBe(llena);
    expect(anadir(una, curso("no-soy-un-uuid"))).toBe(una);
  });

  it("quita sin distinguir mayúsculas y devuelve la vacía compartida al quitar el último", () => {
    expect(quitar([curso(A), curso(B)], A.toUpperCase())).toEqual([curso(B)]);
    expect(quitar([curso(A)], A)).toBe(CESTA_VACIA);
  });

  it("quitar uno que no está devuelve la misma cesta", () => {
    const una: Cesta = [curso(A)];
    expect(quitar(una, B)).toBe(una);
  });

  it("vaciar deja la cesta vacía, y no cambia nada si ya lo estaba", () => {
    expect(vaciar(llena)).toEqual([]);
    expect(vaciar(CESTA_VACIA)).toBe(CESTA_VACIA);
  });

  it("estaEnCesta y estaLlena", () => {
    expect(estaEnCesta([curso(A)], A.toUpperCase())).toBe(true);
    expect(estaEnCesta([curso(A)], B)).toBe(false);
    expect(estaLlena(llena)).toBe(true);
    expect(estaLlena([curso(A)])).toBe(false);
  });
});

describe("hrefComparar", () => {
  it("sin cursos lleva a /comparar, que ya explica qué hacer", () => {
    expect(hrefComparar(CESTA_VACIA)).toBe("/comparar");
  });

  it("lleva los ids en el orden de la cesta, y /comparar los lee igual", () => {
    const href = hrefComparar([curso(B), curso(A)]);
    expect(href).toBe(`/comparar?ids=${B},${A}`);
    const ids = new URL(href, "https://gourses.com").searchParams.get("ids") ?? undefined;
    expect(parseCompareIds(ids)).toEqual([B, A]);
  });
});

describe("describirCambio", () => {
  it("anuncia lo añadido y cuántos van", () => {
    expect(describirCambio([curso(A, "Python")], [curso(A, "Python"), curso(B, "Rust")])).toBe(
      `Añadido a la comparación: Rust. Llevas 2 de ${MAX_COMPARADOS}.`
    );
  });

  it("anuncia lo quitado, también el último", () => {
    expect(describirCambio([curso(A, "Python")], CESTA_VACIA)).toBe(
      `Quitado de la comparación: Python. Llevas 0 de ${MAX_COMPARADOS}.`
    );
  });

  it("anuncia el vaciado de varios de golpe", () => {
    expect(describirCambio(llena, CESTA_VACIA)).toBe("Se ha vaciado la selección para comparar.");
  });

  it("no anuncia nada si no ha cambiado", () => {
    expect(describirCambio(llena, llena)).toBe("");
  });

  it("un cambio de varios a la vez se resume", () => {
    expect(describirCambio([curso(A)], [curso(B), curso(C)])).toBe(
      `Selección para comparar actualizada. Llevas 2 de ${MAX_COMPARADOS}.`
    );
  });

  it("un curso sin título se nombra igualmente", () => {
    expect(nombreEnCesta({ id: A, titulo: "" })).toBe("Curso sin título");
  });
});
