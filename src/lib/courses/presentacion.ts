import type { CourseSearchFilters } from "./search-filters.ts";

// Cómo se nombran ante la persona los datos que la base guarda como códigos
// (HU-054). Antes las tarjetas decían «udemy · en»: correcto, pero hay que
// saber qué significa. Vive en un solo sitio para que todas las páginas digan
// lo mismo.

const NOMBRES_PLATAFORMA: Record<string, string> = {
  udemy: "Udemy",
  coursera: "Coursera",
};

export function nombrePlataforma(source: string): string {
  return NOMBRES_PLATAFORMA[source] ?? source;
}

// `Intl.DisplayNames` trae los nombres en español del propio motor, así que no
// hay una tabla que mantener. Se crea una vez: construirlo en cada tarjeta, con
// 50 por página, es trabajo tirado.
const nombresDeIdioma = new Intl.DisplayNames(["es"], { type: "language", fallback: "code" });

/** «es» → «Español». Si el código no es válido o no lo conoce, devuelve el código. */
export function nombreIdioma(codigo: string): string {
  let nombre: string | undefined;
  try {
    nombre = nombresDeIdioma.of(codigo);
  } catch {
    // Un código mal formado lanza RangeError; se enseña tal cual antes que romper la página.
    return codigo;
  }
  if (!nombre || nombre === codigo) return codigo;
  return nombre.charAt(0).toLocaleUpperCase("es") + nombre.slice(1);
}

// Los códigos exactos que usa la base, no genéricos: el filtro compara por
// igualdad, así que «pt» no encontraría «pt-BR». Español e inglés primero, que
// son casi todo el catálogo; el resto, por número de cursos (medido el
// 2026-09-15).
export const IDIOMAS_DEL_FILTRO = [
  "es",
  "en",
  "fr",
  "pt-BR",
  "de",
  "it",
  "ar",
  "ja",
  "zh-CN",
  "ko",
] as const;

export interface OpcionIdioma {
  valor: string;
  nombre: string;
}

/**
 * Opciones de la lista de idiomas. Si la dirección trae un idioma que no está en
 * la lista (un enlace antiguo, o uno escrito a mano), se añade: si no, la lista
 * enseñaría «Todos» mientras la búsqueda filtra por otro, y no se entendería.
 */
export function opcionesIdioma(actual: string | null): OpcionIdioma[] {
  const opciones: OpcionIdioma[] = IDIOMAS_DEL_FILTRO.map((valor) => ({
    valor,
    nombre: nombreIdioma(valor),
  }));
  if (actual && !opciones.some((o) => o.valor.toLowerCase() === actual.toLowerCase())) {
    opciones.push({ valor: actual, nombre: nombreIdioma(actual) });
  }
  return opciones;
}

/** El valor de la lista que corresponde a lo que trae la dirección («ES» → «es»). */
export function valorIdiomaSeleccionado(actual: string | null): string {
  if (!actual) return "";
  const enLista = IDIOMAS_DEL_FILTRO.find((v) => v.toLowerCase() === actual.toLowerCase());
  return enLista ?? actual;
}

/**
 * Cuántos de los filtros que se pliegan en el móvil están aplicados. La palabra
 * clave no cuenta: se ve siempre.
 */
export function filtrosPlegadosAplicados(filters: CourseSearchFilters): number {
  return [
    filters.maxPrice !== null,
    filters.minRating !== null,
    filters.maxDuration !== null,
    filters.language !== null,
    filters.category !== null,
    filters.orden !== null,
  ].filter(Boolean).length;
}
