import { describe, expect, it } from "vitest";
import { DIMENSIONES_MINIATURA, MINIATURAS_INMEDIATAS, cargaDeMiniatura } from "./imagenes";

describe("cargaDeMiniatura (HU-050)", () => {
  it("las primeras miniaturas se cargan de inmediato", () => {
    for (let i = 0; i < MINIATURAS_INMEDIATAS; i++) expect(cargaDeMiniatura(i)).toBe("eager");
  });

  it("a partir de ahí se difieren", () => {
    expect(cargaDeMiniatura(MINIATURAS_INMEDIATAS)).toBe("lazy");
    expect(cargaDeMiniatura(49)).toBe("lazy");
  });

  // Que se difieran casi todas es el objetivo, pero no todas: una imagen que se
  // ve al entrar y llega tarde empeora la carga en vez de mejorarla.
  it("no difiere ninguna de las que se ven al entrar, ni carga de golpe una página entera", () => {
    expect(MINIATURAS_INMEDIATAS).toBeGreaterThan(0);
    expect(MINIATURAS_INMEDIATAS).toBeLessThan(50);
  });

  it("las dimensiones reservan un hueco con la proporción de las imágenes de Udemy", () => {
    expect(DIMENSIONES_MINIATURA.width / DIMENSIONES_MINIATURA.height).toBeCloseTo(16 / 9, 2);
  });
});
