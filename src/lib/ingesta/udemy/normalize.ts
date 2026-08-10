import type { NormalizedCourse } from "../../courses/schema";

// Cambio de forma en la respuesta de la API (contrato roto): detiene el job,
// igual que CourseraShapeError en HU-006.
export class UdemyShapeError extends Error {
  raw: unknown;

  constructor(message: string, raw: unknown) {
    super(`Cambio de forma en la respuesta de la API de Udemy: ${message}`);
    this.name = "UdemyShapeError";
    this.raw = raw;
  }
}

// Un curso suelto con campos ausentes o inesperados es un fallo puntual de ese
// registro, no un cambio de contrato — se registra y se sigue con el resto.
export class UdemyCourseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UdemyCourseValidationError";
  }
}

// Item tal y como llega en la unidad de descubrimiento (listado).
export interface UdemyRawCourse {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  headline?: unknown;
  rating?: unknown;
  avg_rating?: unknown;
  instructional_level_simple?: unknown;
  instructional_level?: unknown;
  locale?: unknown;
  visible_instructors?: unknown;
  image_480x270?: unknown;
  image_240x135?: unknown;
}

// Detalle de curso (/api-2.0/courses/{id}/): es lo único que trae el precio.
export interface UdemyRawDetail {
  price_detail?: unknown;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function parseRating(raw: UdemyRawCourse): number | null {
  for (const value of [raw.rating, raw.avg_rating]) {
    if (typeof value === "number" && Number.isFinite(value)) {
      // La columna rating es numeric(3,2): 4.662027 no cabe, se redondea.
      return Math.round(value * 100) / 100;
    }
  }
  return null;
}

// Udemy devuelve locales tipo "en_US"; Coursera devuelve "en"/"es". Nos
// quedamos con el subtag principal para que el filtro de idioma del buscador
// (HU-007) trate igual a las dos fuentes.
function parseLanguage(raw: UdemyRawCourse): string | null {
  const locale = raw.locale as { locale?: unknown } | undefined;
  const value = typeof locale?.locale === "string" ? locale.locale : null;
  if (!value) return null;
  const primary = value.split(/[_-]/)[0];
  return primary.length > 0 ? primary.toLowerCase() : null;
}

function parseInstructor(raw: UdemyRawCourse): string | null {
  if (!Array.isArray(raw.visible_instructors)) return null;
  const names = raw.visible_instructors
    .map((i) => {
      const instructor = i as { display_name?: unknown; title?: unknown };
      return firstString(instructor.display_name, instructor.title);
    })
    .filter((n): n is string => n !== null)
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  return names.length > 0 ? names.join(", ") : null;
}

function parsePrice(detail: UdemyRawDetail | null): {
  amount: number | null;
  currency: string | null;
} {
  const priceDetail = detail?.price_detail as
    | { amount?: unknown; currency?: unknown }
    | undefined;

  const amount =
    typeof priceDetail?.amount === "number" && Number.isFinite(priceDetail.amount)
      ? priceDetail.amount
      : null;
  const currency = typeof priceDetail?.currency === "string" ? priceDetail.currency : null;

  return { amount, currency };
}

// Combina el item del listado (metadatos) con el detalle (precio) y lo lleva al
// esquema común de HU-004. El detalle es opcional: si esa llamada falló, el
// curso se guarda igualmente con precio null en vez de perderse.
//
// El enlace de afiliado de Udemy todavía no está confirmado (ver
// docs/checklist-alta-afiliados.md), así que affiliate_url guarda de momento la
// URL directa del curso, mismo criterio que se siguió en HU-006 con Coursera.
export function normalizeUdemyCourse(
  raw: UdemyRawCourse,
  detail: UdemyRawDetail | null,
  baseUrl: string
): NormalizedCourse {
  if (typeof raw.id !== "number" || !Number.isFinite(raw.id)) {
    throw new UdemyCourseValidationError("falta 'id' o no es un número");
  }
  if (typeof raw.title !== "string" || raw.title.length === 0) {
    throw new UdemyCourseValidationError("falta 'title' o no es un string");
  }
  if (typeof raw.url !== "string" || raw.url.length === 0) {
    throw new UdemyCourseValidationError("falta 'url' o no es un string");
  }

  const { amount, currency } = parsePrice(detail);

  return {
    source: "udemy",
    sourceId: String(raw.id),
    title: raw.title,
    description: firstString(raw.headline),
    priceAmount: amount,
    priceCurrency: currency,
    rating: parseRating(raw),
    level: firstString(raw.instructional_level_simple, raw.instructional_level),
    language: parseLanguage(raw),
    instructor: parseInstructor(raw),
    affiliateUrl: new URL(raw.url, baseUrl).toString(),
    imageUrl: firstString(raw.image_480x270, raw.image_240x135),
  };
}
