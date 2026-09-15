import type { SupabaseClient } from "@supabase/supabase-js";
import { COURSE_SOURCES, type CourseSource } from "./schema";
import type { CourseSearchFilters, OrdenResultados } from "./search-filters";
import type { DurationRange } from "./duration";

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
  duration: DurationRange | null;
}

const DEFAULT_LIMIT = 50;

export interface CourseSearchPage {
  resultados: CourseSearchResult[];
  /** Página servida, empezando en 1. */
  pagina: number;
  /** Si hay al menos un resultado más después de esta página. */
  hayMas: boolean;
  /**
   * Cuántos cursos cumplen la búsqueda **en total**, no cuántos caben en esta
   * página (HU-028). Con reparto equilibrado son dos consultas, una por fuente,
   * así que es la suma de las dos.
   */
  total: number;
}

// PostgREST interpreta `,`, `(` y `)` como separadores dentro del valor de un
// filtro .or(); si el texto de búsqueda del visitante los contiene sin
// escapar, rompe la sintaxis del filtro en vez de tratarse como texto literal.
export function escapeOrFilterValue(value: string): string {
  return value.replace(/[,()]/g, (char) => `\\${char}`);
}

// Con menos de tres letras o números, el índice de trigramas (HU-057) no sirve
// y la búsqueda leería las 15.000 descripciones enteras: ~2,6 s por página,
// cerca del límite de 3 s del rol anon. Se cuentan letras y números, no
// caracteres: los trigramas solo se forman con ellos, y `%%%` —tres
// caracteres, cero letras— seguía tardando 1,4 s. En la descripción tampoco
// aportan nada: «ab» aparece en el 84 % de los cursos, casi siempre dentro de
// otra palabra. Con tan pocas letras («Go», «UX», «IA», «C++») lo que se busca
// es el nombre del curso.
export const LONGITUD_MINIMA_EN_DESCRIPCION = 3;

export interface PatronPalabraClave {
  /** Patrón para ILIKE, ya escapado para Postgres y para el filtro .or() de PostgREST. */
  patron: string;
  /** Si solo se busca en el título. */
  soloTitulo: boolean;
}

// HU-057. `%` y `_` son comodines de ILIKE: sin escaparlos, buscar «100%»
// encontraba «100 cursos» y `%%%` devolvía el catálogo entero leyendo la tabla.
// Se escapan con barra invertida (también la propia barra), que es el escape por
// defecto de LIKE y llega intacto a través de PostgREST (comprobado contra el
// PostgREST real: `\%` en .or() e .ilike() da los mismos cursos que en SQL).
export function patronPalabraClave(keyword: string): PatronPalabraClave {
  const sinComodines = keyword.replace(/[\\%_]/g, (c) => `\\${c}`);
  return {
    patron: `%${escapeOrFilterValue(sinComodines)}%`,
    soloTitulo: (keyword.match(/[\p{L}\p{N}]/gu) ?? []).length < LONGITUD_MINIMA_EN_DESCRIPCION,
  };
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
  duration_min_minutes: number | null;
  duration_max_minutes: number | null;
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
    duration:
      row.duration_min_minutes === null || row.duration_max_minutes === null
        ? null
        : { minMinutes: row.duration_min_minutes, maxMinutes: row.duration_max_minutes },
  };
}

// Reparte los resultados alternando fuentes: uno de cada una por ronda, en el
// orden en que vienen (mejor valorados primero dentro de su fuente). Si una se
// agota, el resto se completa con las demás.
interface ResultadoFuente {
  filas: CourseSearchResult[];
  total: number;
}

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

