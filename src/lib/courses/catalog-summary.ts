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
    const { count, error } = await client
      .from("courses")
      .select("id", { count: "exact", head: true });

    if (error) return null;

    // Solo se cuentan las fuentes que hoy aportan cursos, no las que existen
    // en el código: prometer "2 plataformas" con una vacía sería falso.
    const conteos = await Promise.all(
      COURSE_SOURCES.map(async (source) => {
        const { count: n, error: e } = await client
          .from("courses")
          .select("id", { count: "exact", head: true })
          .eq("source", source);
        return !e && (n ?? 0) > 0;
      })
    );

    return summarizeCatalog(count ?? null, conteos.filter(Boolean).length);
  } catch {
    return null;
  }
}
