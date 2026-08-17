import { describe, expect, it } from "vitest";
import { decidirAviso, type CandidatoAviso } from "./detectar";

// Base: bajada clara de 20 a 15 EUR, nunca avisada.
function candidato(cambios: Partial<CandidatoAviso> = {}): CandidatoAviso {
  return {
    precioActual: 15,
    divisaActual: "EUR",
    precioAnterior: 20,
    divisaAnterior: "EUR",
    precioYaAvisado: null,
    divisaYaAvisada: null,
    ...cambios,
  };
}

describe("HU-021 — decidir si se avisa de una bajada", () => {
  it("avisa de una bajada clara, diciendo de cuánto a cuánto", () => {
    expect(decidirAviso(candidato())).toEqual({
      avisar: true,
      precioAnterior: 20,
      precioActual: 15,
      divisa: "EUR",
    });
  });

  it("no avisa si el precio sube o se queda igual", () => {
    expect(decidirAviso(candidato({ precioActual: 25 }))).toEqual({
      avisar: false,
      motivo: "no-ha-bajado",
    });
    expect(decidirAviso(candidato({ precioActual: 20 }))).toEqual({
      avisar: false,
      motivo: "no-ha-bajado",
    });
  });

  it("no avisa sin precio actual ni sin referencia anterior", () => {
    expect(decidirAviso(candidato({ precioActual: null })).avisar).toBe(false);
    expect(decidirAviso(candidato({ precioAnterior: null })).avisar).toBe(false);
  });

  // Cursos de Coursera: no traen precio. No deben generar nada.
  it("un curso sin precio no genera aviso", () => {
    expect(decidirAviso(candidato({ precioActual: null, precioAnterior: null }))).toEqual({
      avisar: false,
      motivo: "sin-precio",
    });
  });

  describe("divisas", () => {
    it("no compara precios en divisas distintas", () => {
      expect(decidirAviso(candidato({ divisaActual: "USD" }))).toEqual({
        avisar: false,
        motivo: "divisas-distintas",
      });
    });

    it("ante una divisa desconocida, no avisa", () => {
      expect(decidirAviso(candidato({ divisaActual: null })).avisar).toBe(false);
      expect(decidirAviso(candidato({ divisaAnterior: null })).avisar).toBe(false);
    });
  });

  describe("umbral mínimo", () => {
    it("no avisa de una bajada insignificante", () => {
      // De 20,00 a 19,90: medio por ciento. Ruido.
      expect(decidirAviso(candidato({ precioActual: 19.9 }))).toEqual({
        avisar: false,
        motivo: "bajada-insignificante",
      });
    });

    it("avisa justo a partir del umbral", () => {
      // 5 % exacto de 20 son 19.
      expect(decidirAviso(candidato({ precioActual: 19 })).avisar).toBe(true);
      expect(decidirAviso(candidato({ precioActual: 19.01 })).avisar).toBe(false);
    });

    // Un precio anterior de 0 haría dividir por cero al calcular el porcentaje.
    it("un precio anterior de cero no revienta ni avisa", () => {
      expect(decidirAviso(candidato({ precioAnterior: 0, precioActual: 0 }))).toEqual({
        avisar: false,
        motivo: "no-ha-bajado",
      });
    });
  });

  describe("no repetir el mismo aviso", () => {
    // Lo que impide que el job diario mande el mismo correo para siempre.
    it("no repite el aviso si el precio sigue igual que cuando se avisó", () => {
      expect(
        decidirAviso(candidato({ precioYaAvisado: 15, divisaYaAvisada: "EUR" }))
      ).toEqual({ avisar: false, motivo: "ya-avisado" });
    });

    it("no avisa si ha subido respecto a lo ya avisado, aunque siga por debajo del anterior", () => {
      expect(
        decidirAviso(
          candidato({ precioActual: 16, precioYaAvisado: 14, divisaYaAvisada: "EUR" })
        )
      ).toEqual({ avisar: false, motivo: "ya-avisado" });
    });

    it("vuelve a avisar si ha bajado todavía más", () => {
      expect(
        decidirAviso(candidato({ precioActual: 12, precioYaAvisado: 15, divisaYaAvisada: "EUR" }))
      ).toEqual({ avisar: true, precioAnterior: 20, precioActual: 12, divisa: "EUR" });
    });

    // Si el aviso anterior fue en otra divisa, no es comparable: se trata como si
    // no hubiera aviso previo en vez de callarse por un número que no significa
    // lo mismo.
    it("un aviso previo en otra divisa no bloquea el nuevo", () => {
      expect(
        decidirAviso(candidato({ precioYaAvisado: 15, divisaYaAvisada: "USD" })).avisar
      ).toBe(true);
    });
  });
});