// Prioriza sin filtrar (HU-032): dentro de un grupo ya traído de la base, los
// cursos en el idioma preferido pasan delante, pero ninguno desaparece — es
// una partición estable, igual criterio que interleaveBySource: no reordena
// dentro de cada grupo, solo los agrupa. `idioma` ya viene saneado a un
// código de dos letras por preferredLanguageFrom; da igual si no coincide con
// ninguno de verdad, simplemente no habrá coincidencias.
export function priorizarIdioma(
  cursos: readonly CourseSearchResult[],
  idioma: string | null
): CourseSearchResult[] {
  if (idioma === null) return [...cursos];

  const preferidos: CourseSearchResult[] = [];
  const resto: CourseSearchResult[] = [];
  for (const curso of cursos) {
    (curso.language?.toLowerCase() === idioma ? preferidos : resto).push(curso);
  }
  return [...preferidos, ...resto];
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
  limit: number = DEFAULT_LIMIT,
  // Idioma preferido del visitante (HU-032), ya saneado por
  // preferredLanguageFrom. Aparte de `filters` a propósito: no es algo que la
  // persona haya escrito ni algo que deba viajar en el enlace de la página —
  // se recalcula cada visita desde la cabecera Accept-Language.
  preferredLanguage: string | null = null
): Promise<CourseSearchPage> {
  const pagina = Math.max(1, filters.pagina);

  // Con un orden pedido, el reparto equilibrado entre plataformas **estorba**:
  // alternar una de cada no está ordenado por precio por mucho que cada mitad
  // lo esté. Así que se consulta una sola vez, ordenada de verdad, y los cursos
  // sin ese dato caen al final. Quien ha pedido ordenar por precio ha pedido
  // justo eso (HU-027). Mismo motivo por el que aquí tampoco se prioriza por
  // idioma (HU-032): un orden explícito manda tal cual, sin sesgos añadidos.
  if (filters.orden !== null) {
    return searchCoursesOrdenado(client, filters, filters.orden, pagina, limit);
  }

  // Se pide a cada fuente todo lo que va **hasta el final** de la página, más
  // un resultado. No se puede pedir solo el trozo de esta página: cuántos pone
  // cada fuente en una página depende de si la otra se agotó antes, y eso solo
  // se sabe intercalando desde el principio. El extra es lo que permite decir
  // si hay página siguiente sin una segunda consulta que la cuente (HU-025).
  const porFuente = await Promise.all(
    COURSE_SOURCES.map((source) =>
      searchCoursesFromSource(client, filters, source, pagina * limit + 1)
    )
  );

  const pagina1 = paginarIntercalado(
    porFuente.map((f) => f.filas),
    pagina,
    limit,
    // La suma de los totales de cada fuente: cada una cuenta la suya, así que
    // no se puede sumar en una sola consulta como en el camino ordenado.
    porFuente.reduce((suma, f) => suma + f.total, 0)
  );

  // HU-032, y solo en la página 1: se reordena el array **ya paginado**, no
  // antes de intercalar. Se probó reordenar cada fuente antes de intercalar
  // (parecía más "limpio") y tenía un fallo real: el elemento de más que se
  // trae solo para saber si hay página siguiente podía colarse delante por
  // ser del idioma preferido, empujando fuera a uno que sí tocaba mostrar —
  // ese curso desaparecía sin más, porque la página 2 continúa desde el corte
  // de verdad (sin idioma de por medio), no desde donde reordenar lo dejara.
  // Reordenando después, sobre el resultado ya decidido, es imposible que
  // cambie **qué** cursos se muestran, solo el orden en que se ven — así no
  // hay ninguna forma de que rompa el «sin repetir, sin saltarse ninguno» de
  // HU-025. Solo en la página 1 porque es la única vez que tiene sentido: en
  // cualquier otra, el conjunto ya está fijado por el corte de la anterior.
  if (pagina === 1 && preferredLanguage !== null) {
    return { ...pagina1, resultados: priorizarIdioma(pagina1.resultados, preferredLanguage) };
  }

  return pagina1;
}

// Una sola consulta global. Aquí sí se puede saltar directamente al trozo que
// toca (`range`), porque no hay nada que intercalar: el orden lo pone Postgres.
async function searchCoursesOrdenado(
  client: SupabaseClient,
  filters: CourseSearchFilters,
  orden: OrdenResultados,
  pagina: number,
  limit: number
): Promise<CourseSearchPage> {
  const desde = (pagina - 1) * limit;

  let query = aplicarFiltros(seleccionBase(client), filters);

  // Un reparto por clave y no un ternario: con el tercer orden (duración,
  // HU-047) el ternario dejaba de leerse, y el cuarto lo empeoraría más.
  //
  // `nullsFirst: false` en todos: un curso sin precio no es el más barato, uno
  // sin valoración no es el mejor, y uno que no publica duración no es el más
  // corto. Un hueco no es un cero — la misma regla que ya rige el filtro de
  // HU-026 y el comparador.
  //
  // La duración ordena por el **mínimo** del rango: Coursera publica cosas como
  // «12 h–20 h», y quien busca lo más corto compara por lo mínimo que le va a
  // costar.
  const COLUMNA: Record<OrdenResultados, { columna: string; ascendente: boolean }> = {
    "precio-asc": { columna: "price_amount", ascendente: true },
    "valoracion-desc": { columna: "rating", ascendente: false },
    "duracion-asc": { columna: "duration_min_minutes", ascendente: true },
  };

  const { columna, ascendente } = COLUMNA[orden];
  query = query.order(columna, { ascending: ascendente, nullsFirst: false });

  // Se pide uno de más para saber si hay página siguiente, igual que en el
  // camino intercalado.
  const { data, error, count } = await query
    .order("id", { ascending: true })
    .range(desde, desde + limit);

  if (error) {
    throw new Error(`Fallo al buscar cursos: ${error.message}`);
  }

  const filas = (data ?? []).map(mapRow);

  return {
    resultados: filas.slice(0, limit),
    pagina,
    hayMas: filas.length > limit,
    // `count` no falta nunca en la práctica: se pide `{ count: "exact" }` en
    // toda consulta y PostgREST lo devuelve salvo error, que ya se lanza antes
    // de llegar aquí. El resguardo es solo para no confiar ciegamente en un
    // contrato externo. `filas.length` NO valdría como resguardo: incluye la
    // fila de más que se pide para saber si hay página siguiente, así que
    // contaría un curso de más justo en la última página.
    total: count ?? desde + Math.min(filas.length, limit),
  };
}

