import type { CourseDetail } from "./get-course";
import { isValidCourseId } from "./get-course";
import { CATEGORY_LABELS } from "./categories";
import { formatDuration } from "./duration";
import { sourceLabel } from "./course-seo";

// La comparación no necesita el histórico de precios: pedir el CourseDetail
// completo sería exigir más de lo que usa.
export type ComparableCourse = Omit<CourseDetail, "priceHistory">;

// Por encima de cuatro la vista deja de leerse en una pantalla y comparar ya
// no ayuda, que es justo lo contrario de lo que busca esta página.
export const MAX_COMPARADOS = 4;
export const MIN_COMPARADOS = 2;

// Los identificadores llegan por la URL, así que son entrada externa: se
// validan antes de tocar la base de datos (ver .claude/rules/seguridad.md).
// Se descartan los inválidos y los repetidos, y se recorta al máximo, en vez
// de rechazar la petición entera: si alguien comparte un enlace con un curso
// que ya no existe, es mejor comparar los demás que no mostrar nada.
export function parseCompareIds(raw: string | string[] | undefined): string[] {
  const bruto = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

  // Se admite tanto ?ids=a&ids=b como ?ids=a,b
  const sueltos = bruto.flatMap((v) => String(v).split(","));

  const vistos = new Set<string>();
  const validos: string[] = [];

  for (const id of sueltos) {
    const limpio = id.trim();
    if (!isValidCourseId(limpio)) continue;
    const clave = limpio.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    validos.push(limpio);
    if (validos.length === MAX_COMPARADOS) break;
  }

  return validos;
}

export interface CompareCell {
  /** Texto a mostrar, o null si ese curso no tiene ese dato. */
  valor: string | null;
}

export interface CompareRow {
  etiqueta: string;
  celdas: CompareCell[];
}

function precio(course: ComparableCourse): string | null {
  if (course.priceAmount === null) return null;
  return course.priceCurrency
    ? `${course.priceAmount} ${course.priceCurrency}`
    : String(course.priceAmount);
}

// Construye las filas de la tabla comparativa. Cada fila es un campo y cada
// celda un curso, de modo que el orden de las celdas coincide siempre con el
// de los cursos: es lo que permite leer la tabla en vertical.
//
// Un campo que ningún curso tiene se omite entero: una fila con todos los
// huecos vacíos solo añade ruido.
export function buildCompareRows(courses: ComparableCourse[]): CompareRow[] {
  const definiciones: Array<[string, (c: ComparableCourse) => string | null]> = [
    ["Plataforma", (c) => sourceLabel(c.source)],
    ["Precio", precio],
    ["Valoración", (c) => (c.rating === null ? null : String(c.rating))],
    ["Duración", (c) => formatDuration(c.duration)],
    ["Nivel", (c) => c.level],
    ["Idioma", (c) => c.language],
    ["Categoría", (c) => (c.category ? CATEGORY_LABELS[c.category] : null)],
    ["Imparte", (c) => c.instructor],
  ];

  return definiciones
    .map(([etiqueta, extraer]) => ({
      etiqueta,
      celdas: courses.map((c) => ({ valor: extraer(c) })),
    }))
    .filter((fila) => fila.celdas.some((c) => c.valor !== null));
}
