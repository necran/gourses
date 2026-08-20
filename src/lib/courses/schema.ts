// Esquema común de curso (HU-004) — toda fuente se normaliza a esto antes de
// guardarse, para que el buscador y el comparador nunca conozcan el origen.
import type { CourseCategory } from "./categories";

export const COURSE_SOURCES = ["udemy", "coursera"] as const;

export type CourseSource = (typeof COURSE_SOURCES)[number];

export interface NormalizedCourse {
  source: CourseSource;
  sourceId: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  /**
   * `true` cuando el precio **no se ha podido averiguar** en esta pasada (la
   * llamada de detalle falló), que no es lo mismo que "este curso no tiene
   * precio". Sin esta distinción, `priceAmount: null` significaba las dos
   * cosas, y un 429 pasajero borraba el precio que ya teníamos guardado.
   * Ausente o `false` = el dato es de fiar, aunque sea null.
   */
  priceUnknown?: boolean;
  rating: number | null;
  level: string | null;
  language: string | null;
  instructor: string | null;
  affiliateUrl: string | null;
  imageUrl: string | null;
  /** Categoría del vocabulario común (HU-010), no la etiqueta de la plataforma. */
  category: CourseCategory | null;
  /** Duración total en minutos (HU-011). Rango, porque a menudo lo es. */
  durationMinMinutes: number | null;
  durationMaxMinutes: number | null;
}
