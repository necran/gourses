import { UdemyShapeError, type UdemyRawCourse, type UdemyRawDetail } from "./normalize.ts";

// Credenciales del job de ingesta. Se pasan por parámetro (nunca se leen de
// process.env aquí dentro) para que esta capa sea testeable y para que las
// claves vivan solo en el entrypoint del job — ver .claude/rules/seguridad.md.
export interface UdemyCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface UdemyCategory {
  id: number;
  title: string;
}

export interface UdemyUnitPage {
  items: UdemyRawCourse[];
  totalPages: number;
  totalItemCount: number;
}

// Ámbito de descubrimiento: el catálogo se recorre por categoría o por
// subcategoría, porque el listado clásico /api-2.0/courses/ devuelve 403 para
// credenciales de afiliado (ver docs/checklist-alta-afiliados.md).
export type UdemyScope =
  | { kind: "category"; id: number }
  | { kind: "subcategory"; id: number };

function authHeader({ clientId, clientSecret }: UdemyCredentials): string {
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

// La API devuelve en cada unidad la URL ya montada para paginarla, con
// parámetros internos (fl, sos, fft...) que cambian según el ámbito. Seguirla
// es más robusto que replicarlos a mano, pero es una URL que viene de un
// tercero: se resuelve contra baseUrl y se exige mismo origen, para que una
// respuesta manipulada no pueda redirigir la petición a otro host.
export function resolveApiUrl(baseUrl: string, pathOrUrl: string): URL {
  const base = new URL(baseUrl);
  const resolved = new URL(pathOrUrl, base);
  if (resolved.origin !== base.origin) {
    throw new UdemyShapeError(
      `la API devolvió una URL fuera de ${base.origin}: ${resolved.origin}`,
      pathOrUrl
    );
  }
  return resolved;
}

async function getJson(creds: UdemyCredentials, url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: authHeader(creds), Accept: "application/json" },
  });

  if (!response.ok) {
    // Sin reintentos aquí: la política de reintentos/backoff la decide el
    // llamador (mismo criterio que el adaptador de Coursera).
    throw new Error(
      `Udemy API respondió ${response.status} ${response.statusText} en ${url.pathname}`
    );
  }

  return response.json();
}

function requireArray(body: unknown, key: string, context: string): unknown[] {
  const value = (body as Record<string, unknown> | null)?.[key];
  if (!Array.isArray(value)) {
    throw new UdemyShapeError(`falta '${key}' o no es un array en ${context}`, body);
  }
  return value;
}

export async function fetchCategories(creds: UdemyCredentials): Promise<UdemyCategory[]> {
  const url = resolveApiUrl(creds.baseUrl, "/api-2.0/course-categories/");
  const body = await getJson(creds, url);
  return requireArray(body, "results", "course-categories").map((raw) => {
    const c = raw as { id?: unknown; title?: unknown };
    if (typeof c.id !== "number" || typeof c.title !== "string") {
      throw new UdemyShapeError("categoría sin 'id' numérico o 'title'", raw);
    }
    return { id: c.id, title: c.title };
  });
}

export async function fetchSubcategories(
  creds: UdemyCredentials,
  categoryId: number
): Promise<UdemyCategory[]> {
  const url = resolveApiUrl(
    creds.baseUrl,
    `/api-2.0/course-categories/${categoryId}/subcategories/`
  );
  const body = await getJson(creds, url);
  return requireArray(body, "results", "subcategories").map((raw) => {
    const c = raw as { id?: unknown; title?: unknown };
    if (typeof c.id !== "number" || typeof c.title !== "string") {
      throw new UdemyShapeError("subcategoría sin 'id' numérico o 'title'", raw);
    }
    return { id: c.id, title: c.title };
  });
}

function scopeParams(scope: UdemyScope): { sourcePage: string; params: Record<string, string> } {
  if (scope.kind === "category") {
    return {
      sourcePage: "category_page",
      params: { source_page: "category_page", context: "category", category_id: String(scope.id) },
    };
  }
  return {
    sourcePage: "subcategory_page",
    params: {
      source_page: "subcategory_page",
      context: "subcategory",
      subcategory_id: String(scope.id),
    },
  };
}

// Devuelve la URL de la unidad de cursos de un ámbito (la que la propia API
// expone para paginar), o null si ese ámbito no tiene unidad de cursos.
export async function fetchCourseUnitUrl(
  creds: UdemyCredentials,
  scope: UdemyScope
): Promise<string | null> {
  const { params } = scopeParams(scope);
  const url = resolveApiUrl(creds.baseUrl, "/api-2.0/discovery-units/");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("page_size", "1");

  const body = await getJson(creds, url);
  const units = requireArray(body, "units", "discovery-units");

  for (const raw of units) {
    const unit = raw as { item_type?: unknown; url?: unknown };
    if (unit.item_type === "course" && typeof unit.url === "string") {
      return unit.url;
    }
  }
  return null;
}

export async function fetchUnitPage(
  creds: UdemyCredentials,
  unitUrl: string,
  scope: UdemyScope,
  { page, pageSize }: { page: number; pageSize: number }
): Promise<UdemyUnitPage> {
  const { sourcePage } = scopeParams(scope);
  const url = resolveApiUrl(creds.baseUrl, unitUrl);
  url.searchParams.set("source_page", sourcePage);
  url.searchParams.set("page_size", String(pageSize));
  url.searchParams.set("page", String(page));

  const body = (await getJson(creds, url)) as { unit?: unknown };
  const unit = body?.unit as
    | { items?: unknown; pagination?: { total_page?: unknown; total_item_count?: unknown } }
    | undefined;

  if (!unit) {
    throw new UdemyShapeError("falta 'unit' en la respuesta de la unidad de descubrimiento", body);
  }

  const items = requireArray(unit, "items", "unidad de descubrimiento") as UdemyRawCourse[];
  const totalPages = Number(unit.pagination?.total_page ?? 1);
  const totalItemCount = Number(unit.pagination?.total_item_count ?? items.length);

  return {
    items,
    totalPages: Number.isFinite(totalPages) ? totalPages : 1,
    totalItemCount: Number.isFinite(totalItemCount) ? totalItemCount : items.length,
  };
}

// El listado de descubrimiento no trae precio, así que hace falta una llamada
// de detalle por curso — es lo que alimenta course_price_history (HU-004).
export async function fetchCourseDetail(
  creds: UdemyCredentials,
  courseId: number
): Promise<UdemyRawDetail> {
  const url = resolveApiUrl(creds.baseUrl, `/api-2.0/courses/${courseId}/`);
  return (await getJson(creds, url)) as UdemyRawDetail;
}
