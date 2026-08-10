import type { CourseStore } from "../upsert-course.ts";
import { upsertCourse } from "../upsert-course.ts";
import { fetchCourseraCatalogPage } from "./fetch-catalog.ts";
import { CourseraShapeError, normalizeCourseraCourse } from "./normalize.ts";

export interface CourseraJobResult {
  processed: number;
  saved: number;
  failedCourses: Array<{ id: unknown; error: string }>;
}

export interface CourseraJobOptions {
  baseUrl: string;
  store: CourseStore;
  maxPages?: number;
  pageSize?: number;
}

// Job de ingesta de Coursera (HU-006). Se ejecuta bajo demanda (ver
// scripts/ingest-coursera.mjs) — la recurrencia automática se decide en
// Fase 6. Un curso mal formado no rompe el resto del catálogo, pero un
// cambio de forma en la propia respuesta de la API sí detiene el job:
// distinguimos "dato puntual raro" de "la API externa cambió su contrato".
export async function runCourseraIngestJob({
  baseUrl,
  store,
  maxPages = Infinity,
  pageSize = 100,
}: CourseraJobOptions): Promise<CourseraJobResult> {
  const result: CourseraJobResult = { processed: 0, saved: 0, failedCourses: [] };

  let start: string | undefined;
  let page = 0;

  do {
    const catalogPage = await fetchCourseraCatalogPage(baseUrl, { start, limit: pageSize });

    for (const raw of catalogPage.elements) {
      result.processed += 1;
      try {
        const normalized = normalizeCourseraCourse(raw, catalogPage.linked);
        await upsertCourse(store, normalized);
        result.saved += 1;
      } catch (error) {
        if (error instanceof CourseraShapeError) {
          throw error;
        }
        result.failedCourses.push({
          id: (raw as { id?: unknown }).id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    start = catalogPage.next ?? undefined;
    page += 1;
  } while (start && page < maxPages);

  return result;
}
