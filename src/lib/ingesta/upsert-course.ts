import type { NormalizedCourse } from "../courses/schema";

// Puerto mínimo que necesita upsertCourse — implementado por adaptadores
// reales (Postgres) o por dobles de test, sin acoplar esta lógica a ningún
// cliente de base de datos concreto.
export interface CourseStore {
  findBySourceAndSourceId(
    source: string,
    sourceId: string
  ): Promise<{
    id: string;
    priceAmount: number | null;
    priceCurrency: string | null;
    description: string | null;
    numReviews: number | null;
    numSubscribers: number | null;
    whatYouWillLearn: string[] | null;
    requirements: string[] | null;
  } | null>;
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

  // Se conserva lo que ya había del detalle: precio, descripción real y
  // estadísticas (HU-029). Todo viene de la misma llamada de Udemy, así que
  // cuando falla, falla todo a la vez — sin esto, un 429 pasajero machacaba
  // con null un precio bueno (y de paso metía en course_price_history una
  // bajada que nunca ocurrió, que es lo que dispara los avisos de HU-021), o
  // borraba una descripción real que ya se había conseguido en una pasada
  // anterior.
  const aGuardar = desconocido
    ? {
        ...course,
        priceAmount: existing.priceAmount,
        priceCurrency: existing.priceCurrency,
        description: existing.description,
        numReviews: existing.numReviews,
        numSubscribers: existing.numSubscribers,
        whatYouWillLearn: existing.whatYouWillLearn,
        requirements: existing.requirements,
      }
    : course;

  const priceChanged = !desconocido && pricesDiffer(existing, course);
  await store.updateCourse(existing.id, aGuardar);
  if (priceChanged) {
    await store.insertPriceHistory(existing.id, course.priceAmount, course.priceCurrency);
  }
  return { id: existing.id, priceChanged };
}
