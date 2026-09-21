import type { SupabaseClient } from "@supabase/supabase-js";
import { COURSE_SOURCES } from "./schema";

export interface CatalogSummary {
  courseCount: number;
  sourceCount: number;
}

// La portada presume del tamaño del catálogo, así que la cifra tiene que venir
// de la base de datos y no del código: un número fijo envejece mal y acabaría
// mintiendo al visitante (HU-012).
export function summarizeCatalog(
  courseCount: number | null,
  sourcesWithCourses: number
): CatalogSummary | null {
  if (courseCount === null || courseCount <= 0) return null;

  return { courseCount, sourceCount: sourcesWithCourses };
}

// Devuelve null si la base de datos no responde o está vacía: la portada debe
// seguir sirviéndose sin cifras antes que romperse por un dato decorativo.
export async function getCatalogSummary(
  client: SupabaseClient
): Promise<CatalogSummary | null> {
  try {
    // Los tres recuentos a la vez (HU-072). Antes se pedía primero el total y, solo
    // después, uno por fuente: dos rondas seguidas, y cada ronda es un viaje de ida
    // y vuelta entre las funciones de Netlify (Virginia) y Supabase (Irlanda). Los
    // recuentos no dependen unos de otros.
    const [total, ...porFuente] = await Promise.all([
      client.from("courses").select("id", { count: "exact", head: true }),
      ...COURSE_SOURCES.map((source) =>
        client.from("courses").select("id", { count: "exact", head: true }).eq("source", source)
      ),
    ]);

    if (total.error) return null;

    // Solo se cuentan las fuentes que hoy aportan cursos, no las que existen
    // en el código: prometer "2 plataformas" con una vacía sería falso.
    const conCursos = porFuente.filter((r) => !r.error && (r.count ?? 0) > 0).length;

    return summarizeCatalog(total.count ?? null, conCursos);
  } catch {
    return null;
  }
}
