import { COURSE_CATEGORIES, type CourseCategory } from "./categories.ts";

// Entrada cruda de la query string de /buscar — nunca se confía en el tipo
// ni el rango de estos valores antes de sanearlos (ver .claude/rules/seguridad.md).
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface CourseSearchFilters {
  keyword: string | null;
  category: CourseCategory | null;
  maxPrice: number | null;
  minRating: number | null;
  language: string | null;
  /** Página de resultados, empezando en 1 (HU-025). */
  pagina: number;
  /**
   * Si los filtros de precio y valoración deben admitir también los cursos que
   * **no publican** ese dato (HU-026). Por defecto no: quien pide «menos de
   * 20 €» no quiere ruido de precio desconocido. Pero se puede pedir, porque
   * lo contrario esconde los 4.000 cursos de Coursera sin decir nada.
   */
  incluirSinDato: boolean;
  /**
   * Orden pedido, o `null` para el de por defecto (HU-027).
   *
   * `null` **no** significa «sin orden»: significa el reparto equilibrado entre
   * plataformas de HU-007, que es lo que se ve al entrar. Los otros dos ordenan
   * de verdad, de arriba abajo, y entonces el reparto se pierde a propósito.
   */
  orden: OrdenResultados | null;
}

/** Órdenes que se admiten. Cualquier otro valor no existe (HU-027). */
export const ORDENES = ["precio-asc", "valoracion-desc"] as const;
export type OrdenResultados = (typeof ORDENES)[number];

export const ETIQUETAS_ORDEN: Record<OrdenResultados, string> = {
  "precio-asc": "Precio: de menor a mayor",
  "valoracion-desc": "Mejor valorados",
};

/**
 * Si la búsqueda tiene algún filtro que descarta cursos **por no tener el
 * dato**, no por incumplirlo. Es la condición para avisar: un aviso que sale
 * siempre es ruido y se deja de leer (HU-026).
 */
export function excluyePorFaltaDeDato(filters: CourseSearchFilters): boolean {
  return !filters.incluirSinDato && (filters.maxPrice !== null || filters.minRating !== null);
}

const MAX_KEYWORD_LENGTH = 200;

/**
 * Hasta qué página se puede saltar de un tirón.
 *
 * No es un límite de producto sino de coste: la consulta trae los resultados
 * **hasta el final** de la página pedida para poder intercalar las fuentes, así
 * que la profundidad la marca quien escribe la dirección. Sin tope, un
 * `?pagina=99999999` obligaría a recorrer el catálogo entero por cada visita.
 *
 * 200 páginas son 10.000 resultados, más que el catálogo actual (8.796), así
 * que hoy no esconde nada: solo pone un techo a lo que puede pedir un extraño.
 */
export const MAX_PAGINA = 200;
const MAX_LANGUAGE_LENGTH = 35;
const MAX_RATING = 5;

/**
 * Tope del precio máximo. No hay curso que se acerque, así que no recorta
 * ninguna búsqueda real; está para que el valor sea siempre un número corto.
 * Desde HU-026 el precio se interpola en el texto de un filtro `.or()` de
 * PostgREST, y `String(1e21)` da `"1e+21"`, que ahí no significa nada.
 */
const MAX_PRICE = 100_000;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseKeyword(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim().slice(0, MAX_KEYWORD_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

// Solo se aceptan identificadores del vocabulario conocido. Uno inventado se
// descarta y el filtro no se aplica: así una dirección compartida con una
// categoría que ya no existe sigue enseñando cursos en vez de fallar.
//
// Se compara contra el identificador estable guardado en base de datos, nunca
// contra la etiqueta visible, que es solo cómo se enseña y puede cambiar.
function parseCategory(raw: string | undefined): CourseCategory | null {
  if (raw === undefined) return null;
  const limpio = raw.trim().toLowerCase();
  return (COURSE_CATEGORIES as readonly string[]).includes(limpio)
    ? (limpio as CourseCategory)
    : null;
}

function parseNonNegativeNumber(raw: string | undefined, max?: number): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  if (max !== undefined && value > max) return max;
  return value;
}

// Una página inválida no es motivo para no enseñar nada: se vuelve a la
// primera, que es lo que la persona quería ver de todos modos. Se aceptan solo
// enteros: `?pagina=2.5` no significa nada.
function parsePagina(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 1;
  const valor = Number(raw);
  if (!Number.isInteger(valor) || valor < 1) return 1;
  return Math.min(valor, MAX_PAGINA);
}

// Una casilla marcada, no un número: solo cuenta el "sí" explícito. Cualquier
// otra cosa —ausente, vacía, "0", basura— es que no se ha pedido.
// Igual que la categoría: solo vale lo del vocabulario conocido. Uno inventado
// se descarta y se usa el orden por defecto, en vez de fallar — una dirección
// compartida con un orden que ya no existe tiene que seguir enseñando cursos.
function parseOrden(raw: string | undefined): OrdenResultados | null {
  if (raw === undefined) return null;
  const limpio = raw.trim().toLowerCase();
  return (ORDENES as readonly string[]).includes(limpio) ? (limpio as OrdenResultados) : null;
}

function parseIncluirSinDato(raw: string | undefined): boolean {
  return raw === "1" || raw === "true";
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
    category: parseCategory(firstValue(params.category)),
    maxPrice: parseNonNegativeNumber(firstValue(params.maxPrice), MAX_PRICE),
    minRating: parseNonNegativeNumber(firstValue(params.minRating), MAX_RATING),
    language: parseLanguage(firstValue(params.language)),
    pagina: parsePagina(firstValue(params.pagina)),
    incluirSinDato: parseIncluirSinDato(firstValue(params.sinDato)),
    orden: parseOrden(firstValue(params.orden)),
  };
}
