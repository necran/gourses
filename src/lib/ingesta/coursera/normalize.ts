import type { NormalizedCourse } from "../../courses/schema";
import { mapCourseraDomainTypes } from "../../courses/categories.ts";

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
  domainTypes?: unknown;
  instructorIds?: unknown;
  partnerIds?: unknown;
}

// Nombres ya resueltos que acompañan a la página del catálogo (HU-010).
export interface CourseraLinkedNames {
  instructors: Map<string, string>;
  partners: Map<string, string>;
}

// Coursera devuelve a veces instructores con nombre vacío. En ese caso se usa
// la institución que imparte el curso ("Google Cloud", "Universidad X"), que
// es una respuesta honesta a "quién lo imparte" y evita dejar el campo vacío
// como pasaba antes de HU-010.
function resolveInstructor(
  raw: CourseraRawCourse,
  linked: CourseraLinkedNames | null
): string | null {
  if (!linked) return null;

  const nombres = (ids: unknown, index: Map<string, string>): string[] =>
    Array.isArray(ids)
      ? ids
          .map((id) => (typeof id === "string" ? index.get(id) : undefined))
          .filter((n): n is string => typeof n === "string" && n.length > 0)
      : [];

  const instructores = nombres(raw.instructorIds, linked.instructors);
  if (instructores.length > 0) return instructores.join(", ");

  const instituciones = nombres(raw.partnerIds, linked.partners);
  return instituciones.length > 0 ? instituciones.join(", ") : null;
}

// Coursera no expone precio por curso individual en esta API (la mayoría del
// catálogo se monetiza vía suscripción, no compra unitaria como Udemy) — por
// eso priceAmount/priceCurrency quedan a null, campos ya nullable en HU-004.
//
// El enlace de afiliado vía Impact.com todavía no está confirmado (ver
// docs/checklist-alta-afiliados.md) — hasta entonces se guarda el enlace
// directo al curso como placeholder, nunca un enlace inventado de tracking.
export function normalizeCourseraCourse(
  raw: CourseraRawCourse,
  linked: CourseraLinkedNames | null = null
): NormalizedCourse {
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
    instructor: resolveInstructor(raw, linked),
    affiliateUrl: `https://www.coursera.org/learn/${raw.slug}`,
    imageUrl: typeof raw.photoUrl === "string" ? raw.photoUrl : null,
    category: mapCourseraDomainTypes(raw.domainTypes),
  };
}