// `count: "exact"` viaja en la misma petición que los resultados: PostgREST lo
// devuelve en la cabecera Content-Range, así que no hay consulta extra (HU-028).
// Es un COUNT sobre el conjunto filtrado; con 8.796 filas no se nota. Conviene
// volver a mirarlo si el catálogo crece un orden de magnitud.
function seleccionBase(client: SupabaseClient) {
  return client
    .from("courses")
    .select(
      "id, source, title, description, price_amount, price_currency, rating, language, image_url, affiliate_url, duration_min_minutes, duration_max_minutes",
      { count: "exact" }
    );
}

/**
 * Trocea en páginas la lista ya intercalada (HU-025).
 *
 * Va aparte de `searchCourses` porque es donde vive lo que puede salir mal
 * —repetir un curso entre páginas, perder la alternancia, decir que hay
 * siguiente cuando no la hay— y así se prueba sin base de datos de por medio.
 *
 * Espera que cada grupo llegue con los resultados hasta el final de la página
 * pedida **más uno**; ese sobrante es lo que delata que hay más.
 */
export function paginarIntercalado(
  groups: CourseSearchResult[][],
  pagina: number,
  limit: number,
  total: number
): CourseSearchPage {
  const fin = pagina * limit;
  const intercalados = interleaveBySource(groups, fin + 1);

  return {
    resultados: intercalados.slice(fin - limit, fin),
    pagina,
    hayMas: intercalados.length > fin,
    total,
  };
}

async function searchCoursesFromSource(
  client: SupabaseClient,
  filters: CourseSearchFilters,
  source: CourseSource,
  limit: number
): Promise<ResultadoFuente> {
  const query = aplicarFiltros(seleccionBase(client).eq("source", source), filters);

  const { data, error, count } = await query
    .order("rating", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    // Desempate por un campo único, necesario desde que hay paginación
    // (HU-025). Los 4.000 cursos de Coursera tienen `rating` nulo y muchos
    // comparten `updated_at` porque entraron en la misma pasada, así que sin un
    // tercer criterio hay miles de filas empatadas y Postgres no promete
    // devolver los empates en el mismo orden entre dos consultas — bastaría un
    // plan distinto para que la página 2 repitiera cursos de la 1.
    //
    // Hoy, contra la base real, el orden sale estable también sin esto: el test
    // de integración pasa igual quitándolo. Se mantiene porque la garantía la
    // da el ORDER BY, no la casualidad de que el plan de hoy sea el de mañana.
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Fallo al buscar cursos: ${error.message}`);
  }

  return { filas: (data ?? []).map(mapRow), total: count ?? 0 };
}

// Los filtros son los mismos se ordene como se ordene, así que viven en un solo
// sitio: si mañana se añade uno y solo se pusiera en un camino, una de las dos
// búsquedas devolvería cursos que no cumplen lo pedido (HU-027).
type ConsultaCursos = ReturnType<typeof seleccionBase>;

function aplicarFiltros(base: ConsultaCursos, filters: CourseSearchFilters): ConsultaCursos {
  let query = base;

  if (filters.keyword) {
    const { patron, soloTitulo } = patronPalabraClave(filters.keyword);
    query = soloTitulo
      ? query.ilike("title", patron)
      : query.or(`title.ilike.${patron},description.ilike.${patron}`);
  }
  if (filters.category !== null) {
    query = query.eq("category", filters.category);
  }
  // Un curso sin precio no incumple «menos de 20 €»: es que no se sabe. En SQL
  // `price_amount <= 20` es NULL para él, y una condición nula descarta la fila
  // — que es como los 4.000 cursos de Coursera desaparecían en cuanto alguien
  // tocaba este filtro. Se sigue descartándolos por defecto, porque quien pide
  // un precio máximo no quiere ruido de precio desconocido, pero ahora se puede
  // pedir lo contrario (HU-026).
  if (filters.maxPrice !== null) {
    query = filters.incluirSinDato
      ? query.or(`price_amount.lte.${filters.maxPrice},price_amount.is.null`)
      : query.lte("price_amount", filters.maxPrice);
  }
  if (filters.minRating !== null) {
    query = filters.incluirSinDato
      ? query.or(`rating.gte.${filters.minRating},rating.is.null`)
      : query.gte("rating", filters.minRating);
  }
  // Por el **máximo** del rango y no por el mínimo (HU-048). Es lo contrario
  // que el orden por duración (HU-047), y a propósito: para ordenar interesa lo
  // menos que puede costarte, pero un techo hay que medirlo por lo más que
  // puede costarte. Un curso de «1 h–20 h» no cumple «como mucho 2 horas».
  // Mismo trato de los huecos que precio y valoración: fuera salvo que se pidan.
  if (filters.maxDuration !== null) {
    query = filters.incluirSinDato
      ? query.or(`duration_max_minutes.lte.${filters.maxDuration},duration_max_minutes.is.null`)
      : query.lte("duration_max_minutes", filters.maxDuration);
  }
  if (filters.language !== null) {
    query = query.ilike("language", filters.language);
  }

  return query;
}
