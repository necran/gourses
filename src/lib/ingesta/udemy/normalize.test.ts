import { describe, expect, it } from "vitest";
import {
  UdemyCourseValidationError,
  normalizeUdemyCourse,
  type UdemyRawCourse,
} from "./normalize";

const BASE = "https://www.udemy.com";

// Copiado de una respuesta real de la API (campos recortados a los que usamos).
const rawCompleto: UdemyRawCourse = {
  id: 7053781,
  title: "AI Coder: Complete Claude Code & Coding Agents Course",
  url: "/course/ai-coder-from-vibe-coder-to-agentic-engineer/",
  headline: "Master Vibe Coding with AI Coding Agents",
  rating: 4.662027,
  avg_rating: 4.6108866,
  instructional_level_simple: "All Levels",
  instructional_level: "All Levels",
  locale: { locale: "en_US", title: "English (US)" },
  visible_instructors: [
    { display_name: "Ligency", title: "Ligency" },
    { display_name: "Ed Donner", title: "Ed Donner" },
  ],
  image_480x270: "https://img-c.udemycdn.com/course/480x270/7053781_bd4d.jpg",
  image_240x135: "https://img-c.udemycdn.com/course/240x135/7053781_bd4d.jpg",
};

const detalleCompleto = {
  price_detail: { amount: 17.99, currency: "EUR", price_string: "€17.99" },
};

describe("normalizeUdemyCourse", () => {
  it("normaliza un curso completo al esquema común", () => {
    expect(normalizeUdemyCourse(rawCompleto, detalleCompleto, BASE)).toEqual({
      source: "udemy",
      sourceId: "7053781",
      title: "AI Coder: Complete Claude Code & Coding Agents Course",
      description: "Master Vibe Coding with AI Coding Agents",
      priceAmount: 17.99,
      priceCurrency: "EUR",
      rating: 4.66,
      level: "All Levels",
      language: "en",
      instructor: "Ligency, Ed Donner",
      affiliateUrl:
        "https://www.udemy.com/course/ai-coder-from-vibe-coder-to-agentic-engineer/",
      imageUrl: "https://img-c.udemycdn.com/course/480x270/7053781_bd4d.jpg",
      category: null,
    });
  });

  it("deja a null los campos opcionales ausentes sin romper", () => {
    const minimo: UdemyRawCourse = { id: 1, title: "Curso mínimo", url: "/course/minimo/" };

    expect(normalizeUdemyCourse(minimo, null, BASE)).toEqual({
      source: "udemy",
      sourceId: "1",
      title: "Curso mínimo",
      description: null,
      priceAmount: null,
      priceCurrency: null,
      rating: null,
      level: null,
      language: null,
      instructor: null,
      affiliateUrl: "https://www.udemy.com/course/minimo/",
      imageUrl: null,
      category: null,
    });
  });

  it("redondea la valoración a dos decimales, que es lo que admite la columna", () => {
    expect(normalizeUdemyCourse(rawCompleto, null, BASE).rating).toBe(4.66);
  });

  it("usa avg_rating cuando no viene rating", () => {
    const sinRating = { ...rawCompleto, rating: undefined };
    expect(normalizeUdemyCourse(sinRating, null, BASE).rating).toBe(4.61);
  });

  it("reduce el locale de Udemy al mismo formato de idioma que Coursera", () => {
    const casos: Array<[string, string]> = [
      ["en_US", "en"],
      ["es_ES", "es"],
      ["pt-BR", "pt"],
      ["ja_JP", "ja"],
    ];
    for (const [locale, esperado] of casos) {
      const raw = { ...rawCompleto, locale: { locale } };
      expect(normalizeUdemyCourse(raw, null, BASE).language).toBe(esperado);
    }
  });

  it("guarda precio null cuando el detalle no se pudo obtener, en vez de perder el curso", () => {
    const resultado = normalizeUdemyCourse(rawCompleto, null, BASE);
    expect(resultado.priceAmount).toBeNull();
    expect(resultado.priceCurrency).toBeNull();
    expect(resultado.title).toBe(rawCompleto.title);
  });

  it("ignora un price_detail con importe no numérico", () => {
    const detalleRaro = { price_detail: { amount: "17,99", currency: "EUR" } };
    expect(normalizeUdemyCourse(rawCompleto, detalleRaro, BASE).priceAmount).toBeNull();
  });

  it("convierte la url relativa del curso en absoluta", () => {
    expect(normalizeUdemyCourse(rawCompleto, null, BASE).affiliateUrl).toBe(
      "https://www.udemy.com/course/ai-coder-from-vibe-coder-to-agentic-engineer/"
    );
  });

  // HU-010: la categoría viene del ámbito que recorre la ingesta, no del curso.
  it("mapea al vocabulario común la categoría del ámbito recorrido", () => {
    expect(normalizeUdemyCourse(rawCompleto, null, BASE, "Development").category).toBe(
      "desarrollo"
    );
    expect(normalizeUdemyCourse(rawCompleto, null, BASE, "Health & Fitness").category).toBe(
      "salud-y-bienestar"
    );
  });

  it("deja la categoría a null si el ámbito no se conoce o no se pasa", () => {
    expect(normalizeUdemyCourse(rawCompleto, null, BASE, "Categoría Inventada").category).toBeNull();
    expect(normalizeUdemyCourse(rawCompleto, null, BASE).category).toBeNull();
  });

  it("lanza un fallo puntual (no de contrato) si falta id, title o url", () => {
    for (const campo of ["id", "title", "url"] as const) {
      const roto = { ...rawCompleto, [campo]: undefined };
      expect(() => normalizeUdemyCourse(roto, null, BASE)).toThrow(UdemyCourseValidationError);
    }
  });
});
