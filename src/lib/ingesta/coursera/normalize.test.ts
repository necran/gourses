import { describe, expect, it } from "vitest";
import { CourseraCourseValidationError, normalizeCourseraCourse } from "./normalize";

describe("normalizeCourseraCourse", () => {
  it("normaliza un curso completo de Coursera al esquema común", () => {
    const result = normalizeCourseraCourse({
      id: "abc123",
      slug: "intro-a-python",
      name: "Introducción a Python",
      description: "Curso introductorio",
      photoUrl: "https://example.com/foto.jpg",
      primaryLanguages: ["es"],
    });

    expect(result).toEqual({
      source: "coursera",
      sourceId: "abc123",
      title: "Introducción a Python",
      description: "Curso introductorio",
      priceAmount: null,
      priceCurrency: null,
      rating: null,
      level: null,
      language: "es",
      instructor: null,
      affiliateUrl: "https://www.coursera.org/learn/intro-a-python",
      imageUrl: "https://example.com/foto.jpg",
    });
  });

  it("normaliza un curso con campos opcionales ausentes", () => {
    const result = normalizeCourseraCourse({
      id: "abc123",
      slug: "intro-a-python",
      name: "Introducción a Python",
    });

    expect(result.description).toBeNull();
    expect(result.language).toBeNull();
    expect(result.imageUrl).toBeNull();
  });

  it("lanza CourseraCourseValidationError si falta 'id' (fallo puntual de ese curso)", () => {
    expect(() => normalizeCourseraCourse({ slug: "x", name: "x" })).toThrow(CourseraCourseValidationError);
  });

  it("lanza CourseraCourseValidationError si falta 'name'", () => {
    expect(() => normalizeCourseraCourse({ id: "x", slug: "x" })).toThrow(CourseraCourseValidationError);
  });

  it("lanza CourseraCourseValidationError si falta 'slug'", () => {
    expect(() => normalizeCourseraCourse({ id: "x", name: "x" })).toThrow(CourseraCourseValidationError);
  });
});
