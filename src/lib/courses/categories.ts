// Vocabulario común de categorías (HU-010). Las plataformas usan taxonomías
// distintas ("Development" en Udemy, "computer-science" en Coursera); guardar
// la etiqueta original haría que filtrar por categoría escondiera fuentes
// enteras, el mismo fallo que corrigió HU-005 con el orden por valoración.
//
// Se mantiene corto a propósito: cuantas más categorías, más probable que una
// quede servida por una sola plataforma.
export const COURSE_CATEGORIES = [
  "desarrollo",
  "it-y-software",
  "datos-e-ia",
  "negocios",
  "diseno-y-creatividad",
  "desarrollo-personal",
  "salud-y-bienestar",
  "ciencia-y-matematicas",
  "humanidades-y-sociales",
  "idiomas",
  "productividad",
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

// Etiquetas tal y como las devuelve /api-2.0/course-categories/ de Udemy.
const UDEMY_CATEGORIES: Record<string, CourseCategory> = {
  development: "desarrollo",
  "it & software": "it-y-software",
  business: "negocios",
  "finance & accounting": "negocios",
  marketing: "negocios",
  design: "diseno-y-creatividad",
  "photography & video": "diseno-y-creatividad",
  music: "diseno-y-creatividad",
  "personal development": "desarrollo-personal",
  lifestyle: "desarrollo-personal",
  "health & fitness": "salud-y-bienestar",
  "teaching & academics": "humanidades-y-sociales",
  "office productivity": "productividad",
};

// domainId tal y como lo devuelve /api/domains.v1 de Coursera.
const COURSERA_DOMAINS: Record<string, CourseCategory> = {
  "computer-science": "desarrollo",
  "information-technology": "it-y-software",
  "data-science": "datos-e-ia",
  business: "negocios",
  "personal-development": "desarrollo-personal",
  "life-sciences": "salud-y-bienestar",
  "physical-science-and-engineering": "ciencia-y-matematicas",
  "math-and-logic": "ciencia-y-matematicas",
  "arts-and-humanities": "humanidades-y-sociales",
  "social-sciences": "humanidades-y-sociales",
  "language-learning": "idiomas",
};

// Nombre legible para la interfaz. El valor guardado en base de datos es el
// identificador estable; esto es solo cómo se enseña.
export const CATEGORY_LABELS: Record<CourseCategory, string> = {
  desarrollo: "Desarrollo",
  "it-y-software": "IT y software",
  "datos-e-ia": "Datos e IA",
  negocios: "Negocios",
  "diseno-y-creatividad": "Diseño y creatividad",
  "desarrollo-personal": "Desarrollo personal",
  "salud-y-bienestar": "Salud y bienestar",
  "ciencia-y-matematicas": "Ciencia y matemáticas",
  "humanidades-y-sociales": "Humanidades y sociales",
  idiomas: "Idiomas",
  productividad: "Productividad",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

// Identificadores de /api-2.0/course-categories/ (comprobados contra la API el
// 2026-09-13). Son **los mismos en cualquier idioma**: lo que cambia con
// `Accept-Language` es el título, no el id.
//
// Por eso la ingesta mapea por aquí (HU-049) y no por el título: la pasada en
// español de HU-033 recibía «Desarrollo» o «Informática y software», que no
// casaban con el mapeo en inglés, y dejó 316 cursos sin categoría.
const UDEMY_CATEGORY_IDS: Record<number, CourseCategory> = {
  288: "desarrollo",
  268: "negocios",
  328: "negocios", // Finance & Accounting
  290: "negocios", // Marketing
  294: "it-y-software",
  292: "productividad", // Office Productivity
  296: "desarrollo-personal",
  274: "desarrollo-personal", // Lifestyle
  269: "diseno-y-creatividad",
  273: "diseno-y-creatividad", // Photography & Video
  278: "diseno-y-creatividad", // Music
  276: "salud-y-bienestar",
  300: "humanidades-y-sociales", // Teaching & Academics
};

// Igual que con el título: un identificador desconocido devuelve null en vez de
// lanzar. Si Udemy añade una categoría, esos cursos se guardan sin categoría y
// la ingesta sigue.
export function mapUdemyCategoryId(id: number | null | undefined): CourseCategory | null {
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  return UDEMY_CATEGORY_IDS[id] ?? null;
}

// Respaldo por título, que es como se mapeaba antes de HU-049. Se conserva
// porque sigue siendo correcto para el catálogo en inglés y porque no depende
// de que la API devuelva el id por todos los caminos.
//
// Devuelve null ante una etiqueta desconocida en vez de lanzar o de inventar
// una categoría: si una plataforma añade una categoría nueva, esos cursos se
// guardan sin categoría y el resto de la ingesta sigue.
export function mapUdemyCategory(title: string | null | undefined): CourseCategory | null {
  if (!title) return null;
  return UDEMY_CATEGORIES[normalizeKey(title)] ?? null;
}

export function mapCourseraDomain(domainId: string | null | undefined): CourseCategory | null {
  if (!domainId) return null;
  return COURSERA_DOMAINS[normalizeKey(domainId)] ?? null;
}

// Un curso de Coursera puede pertenecer a varios dominios; se toma el primero
// que sepamos mapear, para no descartar el curso por culpa de un dominio nuevo
// que aparezca antes en la lista.
export function mapCourseraDomainTypes(domainTypes: unknown): CourseCategory | null {
  if (!Array.isArray(domainTypes)) return null;

  for (const raw of domainTypes) {
    const domainId = (raw as { domainId?: unknown })?.domainId;
    const mapped = typeof domainId === "string" ? mapCourseraDomain(domainId) : null;
    if (mapped) return mapped;
  }
  return null;
}
