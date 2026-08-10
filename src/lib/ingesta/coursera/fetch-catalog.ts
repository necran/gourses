import { CourseraShapeError, type CourseraRawCourse } from "./normalize.ts";

// Nombres resueltos de instructores e instituciones, indexados por id. La API
// los devuelve en 'linked' dentro de la misma petición gracias a 'includes',
// así que no hace falta una llamada extra por curso (HU-010).
export interface CourseraLinked {
  instructors: Map<string, string>;
  partners: Map<string, string>;
}

export interface CourseraCatalogPage {
  elements: CourseraRawCourse[];
  linked: CourseraLinked;
  next: string | null;
}

const FIELDS =
  "name,description,photoUrl,primaryLanguages,domainTypes,instructorIds,partnerIds,workload";
const INCLUDES = "instructorIds,partnerIds";

function indexById(
  raw: unknown,
  nameKey: "fullName" | "name"
): Map<string, string> {
  const index = new Map<string, string>();
  if (!Array.isArray(raw)) return index;

  for (const item of raw) {
    const entry = item as Record<string, unknown>;
    const id = entry?.id;
    const name = entry?.[nameKey];
    // Coursera devuelve a veces fullName vacío; no se indexa, para que el
    // adaptador pueda recurrir a la institución.
    if (typeof id === "string" && typeof name === "string" && name.trim().length > 0) {
      index.set(id, name.trim());
    }
  }
  return index;
}

// Una página de la Catalog API pública de Coursera (sin autenticación, ver
// docs/analisis-y-estrategia.md). No se reintenta aquí: el llamador decide
// la política de reintentos/backoff.
export async function fetchCourseraCatalogPage(
  baseUrl: string,
  { start, limit = 100 }: { start?: string; limit?: number } = {}
): Promise<CourseraCatalogPage> {
  const url = new URL("/api/courses.v1", baseUrl);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("includes", INCLUDES);
  if (start) url.searchParams.set("start", start);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Coursera Catalog API respondió ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  if (!body || !Array.isArray(body.elements)) {
    throw new CourseraShapeError("falta 'elements' o no es un array", body);
  }

  // 'linked' ausente no es un cambio de contrato: significa que esa página no
  // trae instructores ni instituciones que resolver.
  const linked: CourseraLinked = {
    instructors: indexById(body.linked?.["instructors.v1"], "fullName"),
    partners: indexById(body.linked?.["partners.v1"], "name"),
  };

  const next = typeof body.paging?.next === "string" ? body.paging.next : null;
  return { elements: body.elements, linked, next };
}
