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
      category: null,
      numReviews: null,
      numSubscribers: null,
      whatYouWillLearn: null,
      requirements: null,
      durationMinMinutes: null,
      durationMaxMinutes: null,
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

  // HU-010: instructor y categoría.
  describe("instructor y categoría (HU-010)", () => {
    const base = { id: "abc123", slug: "curso", name: "Curso" };

    const enlazados = (
      instructors: Array<[string, string]> = [],
      partners: Array<[string, string]> = []
    ) => ({ instructors: new Map(instructors), partners: new Map(partners) });

    it("usa el nombre del instructor cuando la API lo resuelve", () => {
      const result = normalizeCourseraCourse(
        { ...base, instructorIds: ["22997770"] },
        enlazados([["22997770", "Andrew Ng"]])
      );
      expect(result.instructor).toBe("Andrew Ng");
    });

    it("junta varios instructores", () => {
      const result = normalizeCourseraCourse(
        { ...base, instructorIds: ["1", "2"] },
        enlazados([
          ["1", "Ana García"],
          ["2", "Luis Pérez"],
        ])
      );
      expect(result.instructor).toBe("Ana García, Luis Pérez");
    });

    // Coursera devuelve instructores con fullName vacío a menudo; en ese caso
    // la institución responde mejor a "quién imparte esto".
    it("recurre a la institución cuando el instructor no tiene nombre", () => {
      const result = normalizeCourseraCourse(
        { ...base, instructorIds: ["sin-nombre"], partnerIds: ["443"] },
        enlazados([], [["443", "Google Cloud"]])
      );
      expect(result.instructor).toBe("Google Cloud");
    });

    it("deja instructor a null si no hay ni instructor ni institución", () => {
      expect(normalizeCourseraCourse(base, enlazados()).instructor).toBeNull();
      expect(normalizeCourseraCourse(base, null).instructor).toBeNull();
    });

    it("mapea el dominio de Coursera al vocabulario común", () => {
      const result = normalizeCourseraCourse({
        ...base,
        domainTypes: [{ subdomainId: "cloud-computing", domainId: "information-technology" }],
      });
      expect(result.category).toBe("it-y-software");
    });

    it("deja la categoría a null si el dominio no está en el mapa", () => {
      const result = normalizeCourseraCourse({
        ...base,
        domainTypes: [{ domainId: "dominio-que-no-existe" }],
      });
      expect(result.category).toBeNull();
    });
  });
});
