import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseSource } from "./schema";
import type { CourseCategory } from "./categories";
import type { PriceHistoryEntry } from "./price-display";
import type { DurationRange } from "./duration";

export interface CourseDetail {
  id: string;
  source: CourseSource;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  rating: number | null;
  level: string | null;
  language: string | null;
  instructor: string | null;
  imageUrl: string | null;
  affiliateUrl: string | null;
  category: CourseCategory | null;
  duration: DurationRange | null;
  priceHistory: PriceHistoryEntry[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El id llega de la URL, así que es entrada externa: se valida la forma antes
// de tocar la base de datos (ver .claude/rules/seguridad.md). Un id con
// cualquier otra forma se trata como "no existe", sin llegar a consultar.
export function isValidCourseId(id: string): boolean {
  return UUID_RE.test(id);
}

interface CourseRow {
  id: string;
  source: CourseSource;
  title: string;
  description: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  rating: number | string | null;
  level: string | null;
  language: string | null;
  instructor: string | null;
  image_url: string | null;
  affiliate_url: string | null;
  category: CourseCategory | null;
  duration_min_minutes: number | null;
  duration_max_minutes: number | null;
}

interface PriceHistoryRow {
  price_amount: number | string | null;
  price_currency: string | null;
  captured_at: string;
}

function toNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function mapRow(row: CourseRow): Omit<CourseDetail, "priceHistory"> {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    description: row.description,
    priceAmount: toNumber(row.price_amount),
    priceCurrency: row.price_currency,
    rating: toNumber(row.rating),
    level: row.level,
    language: row.language,
    instructor: row.instructor,
    imageUrl: row.image_url,
    affiliateUrl: row.affiliate_url,
    category: row.category,
    duration:
      row.duration_min_minutes === null || row.duration_max_minutes === null
        ? null
        : { minMinutes: row.duration_min_minutes, maxMinutes: row.duration_max_minutes },
  };
}

const CAMPOS_CURSO =
  "id, source, title, description, price_amount, price_currency, rating, level, language, instructor, image_url, affiliate_url, category, duration_min_minutes, duration_max_minutes";

// Recupera varios cursos de una vez para el comparador (HU-017). Los ids ya
// vienen validados por parseCompareIds, pero se vuelven a filtrar aquí porque
// esta función es pública y no debe fiarse de quien la llame.
//
// Los ids que no existen simplemente no aparecen en el resultado: un enlace
// compartido con un curso retirado debe seguir comparando los demás. El orden
// devuelto respeta el de los ids pedidos, que es el que ve el usuario.
export async function getCoursesByIds(
  client: SupabaseClient,
  ids: string[]
): Promise<Array<Omit<CourseDetail, "priceHistory">>> {
  const validos = ids.filter(isValidCourseId);
  if (validos.length === 0) return [];

  const { data, error } = await client.from("courses").select(CAMPOS_CURSO).in("id", validos);

  if (error) {
    throw new Error(`Fallo al leer los cursos: ${error.message}`);
  }

  const porId = new Map((data as CourseRow[] | null ?? []).map((r) => [r.id, mapRow(r)]));
  return validos.map((id) => porId.get(id)).filter((c): c is Omit<CourseDetail, "priceHistory"> => !!c);
}

// Lee un curso y su histórico de precio vía PostgREST/anon, respetando la RLS
// de lectura pública de HU-004. Devuelve null si el id no es válido o no existe.
export async function getCourseById(
  client: SupabaseClient,
  id: string
): Promise<CourseDetail | null> {
  if (!isValidCourseId(id)) return null;

  const { data, error } = await client
    .from("courses")
    .select(
      "id, source, title, description, price_amount, price_currency, rating, level, language, instructor, image_url, affiliate_url, category, duration_min_minutes, duration_max_minutes"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Fallo al leer el curso: ${error.message}`);
  }
  if (!data) return null;

  const row = data as CourseRow;

  const { data: historyData, error: historyError } = await client
    .from("course_price_history")
    .select("price_amount, price_currency, captured_at")
    .eq("course_id", id)
    .order("captured_at", { ascending: true });

  if (historyError) {
    throw new Error(`Fallo al leer el histórico de precio: ${historyError.message}`);
  }

  const priceHistory = ((historyData ?? []) as PriceHistoryRow[]).map((h) => ({
    priceAmount: toNumber(h.price_amount),
    priceCurrency: h.price_currency,
    capturedAt: h.captured_at,
  }));

  return {
    id: row.id,
    source: row.source,
    title: row.title,
    description: row.description,
    priceAmount: toNumber(row.price_amount),
    priceCurrency: row.price_currency,
    rating: toNumber(row.rating),
    level: row.level,
    language: row.language,
    instructor: row.instructor,
    imageUrl: row.image_url,
    affiliateUrl: row.affiliate_url,
    category: row.category,
    duration:
      row.duration_min_minutes === null || row.duration_max_minutes === null
        ? null
        : { minMinutes: row.duration_min_minutes, maxMinutes: row.duration_max_minutes },
    priceHistory,
  };
}
