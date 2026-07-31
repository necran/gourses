// Esquema común de curso (HU-004) — toda fuente se normaliza a esto antes de
// guardarse, para que el buscador y el comparador nunca conozcan el origen.
export type CourseSource = "udemy" | "coursera";

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
}
