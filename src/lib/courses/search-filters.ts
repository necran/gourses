import { COURSE_CATEGORIES, type CourseCategory } from "./categories.ts";
import { conSeparadorDeMiles } from "../formato-numero.ts";

// Entrada cruda de la query string de /buscar — nunca se confía en el tipo
// ni el rango de estos valores antes de sanearlos (ver .claude/rules/seguridad.md).
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface CourseSearchFilters {
  keyword: string | null;
  category: CourseCategory | null;
  maxPrice: number | null;
  minRating: number | null;
  /**
   * Techo de duración **en minutos** (HU-048), aunque se pida y se enseñe en
   * horas: en minutos está la columna, y así no hay que convertir en cada
   * consulta. La conversión vive en un solo sitio, al parsear y al volver a
   * construir el enlace.
   */
  maxDuration: number | null;
  language: string | null;
  /** Página de resultados, empezando en 1 (HU-025). */
  pagina: number;
  /**
   * Si los filtros de precio, valoración y duración deben admitir también los
   * cursos que **no publican** ese dato (HU-026, HU-048). Por defecto no: quien
   * pide «menos de 20 €» no quiere ruido de precio desconocido. Pero se puede
   * pedir, porque lo contrario esconde los 4.000 cursos de Coursera sin decir
   * nada.
   */
  incluirSinDato: boolean;
  /**
   * Orden pedido, o `null` para el de por defecto (HU-027).
   *
   * `null` **no** significa «sin orden»: significa el reparto equilibrado entre
   * plataformas de HU-007, que es lo que se ve al entrar. Los otros ordenan
   * de verdad, de arriba abajo, y entonces el reparto se pierde a propósito.
   */
  orden: OrdenResultados | null;
}

/** Órdenes que se admiten. Cualquier otro valor no existe (HU-027, HU-047). */
export const ORDENES = ["precio-asc", "valoracion-desc", "duracion-asc"] as const;
export type OrdenResultados = (typeof ORDENES)[number];

// El tipo `Record` obliga a que cada orden tenga su etiqueta: añadir uno a
// ORDENES sin nombrarlo aquí no compila, y así ninguna opción del desplegable
// puede salir sin nombre.
export const ETIQUETAS_ORDEN: Record<OrdenResultados, string> = {
  "precio-asc": "Precio: de menor a mayor",
  "valoracion-desc": "Mejor valorados",
  // Solo de menor a mayor (HU-047): quien ordena por duración busca lo que
  // puede terminar, no lo más largo.
  "duracion-asc": "Duración: de menor a mayor",
};

/**
 * Texto del recuento de resultados (HU-028). Aparte, sencilla y sin JSX, para
 * poder probar el singular/plural y los números grandes sin montar la página.
 */
export function textoRecuento(total: number): string {
  if (total === 0) return "No se ha encontrado ningún curso con esos criterios.";
  if (total === 1) return "1 curso encontrado.";
  return `${conSeparadorDeMiles(total)} cursos encontrados.`;
}

/**
 * Si la búsqueda tiene algún filtro que descarta cursos **por no tener el
 * dato**, no por incumplirlo. Es la condición para avisar: un aviso que sale
 * siempre es ruido y se deja de leer (HU-026).
 */
export function excluyePorFaltaDeDato(filters: CourseSearchFilters): boolean {
  return (
    !filters.incluirSinDato &&
    (filters.maxPrice !== null || filters.minRating !== null || filters.maxDuration !== null)
  );
}

/**
 * Qué dato se está exigiendo, para nombrarlo en el aviso: «precio»,
 * «valoración o duración», «precio, valoración o duración»… Solo lo que de
 * verdad se está filtrando, para que el aviso no hable de valoraciones cuando
 * únicamente se ha puesto un precio.
 *
 * Vive aquí y no en la página (HU-048) porque con tres filtros ya hay seis
 * combinaciones y merece test propio.
 */
export function textoDatoQueFalta(filters: CourseSearchFilters): string {
  const datos = [
    filters.maxPrice !== null ? "precio" : null,
    filters.minRating !== null ? "valoración" : null,
    filters.maxDuration !== null ? "duración" : null,
  ].filter((dato): dato is string => dato !== null);

  if (datos.length <= 1) return datos[0] ?? "";
  return `${datos.slice(0, -1).join(", ")} o ${datos[datos.length - 1]}`;
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

/**
 * Tope de la duración pedida, en horas. Mismo motivo que el del precio: el
 * valor acaba interpolado en un filtro `.or()` de PostgREST (HU-048), así que
 * tiene que ser siempre un número corto y normal. El curso más largo del
 * catálogo son 382 horas, así que 1.000 no recorta ninguna búsqueda real.
 */
const MAX_DURATION_HORAS = 1_000;

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

// Se pide en horas porque es como se piensa («hora y media»), y se guarda en
// minutos porque es como está en la base. Se redondea: sin ello, 2,5 h daría
// 150.00000000000003 dentro de un filtro que viaja como texto (HU-048).
function parseDuracionEnHoras(raw: string | undefined): number | null {
  const horas = parseNonNegativeNumber(raw, MAX_DURATION_HORAS);
  return horas === null ? null : Math.round(horas * 60);
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
    maxDuration: parseDuracionEnHoras(firstValue(params.maxDuration)),
    language: parseLanguage(firstValue(params.language)),
    pagina: parsePagina(firstValue(params.pagina)),
    incluirSinDato: parseIncluirSinDato(firstValue(params.sinDato)),
    orden: parseOrden(firstValue(params.orden)),
  };
}
