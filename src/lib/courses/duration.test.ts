import { describe, expect, it } from "vitest";
import { formatDuration, parseDuration } from "./duration";

// Todos los valores de este fichero salen de respuestas reales de las APIs
// (muestreo de 600 cursos de Coursera y 120 de Udemy, 2026-08-10).
describe("parseDuration", () => {
  describe("totales directos", () => {
    it.each([
      ["2 hours", 120, 120],
      ["1 hour", 60, 60],
      ["1.5 hours", 90, 90],
      ["106 minutes", 106, 106],
      ["4h 30m", 270, 270],
      ["1 hour 30 minutes", 90, 90],
      ["3 Hours and 50 Minutes", 230, 230],
      ["5 hours ", 300, 300],
      ["Approximately 91 minutes", 91, 91],
      ["~47 minutes ", 47, 47],
    ])("interpreta %j", (texto, min, max) => {
      expect(parseDuration(texto)).toEqual({ minMinutes: min, maxMinutes: max });
    });

    it("interpreta un total expresado como rango", () => {
      expect(parseDuration("1-2 hours")).toEqual({ minMinutes: 60, maxMinutes: 120 });
    });

    it("admite otros idiomas con alfabeto latino", () => {
      expect(parseDuration("2 heures")).toEqual({ minMinutes: 120, maxMinutes: 120 });
      expect(parseDuration("5 Horas")).toEqual({ minMinutes: 300, maxMinutes: 300 });
    });

    it("interpreta el formato uniforme de Udemy", () => {
      expect(parseDuration("16.5 hours")).toEqual({ minMinutes: 990, maxMinutes: 990 });
      expect(parseDuration("57 hours")).toEqual({ minMinutes: 3420, maxMinutes: 3420 });
    });
  });

  describe("semanas por horas semanales", () => {
    it.each([
      ["4 weeks of study, 2-4 hours a week", 480, 960],
      ["4 weeks of study, 1-2 hours/week", 240, 480],
      ["3 weeks of study, 5-7 hours per week", 900, 1260],
      ["4 weeks, 5-6 hours per week", 1200, 1440],
    ])("deriva el total de %j", (texto, min, max) => {
      expect(parseDuration(texto)).toEqual({ minMinutes: min, maxMinutes: max });
    });

    it("da un valor exacto cuando las horas semanales no son un rango", () => {
      expect(parseDuration("4 weeks of study, 2 hours per week")).toEqual({
        minMinutes: 480,
        maxMinutes: 480,
      });
    });

    it("entiende los números escritos con letra", () => {
      expect(parseDuration("Three weeks of study, 3-5 hours/week")).toEqual({
        minMinutes: 540,
        maxMinutes: 900,
      });
    });

    it("entiende el orden inverso", () => {
      expect(parseDuration("3-4 hours per week for 6 weeks")).toEqual({
        minMinutes: 1080,
        maxMinutes: 1440,
      });
    });

    it("cuenta un mes como cuatro semanas", () => {
      expect(parseDuration("3 months, 5 hours per week")).toEqual({
        minMinutes: 3600,
        maxMinutes: 3600,
      });
    });

    it("multiplica también por módulos", () => {
      expect(parseDuration("5 modules, 2-3 hours/module")).toEqual({
        minMinutes: 600,
        maxMinutes: 900,
      });
    });
  });

  describe("lo que no se puede saber se deja sin duración", () => {
    // El caso más importante: son horas POR SEMANA y no se sabe cuántas
    // semanas dura. Tomarlas como total subestimaría el curso gravemente.
    it.each(["4-8 hours/week", "3-5 hours/week", "3 hours a week", "8 - 10 horas por semana", "30 min/week", "9 hours per module"])(
      "rechaza %j, que es un ritmo y no un total",
      (texto) => {
        expect(parseDuration(texto)).toBeNull();
      }
    );

    // Quedarse con la primera cifra daría 4 h cuando en realidad son ~9 h.
    it("rechaza la prosa que suma tramos", () => {
      expect(
        parseDuration(
          "Around 4 hours of videos in total, plus a final project requiring about 5 hours to complete."
        )
      ).toBeNull();
    });

    it("rechaza una duración con una segunda cifra que no sabe interpretar", () => {
      expect(parseDuration("3-4 hours of study, no less than 1 hour/day")).toBeNull();
    });

    it("rechaza semanas sin horas, porque el total es desconocido", () => {
      expect(parseDuration("2 Weeks")).toBeNull();
      expect(parseDuration("4 semanas")).toBeNull();
    });

    it("rechaza alfabetos que todavía no se cubren", () => {
      expect(parseDuration("2 часа")).toBeNull();
      expect(parseDuration("5 周课程, 2-4 小时/周")).toBeNull();
    });

    it("rechaza texto vago o sin unidad", () => {
      expect(parseDuration("A few hours a week, flexible")).toBeNull();
      expect(parseDuration("120")).toBeNull();
      expect(parseDuration("Less then 2 weeks")).toBeNull();
    });

    it("rechaza valores vacíos o de otro tipo", () => {
      expect(parseDuration(null)).toBeNull();
      expect(parseDuration(undefined)).toBeNull();
      expect(parseDuration("")).toBeNull();
      expect(parseDuration("   ")).toBeNull();
    });

    it("rechaza un cero, que no es una duración", () => {
      expect(parseDuration("0 hours")).toBeNull();
    });
  });
});

describe("formatDuration", () => {
  it("muestra una duración exacta", () => {
    expect(formatDuration({ minMinutes: 120, maxMinutes: 120 })).toBe("2 h");
  });

  it("muestra los minutos cuando no llega a una hora", () => {
    expect(formatDuration({ minMinutes: 45, maxMinutes: 45 })).toBe("45 min");
  });

  // Se enseña el rango tal cual: reducirlo a un punto medio afirmaría una
  // cifra que la plataforma nunca ha publicado.
  it("muestra el rango cuando la duración es un rango", () => {
    expect(formatDuration({ minMinutes: 480, maxMinutes: 960 })).toBe("8 h–16 h");
  });

  it("usa coma decimal, como corresponde al idioma de la web", () => {
    expect(formatDuration({ minMinutes: 90, maxMinutes: 90 })).toBe("1,5 h");
  });

  it("no muestra nada cuando no hay duración", () => {
    expect(formatDuration(null)).toBeNull();
  });
});
