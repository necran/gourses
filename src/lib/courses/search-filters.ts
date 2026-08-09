// Entrada cruda de la query string de /buscar — nunca se confía en el tipo
// ni el rango de estos valores antes de sanearlos (ver .claude/rules/seguridad.md).
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface CourseSearchFilters {
  keyword: string | null;
  maxPrice: number | null;
  minRating: number | null;
  language: string | null;
}

const MAX_KEYWORD_LENGTH = 200;
const MAX_LANGUAGE_LENGTH = 35;
const MAX_RATING = 5;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseKeyword(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim().slice(0, MAX_KEYWORD_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

function parseNonNegativeNumber(raw: string | undefined, max?: number): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  if (max !== undefined && value > max) return max;
  return value;
}

function parseLanguage(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim().slice(0, MAX_LANGUAGE_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

// Saneado puro: cualquier valor fuera de rango o de tipo inesperado se
// descarta (vuelve a null) en vez de lanzar — un filtro inválido simplemente
// no se aplica, no rompe la búsqueda.
export function parseCourseSearchFilters(params: RawSearchParams): CourseSearchFilters {
  return {
    keyword: parseKeyword(firstValue(params.keyword)),
    maxPrice: parseNonNegativeNumber(firstValue(params.maxPrice)),
    minRating: parseNonNegativeNumber(firstValue(params.minRating), MAX_RATING),
    language: parseLanguage(firstValue(params.language)),
  };
}
