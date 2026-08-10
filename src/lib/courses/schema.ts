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
  rating: number | null;
  level: string | null;
  language: string | null;
  instructor: string | null;
  affiliateUrl: string | null;
  imageUrl: string | null;
  /** Categoría del vocabulario común (HU-010), no la etiqueta de la plataforma. */
  category: CourseCategory | null;
}
