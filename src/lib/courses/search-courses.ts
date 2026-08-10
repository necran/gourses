import type { SupabaseClient } from "@supabase/supabase-js";
import { COURSE_SOURCES, type CourseSource } from "./schema";
import type { CourseSearchFilters } from "./search-filters";

export interface CourseSearchResult {
  id: string;
  source: CourseSource;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  rating: number | null;
  language: string | null;
  imageUrl: string | null;
  affiliateUrl: string | null;
}

const DEFAULT_LIMIT = 50;

// PostgREST interpreta `,`, `(` y `)` como separadores dentro del valor de un
// filtro .or(); si el texto de búsqueda del visitante los contiene sin
// escapar, rompe la sintaxis del filtro en vez de tratarse como texto literal.
export function escapeOrFilterValue(value: string): string {
  return value.replace(/[,()]/g, (char) => `\\${char}`);
}

interface CourseRow {
  id: string;
  source: CourseSource;
  title: string;
  description: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  rating: number | string | null;
  language: string | null;
  image_url: string | null;
  affiliate_url: string | null;
}

function mapRow(row: CourseRow): CourseSearchResult {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    description: row.description,
    priceAmount: row.price_amount === null ? null : Number(row.price_amount),
    priceCurrency: row.price_currency,
    rating: row.rating === null ? null : Number(row.rating),
    language: row.language,
    imageUrl: row.image_url,
    affiliateUrl: row.affiliate_url,
  };
}

// Reparte los resultados alternando fuentes: uno de cada una por ronda, en el
// orden en que vienen (mejor valorados primero dentro de su fuente). Si una se
// agota, el resto se completa con las demás.
export function interleaveBySource(
  groups: CourseSearchResult[][],
  limit: number
): CourseSearchResult[] {
  const result: CourseSearchResult[] = [];
  const longest = Math.max(0, ...groups.map((g) => g.length));

  for (let round = 0; round < longest && result.length < limit; round += 1) {
    for (const group of groups) {
      if (result.length >= limit) break;
      const course = group[round];
      if (course) result.push(course);
    }
  }

  return result;
}

// Lee de 'courses' vía PostgREST/anon (RLS pública de HU-004), nunca llama a
// una API externa de curso en caliente (ver .claude/rules/ingesta-fuentes.md).
//
// Se consulta una vez por fuente y se intercalan los resultados, en vez de
// hacer una única consulta ordenada por valoración: Coursera no expone
// valoraciones (su API no las tiene, verificado en HU-005), así que un orden
// global por rating dejaba sus 100 cursos fuera de toda la primera página, en
// la portada y en cualquier búsqueda. Un comparador tiene que enseñar las dos
// plataformas, no solo la que puntúa a sus propios cursos.
export async function searchCourses(
  client: SupabaseClient,
  filters: CourseSearchFilters,
  limit: number = DEFAULT_LIMIT
): Promise<CourseSearchResult[]> {
  const groups = await Promise.all(
    COURSE_SOURCES.map((source) => searchCoursesFromSource(client, filters, source, limit))
  );

  return interleaveBySource(groups, limit);
}

async function searchCoursesFromSource(
  client: SupabaseClient,
  filters: CourseSearchFilters,
  source: CourseSource,
  limit: number
): Promise<CourseSearchResult[]> {
  let query = client
    .from("courses")
    .select(
      "id, source, title, description, price_amount, price_currency, rating, language, image_url, affiliate_url"
    )
    .eq("source", source);

  if (filters.keyword) {
    const value = `%${escapeOrFilterValue(filters.keyword)}%`;
    query = query.or(`title.ilike.${value},description.ilike.${value}`);
  }
  if (filters.maxPrice !== null) {
    query = query.lte("price_amount", filters.maxPrice);
  }
  if (filters.minRating !== null) {
    query = query.gte("rating", filters.minRating);
  }
  if (filters.language !== null) {
    query = query.ilike("language", filters.language);
  }

  const { data, error } = await query
    .order("rating", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Fallo al buscar cursos: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}
