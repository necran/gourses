import type { CourseStore } from "../upsert-course.ts";
import { upsertCourse } from "../upsert-course.ts";
import * as api from "./fetch-catalog.ts";
import type { UdemyCredentials, UdemyScope } from "./fetch-catalog.ts";
import { UdemyShapeError, normalizeUdemyCourse } from "./normalize.ts";
import { mapConLimite } from "../comun/concurrencia.ts";
import { conReintentos } from "../comun/reintentos.ts";

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
  /** Cuántos detalles de curso se piden a la vez (HU-023). */
  concurrenciaDetalle?: number;
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
  concurrenciaDetalle = 6,
}: UdemyJobOptions): Promise<UdemyJobResult> {
  const result: UdemyJobResult = { processed: 0, saved: 0, scopes: 0, failedCourses: [] };

  const categories = await api.fetchCategories(creds);
  // Cada ámbito arrastra el título de su categoría raíz: es lo que después se
  // mapea al vocabulario común (HU-010). Una subcategoría hereda el de su
  // categoría padre, porque el vocabulario común es de primer nivel.
  const scopes: Array<{ scope: UdemyScope; categoryTitle: string }> = [];

  for (const category of categories) {
    scopes.push({ scope: { kind: "category", id: category.id }, categoryTitle: category.title });
    if (includeSubcategories) {
      const subcategories = await api.fetchSubcategories(creds, category.id);
      for (const sub of subcategories) {
        scopes.push({
          scope: { kind: "subcategory", id: sub.id },
          categoryTitle: category.title,
        });
      }
    }
  }

  const seen = new Set<string>();

  for (const { scope, categoryTitle } of scopes.slice(0, maxScopes)) {
    const unitUrl = await api.fetchCourseUnitUrl(creds, scope);
    // Un ámbito sin unidad de cursos no es un error: simplemente no aporta nada.
    if (!unitUrl) continue;

    result.scopes += 1;
    let page = 1;
    let totalPages = 1;

    do {
      const unitPage = await api.fetchUnitPage(creds, unitUrl, scope, { page, pageSize });
      totalPages = unitPage.totalPages;

      // La deduplicación se hace ANTES de repartir el trabajo, y en serie: si
      // se hiciera dentro de las tareas concurrentes, dos obreros podrían mirar
      // el mismo curso a la vez, no verlo todavía en `seen`, y pedir su detalle
      // dos veces. Los ámbitos se solapan mucho, así que eso convertiría la
      // concurrencia en trabajo repetido.
      const nuevos: typeof unitPage.items = [];
      for (const raw of unitPage.items) {
        const key = String((raw as { id?: unknown }).id);
        if (seen.has(key)) continue;
        seen.add(key);
        nuevos.push(raw);
      }

      result.processed += nuevos.length;

      // Aquí está el tiempo del job: una petición de detalle por curso, a 0,45 s
      // cada una. En serie no cabe en el tope del workflow (HU-023).
      const errores = await mapConLimite(nuevos, concurrenciaDetalle, async (raw) => {
        const rawId = (raw as { id?: unknown }).id;
        try {
          const detail = await fetchDetailTolerantly(creds, rawId, result);
          const normalized = normalizeUdemyCourse(raw, detail, creds.baseUrl, categoryTitle);
          await upsertCourse(store, normalized);
          return null;
        } catch (error) {
          if (error instanceof UdemyShapeError) return error;
          return {
            id: rawId,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      // Un cambio de forma de la API sí detiene el job, como antes: se propaga
      // fuera de las tareas para no perderlo entre los fallos tolerados.
      for (const e of errores) {
        if (e instanceof UdemyShapeError) throw e;
        if (e) result.failedCourses.push(e);
        else result.saved += 1;
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
    // El reintento va aquí dentro, envolviendo la llamada de verdad. Si se
    // pusiera fuera de esta función no serviría de nada: el `catch` de abajo
    // se traga el error y devuelve null, así que quien envolviera desde fuera
    // nunca vería el 429 que quiere reintentar.
    return await conReintentos(() => api.fetchCourseDetail(creds, rawId));
  } catch (error) {
    if (error instanceof UdemyShapeError) throw error;
    result.failedCourses.push({
      id: rawId,
      error: `detalle no disponible: ${error instanceof Error ? error.message : String(error)}`,
    });
    return null;
  }
}
