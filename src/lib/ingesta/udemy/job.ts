import type { CourseStore } from "../upsert-course.ts";
import { upsertCourse } from "../upsert-course.ts";
import * as api from "./fetch-catalog.ts";
import type { UdemyCredentials, UdemyScope } from "./fetch-catalog.ts";
import { UdemyShapeError, normalizeUdemyCourse } from "./normalize.ts";

export interface UdemyJobResult {
  processed: number;
  saved: number;
  scopes: number;
  failedCourses: Array<{ id: unknown; error: string }>;
}

export interface UdemyJobOptions {
  creds: UdemyCredentials;
  store: CourseStore;
  /** Recorre también las subcategorías, no solo las 13 categorías raíz. */
  includeSubcategories?: boolean;
  /** Tope de ámbitos (categorías/subcategorías) a recorrer. */
  maxScopes?: number;
  maxPagesPerScope?: number;
  pageSize?: number;
}

// Job de ingesta de Udemy (HU-005). Se ejecuta bajo demanda (ver
// scripts/ingest-udemy.mjs); la recurrencia automática se decide en Fase 6.
//
// El catálogo se recorre por categoría/subcategoría porque el listado clásico
// /api-2.0/courses/ devuelve 403 para credenciales de afiliado — no es un fallo
// de configuración (ver docs/checklist-alta-afiliados.md).
//
// Mismo criterio de errores que en HU-006: un curso mal formado o un detalle
// que falla no rompen el catálogo entero, pero un cambio de forma de la propia
// API (UdemyShapeError) detiene el job, para no guardar datos a medio
// normalizar sobre un contrato que ya no se cumple.
export async function runUdemyIngestJob({
  creds,
  store,
  includeSubcategories = false,
  maxScopes = Infinity,
  maxPagesPerScope = Infinity,
  pageSize = 12,
}: UdemyJobOptions): Promise<UdemyJobResult> {
  const result: UdemyJobResult = { processed: 0, saved: 0, scopes: 0, failedCourses: [] };

  const categories = await api.fetchCategories(creds);
  const scopes: UdemyScope[] = [];

  for (const category of categories) {
    scopes.push({ kind: "category", id: category.id });
    if (includeSubcategories) {
      const subcategories = await api.fetchSubcategories(creds, category.id);
      for (const sub of subcategories) scopes.push({ kind: "subcategory", id: sub.id });
    }
  }

  const seen = new Set<string>();

  for (const scope of scopes.slice(0, maxScopes)) {
    const unitUrl = await api.fetchCourseUnitUrl(creds, scope);
    // Un ámbito sin unidad de cursos no es un error: simplemente no aporta nada.
    if (!unitUrl) continue;

    result.scopes += 1;
    let page = 1;
    let totalPages = 1;

    do {
      const unitPage = await api.fetchUnitPage(creds, unitUrl, scope, { page, pageSize });
      totalPages = unitPage.totalPages;

      for (const raw of unitPage.items) {
        const rawId = (raw as { id?: unknown }).id;
        // Las unidades de distintas categorías se solapan; no repetimos trabajo
        // ni llamadas de detalle por un curso ya procesado en esta ejecución.
        const key = String(rawId);
        if (seen.has(key)) continue;
        seen.add(key);

        result.processed += 1;

        try {
          const detail = await fetchDetailTolerantly(creds, rawId, result);
          const normalized = normalizeUdemyCourse(raw, detail, creds.baseUrl);
          await upsertCourse(store, normalized);
          result.saved += 1;
        } catch (error) {
          if (error instanceof UdemyShapeError) throw error;
          result.failedCourses.push({
            id: rawId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      page += 1;
    } while (page <= totalPages && page <= maxPagesPerScope);
  }

  return result;
}

// El precio vive en una llamada aparte. Si esa llamada concreta falla, se
// guarda el curso sin precio en vez de descartarlo: es mejor tener el curso en
// el catálogo que perderlo por un fallo puntual del endpoint de detalle.
async function fetchDetailTolerantly(
  creds: UdemyCredentials,
  rawId: unknown,
  result: UdemyJobResult
): Promise<Awaited<ReturnType<typeof api.fetchCourseDetail>> | null> {
  if (typeof rawId !== "number") return null;
  try {
    return await api.fetchCourseDetail(creds, rawId);
  } catch (error) {
    if (error instanceof UdemyShapeError) throw error;
    result.failedCourses.push({
      id: rawId,
      error: `detalle no disponible: ${error instanceof Error ? error.message : String(error)}`,
    });
    return null;
  }
}
