import { CourseraShapeError, type CourseraRawCourse } from "./normalize.ts";

export interface CourseraCatalogPage {
  elements: CourseraRawCourse[];
  next: string | null;
}

const FIELDS = "name,description,photoUrl,primaryLanguages";

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
  if (start) url.searchParams.set("start", start);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Coursera Catalog API respondió ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  if (!body || !Array.isArray(body.elements)) {
    throw new CourseraShapeError("falta 'elements' o no es un array", body);
  }

  const next = typeof body.paging?.next === "string" ? body.paging.next : null;
  return { elements: body.elements, next };
}
