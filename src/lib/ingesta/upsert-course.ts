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

  // Precio desconocido: la fuente no pudo decirnos cuánto cuesta en esta pasada.
  // Se trata como "no tengo dato nuevo", nunca como "vale null".
  const desconocido = course.priceUnknown === true;

  if (!existing) {
    const { id } = await store.insertCourse(course);
    // El curso se guarda igualmente —vale más tenerlo en el catálogo sin precio
    // que perderlo—, pero no se abre un histórico con un precio inventado.
    if (!desconocido) {
      await store.insertPriceHistory(id, course.priceAmount, course.priceCurrency);
    }
    return { id, priceChanged: !desconocido };
  }

  // Se conserva el precio que ya había. Sin esto, un 429 pasajero en la llamada
  // de detalle machacaba con null un precio bueno, y de paso metía en
  // course_price_history una bajada que nunca ocurrió — que es justo lo que
  // dispara los avisos por correo de HU-021.
  const aGuardar = desconocido
    ? { ...course, priceAmount: existing.priceAmount, priceCurrency: existing.priceCurrency }
    : course;

  const priceChanged = !desconocido && pricesDiffer(existing, course);
  await store.updateCourse(existing.id, aGuardar);
  if (priceChanged) {
    await store.insertPriceHistory(existing.id, course.priceAmount, course.priceCurrency);
  }
  return { id: existing.id, priceChanged };
}
