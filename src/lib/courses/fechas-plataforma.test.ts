import { describe, expect, it } from "vitest";
import {
  fechaActualizacionUdemy,
  fechaLanzamientoCoursera,
  fechaPublicacionUdemy,
} from "./fechas-plataforma";

const AHORA = new Date("2026-09-15T12:00:00Z");

describe("fechaPublicacionUdemy", () => {
  it("lee el formato real de la API", () => {
    expect(fechaPublicacionUdemy("2017-07-03T17:39:15Z", AHORA)).toBe("2017-07-03T17:39:15.000Z");
  });

  it.each([
    [undefined, "ausente"],
    [null, "null"],
    ["", "vacía"],
    ["ayer", "texto"],
    ["2017-07-03", "sin hora (no es el formato de published_time)"],
    [1499103555000, "número"],
    ["2031-01-01T00:00:00Z", "futura"],
    ["1970-01-01T00:00:00Z", "anterior a que existiera la plataforma"],
  ])("%j (%s) es null, nunca «hoy»", (valor, motivo) => {
    expect(fechaPublicacionUdemy(valor, AHORA), motivo).toBeNull();
  });
});

describe("fechaActualizacionUdemy", () => {
  it("lee el formato real de la API", () => {
    expect(fechaActualizacionUdemy("2026-06-04", AHORA)).toBe("2026-06-04");
  });

  it.each([
    [undefined],
    ["2026-6-4"],
    ["2026-02-31"],
    ["2026-12-01"],
    ["04/06/2026"],
  ])("%j es null", (valor) => {
    expect(fechaActualizacionUdemy(valor, AHORA)).toBeNull();
  });
});

describe("fechaLanzamientoCoursera", () => {
  it("convierte los milisegundos de startDate", () => {
    expect(fechaLanzamientoCoursera(Date.UTC(2025, 8, 1), AHORA)).toBe("2025-09-01T00:00:00.000Z");
  });

  it.each([
    [0, "cero"],
    [-1, "negativo"],
    ["1700000000000", "texto"],
    [undefined, "ausente"],
    [Date.UTC(2027, 0, 1), "convocatoria futura"],
  ])("%j (%s) es null", (valor, motivo) => {
    expect(fechaLanzamientoCoursera(valor, AHORA), motivo).toBeNull();
  });
});
