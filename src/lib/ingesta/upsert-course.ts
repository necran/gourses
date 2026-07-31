import type { NormalizedCourse } from "../courses/schema";

// Puerto mínimo que necesita upsertCourse — implementado por adaptadores
// reales (Postgres) o por dobles de test, sin acoplar esta lógica a ningún
// cliente de base de datos concreto.
export interface CourseStore {
  findBySourceAndSourceId(
    source: string,
    sourceId: string
  ): Promise<{ id: string; priceAmount: number | null; priceCurrency: string | null } | null>;
  insertCourse(course: NormalizedCourse): Promise<{ id: string }>;
  updateCourse(id: string, course: NormalizedCourse): Promise<void>;
  insertPriceHistory(courseId: string, priceAmount: number | null, priceCurrency: string | null): Promise<void>;
}

function pricesDiffer(
  a: { priceAmount: number | null; priceCurrency: string | null },
  b: { priceAmount: number | null; priceCurrency: string | null }
): boolean {
  return a.priceAmount !== b.priceAmount || a.priceCurrency !== b.priceCurrency;
}

// Guarda un curso normalizado: inserta si es nuevo, actualiza si ya existe,
// y solo añade una fila a course_price_history cuando el precio cambia
// (criterio de aceptación de HU-005, reutilizado por cualquier fuente).
export async function upsertCourse(
  store: CourseStore,
  course: NormalizedCourse
): Promise<{ id: string; priceChanged: boolean }> {
  const existing = await store.findBySourceAndSourceId(course.source, course.sourceId);

  if (!existing) {
    const { id } = await store.insertCourse(course);
    await store.insertPriceHistory(id, course.priceAmount, course.priceCurrency);
    return { id, priceChanged: true };
  }

  const priceChanged = pricesDiffer(existing, course);
  await store.updateCourse(existing.id, course);
  if (priceChanged) {
    await store.insertPriceHistory(existing.id, course.priceAmount, course.priceCurrency);
  }
  return { id: existing.id, priceChanged };
}
