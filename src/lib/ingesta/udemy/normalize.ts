import type { NormalizedCourse } from "../../courses/schema";
import { mapUdemyCategory } from "../../courses/categories.ts";
import { parseDuration } from "../../courses/duration.ts";

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
  content_info_short?: unknown;
  content_info?: unknown;
}

// Detalle de curso (/api-2.0/courses/{id}/), pedido con fields[course] (HU-029):
// trae el precio y también la descripción real, «lo que aprenderás», los
// requisitos y las cifras de reseñas/alumnos — nada de esto viene en el listado.
export interface UdemyRawDetail {
  price_detail?: unknown;
  description?: unknown;
  what_you_will_learn_data?: unknown;
  requirements_data?: unknown;
  num_reviews?: unknown;
  num_subscribers?: unknown;
}

// El HTML de `description` es de Udemy, no nuestro: nunca se mete en el DOM
// tal cual. Se limpia a texto plano, conservando los saltos de párrafo y de
// elemento de lista, que es lo que hace legible un texto largo sin etiquetas.
export function limpiarDescripcionHtml(html: string): string {
  return html
    .replace(/<\/(p|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Listas de Udemy (`what_you_will_learn_data`, `requirements_data`): siempre
// `{ items: string[] }` cuando existen. Un curso sin ninguna de las dos cosas
// no trae la clave, así que null es "no publica esto", no un fallo de forma.
function parseListaDeItems(raw: unknown): string[] | null {
  const items = (raw as { items?: unknown } | undefined)?.items;
  if (!Array.isArray(items)) return null;
  const limpios = items.filter((i): i is string => typeof i === "string" && i.trim().length > 0);
  return limpios.length > 0 ? limpios : null;
}

function parseEntero(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : null;
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
// curso se guarda igualmente en vez de perderse, pero marcado con
// `priceUnknown` para que nadie confunda "no lo sé" con "no cuesta nada".
//
// El enlace de afiliado de Udemy todavía no está confirmado (ver
// docs/checklist-alta-afiliados.md), así que affiliate_url guarda de momento la
// URL directa del curso, mismo criterio que se siguió en HU-006 con Coursera.
export function normalizeUdemyCourse(
  raw: UdemyRawCourse,
  detail: UdemyRawDetail | null,
  baseUrl: string,
  // Título de la categoría del ámbito que se está recorriendo: la ingesta ya
  // va categoría a categoría (HU-005), así que la conoce sin pedir nada extra.
  categoryTitle: string | null = null
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

  // La descripción real, «lo que aprenderás», los requisitos y las cifras de
  // reseñas/alumnos vienen todos de la misma llamada de detalle que el precio
  // (HU-029). Antes `description` era el titular del listado (`headline`),
  // que no es una descripción — se deja de usar como tal.
  const descripcionHtml = typeof detail?.description === "string" ? detail.description : null;

  return {
    source: "udemy",
    sourceId: String(raw.id),
    title: raw.title,
    description: descripcionHtml ? limpiarDescripcionHtml(descripcionHtml) : null,
    priceAmount: amount,
    priceCurrency: currency,
    // Sin detalle no es que el curso sea gratis: es que no lo sabemos. La
    // misma marca cubre ahora también descripción y estadísticas: todo viene
    // de la misma llamada, así que todo es igual de incierto cuando falla —
    // upsertCourse conserva lo que ya hubiera en vez de borrarlo con null.
    priceUnknown: detail === null,
    rating: parseRating(raw),
    level: firstString(raw.instructional_level_simple, raw.instructional_level),
    language: parseLanguage(raw),
    instructor: parseInstructor(raw),
    affiliateUrl: new URL(raw.url, baseUrl).toString(),
    imageUrl: firstString(raw.image_480x270, raw.image_240x135),
    category: mapUdemyCategory(categoryTitle),
    numReviews: parseEntero(detail?.num_reviews),
    numSubscribers: parseEntero(detail?.num_subscribers),
    whatYouWillLearn: parseListaDeItems(detail?.what_you_will_learn_data),
    requirements: parseListaDeItems(detail?.requirements_data),
    ...duracion(raw),
  };
}

// Udemy publica la duración en el propio listado, en formato uniforme
// ("16.5 hours"), así que no hace falta ninguna llamada extra.
function duracion(raw: UdemyRawCourse): {
  durationMinMinutes: number | null;
  durationMaxMinutes: number | null;
} {
  const texto = firstString(raw.content_info_short, raw.content_info);
  const d = parseDuration(texto);
  return {
    durationMinMinutes: d ? d.minMinutes : null,
    durationMaxMinutes: d ? d.maxMinutes : null,
  };
}
