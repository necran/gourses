import type { NormalizedCourse } from "../../courses/schema";

// La Catalog API de Coursera está en beta (ver .claude/rules/ingesta-fuentes.md):
// si cambia de forma de manera incompatible, este error lo deja claro en vez
// de dejar que un TypeError críptico rompa el job.
export class CourseraShapeError extends Error {
  raw: unknown;

  constructor(message: string, raw: unknown) {
    super(`Cambio de forma en la respuesta de Coursera Catalog API: ${message}`);
    this.name = "CourseraShapeError";
    this.raw = raw;
  }
}

// Un curso individual con campos ausentes/inesperados es un fallo puntual de
// ese registro, no un cambio de contrato de la API — distinto de CourseraShapeError.
export class CourseraCourseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseraCourseValidationError";
  }
}

export interface CourseraRawCourse {
  id?: unknown;
  slug?: unknown;
  name?: unknown;
  description?: unknown;
  photoUrl?: unknown;
  primaryLanguages?: unknown;
}

// Coursera no expone precio por curso individual en esta API (la mayoría del
// catálogo se monetiza vía suscripción, no compra unitaria como Udemy) — por
// eso priceAmount/priceCurrency quedan a null, campos ya nullable en HU-004.
//
// El enlace de afiliado vía Impact.com todavía no está confirmado (ver
// docs/checklist-alta-afiliados.md) — hasta entonces se guarda el enlace
// directo al curso como placeholder, nunca un enlace inventado de tracking.
export function normalizeCourseraCourse(raw: CourseraRawCourse): NormalizedCourse {
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new CourseraCourseValidationError("falta 'id' o no es un string");
  }
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    throw new CourseraCourseValidationError("falta 'name' o no es un string");
  }
  if (typeof raw.slug !== "string" || raw.slug.length === 0) {
    throw new CourseraCourseValidationError("falta 'slug' o no es un string");
  }

  const language =
    Array.isArray(raw.primaryLanguages) && typeof raw.primaryLanguages[0] === "string"
      ? raw.primaryLanguages[0]
      : null;

  return {
    source: "coursera",
    sourceId: raw.id,
    title: raw.name,
    description: typeof raw.description === "string" ? raw.description : null,
    priceAmount: null,
    priceCurrency: null,
    rating: null,
    level: null,
    language,
    instructor: null,
    affiliateUrl: `https://www.coursera.org/learn/${raw.slug}`,
    imageUrl: typeof raw.photoUrl === "string" ? raw.photoUrl : null,
  };
}
