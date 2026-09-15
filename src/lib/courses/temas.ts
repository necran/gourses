// Temas concretos para las páginas /cursos/<tema> (HU-058).
//
// Lista cerrada y decidida por una persona con datos del catálogo (ver la
// historia), no generada a partir de palabras frecuentes: una página por tema
// solo existe si tiene cursos suficientes y datos propios que contar. Google
// persigue las páginas finas generadas en masa con enlaces de afiliado detrás
// (*scaled content abuse*, HU-030), y eso arrastraría al sitio entero.

/**
 * Un tema: cómo se nombra y qué títulos le pertenecen. Los patrones se prueban
 * contra el **título** del curso, nunca contra la descripción: buscando también
 * ahí, Excel pasaba de 50 a 183 cursos en español, casi todos de pasada.
 */
interface DefinicionTema {
  nombre: string;
  /** Alternativas (fuente de expresión regular) que tienen que aparecer como palabra completa. */
  incluir: string[];
  /** Alternativas que, si aparecen, descartan el tema aunque se cumpla `incluir`. */
  excluir?: string[];
}

// Límites de palabra Unicode. `\b` no sirve: en JavaScript considera separador
// cualquier letra que no sea ASCII, así que /\bingl[eé]s\b/ no casa con «Inglés».
const ANTES = "(?<![\\p{L}\\p{N}])";
const DESPUES = "(?![\\p{L}\\p{N}])";

const DEFINICIONES = {
  "inteligencia-artificial": {
    nombre: "Inteligencia artificial",
    // ChatGPT va dentro (decisión del usuario, 2026-09-15): separarlo haría dos
    // páginas casi iguales compitiendo por la misma búsqueda.
    incluir: ["ia", "ai", "inteligencia artificial", "generativa", "chatgpt", "openai", "claude", "gemini", "copilot", "llms?", "prompts?"],
  },
  "marketing-digital": {
    nombre: "Marketing digital",
    incluir: ["marketing digital", "seo", "google ads", "meta ads", "facebook ads", "redes sociales", "social media", "community manager", "instagram", "tiktok"],
  },
  python: { nombre: "Python", incluir: ["python"] },
  excel: { nombre: "Excel", incluir: ["excel"] },
  trading: { nombre: "Trading", incluir: ["trading", "forex"] },
  "desarrollo-de-videojuegos": {
    nombre: "Desarrollo de videojuegos",
    incluir: ["videojuegos?", "game ?dev", "game development", "unreal", "godot"],
  },
  fotografia: { nombre: "Fotografía", incluir: ["fotograf[ií]a", "photography"] },
  sap: {
    nombre: "SAP",
    incluir: ["sap"],
    // «Certificación SAP-C02» es de AWS (Solutions Architect Professional).
    excluir: ["sap-c0\\d"],
  },
  liderazgo: { nombre: "Liderazgo", incluir: ["liderazgo", "leadership"] },
  "gestion-de-proyectos": {
    nombre: "Gestión de proyectos",
    incluir: ["gesti[oó]n de proyectos", "project management", "pmp", "scrum", "agile", "[aá]gil"],
  },
  sql: { nombre: "SQL", incluir: ["sql", "mysql", "postgresql", "postgres", "t-sql", "pl/sql"] },
  criptomonedas: {
    nombre: "Criptomonedas",
    incluir: ["criptomonedas?", "cripto", "crypto", "cryptocurrenc(y|ies)", "bitcoin", "blockchain"],
  },
  yoga: { nombre: "Yoga", incluir: ["yoga"] },
  "meditacion-y-mindfulness": {
    nombre: "Meditación y mindfulness",
    incluir: ["meditaci[oó]n", "meditation", "mindfulness"],
  },
  contabilidad: { nombre: "Contabilidad", incluir: ["contabilidad", "accounting"] },
  "ciencia-de-datos": {
    nombre: "Ciencia de datos",
    incluir: ["ciencia de datos", "data science", "an[aá]lisis de datos", "data analy(tics|st|sis)"],
  },
  "edicion-de-video": {
    nombre: "Edición de vídeo",
    incluir: ["premiere", "after effects", "davinci", "edici[oó]n de v[ií]deo", "video editing"],
  },
  "produccion-musical": {
    nombre: "Producción musical",
    incluir: ["producci[oó]n musical", "music production", "ableton", "fl studio"],
  },
  photoshop: { nombre: "Photoshop", incluir: ["photoshop"] },
  psicologia: { nombre: "Psicología", incluir: ["psicolog[ií]a", "psychology"] },
  nutricion: { nombre: "Nutrición", incluir: ["nutrici[oó]n", "nutrition"] },
  ciberseguridad: {
    nombre: "Ciberseguridad",
    incluir: ["ciberseguridad", "cybersecurity", "hacking", "pentesting"],
    // «Growth hacking» es marketing, no seguridad.
    excluir: ["growth hacking"],
  },
  "power-bi": { nombre: "Power BI", incluir: ["power ?bi"] },
  "dibujo-e-ilustracion": {
    nombre: "Dibujo e ilustración",
    incluir: ["dibujo", "drawing", "ilustraci[oó]n"],
  },
  android: { nombre: "Android", incluir: ["android"] },
  "ux-ui": {
    nombre: "UX/UI",
    incluir: ["ux", "ui", "user experience", "experiencia de usuario"],
  },
  guitarra: { nombre: "Guitarra", incluir: ["guitarra", "guitar"] },
  // Agrupado (decisión del usuario, 2026-09-15): JavaScript tenía 3 cursos en
  // español y React 7; juntos con el resto del desarrollo web suman 43.
  "desarrollo-web": {
    nombre: "Desarrollo web",
    incluir: ["desarrollo web", "dise[ñn]o web", "html5?", "css3?", "javascript", "react", "angular", "node\\.?js", "php", "laravel", "django"],
  },
} satisfies Record<string, DefinicionTema>;

export type TemaId = keyof typeof DEFINICIONES;

export const TEMAS = Object.keys(DEFINICIONES) as TemaId[];

function alternativas(fuentes: string[]): RegExp {
  return new RegExp(`${ANTES}(?:${fuentes.join("|")})${DESPUES}`, "iu");
}

const PATRONES = Object.fromEntries(
  TEMAS.map((id) => {
    const def: DefinicionTema = DEFINICIONES[id];
    return [id, { incluir: alternativas(def.incluir), excluir: def.excluir ? alternativas(def.excluir) : null }];
  })
) as Record<TemaId, { incluir: RegExp; excluir: RegExp | null }>;

/** Los temas a los que pertenece un curso, según su título. En el orden de la lista. */
export function temasDelTitulo(titulo: string): TemaId[] {
  return TEMAS.filter((id) => {
    const { incluir, excluir } = PATRONES[id];
    return incluir.test(titulo) && !(excluir && excluir.test(titulo));
  });
}

/** Nombre como etiqueta: «Inteligencia artificial», «Power BI». */
export function nombreTema(id: TemaId): string {
  return DEFINICIONES[id].nombre;
}

// Los temas que son nombres comunes van en minúscula dentro de una frase
// («cursos de inteligencia artificial»); los nombres propios de productos o
// lenguajes, tal cual («cursos de Python», «de Power BI»).
const NOMBRES_COMUNES = new Set<TemaId>([
  "inteligencia-artificial",
  "marketing-digital",
  "trading",
  "desarrollo-de-videojuegos",
  "fotografia",
  "liderazgo",
  "gestion-de-proyectos",
  "criptomonedas",
  "yoga",
  "meditacion-y-mindfulness",
  "contabilidad",
  "ciencia-de-datos",
  "edicion-de-video",
  "produccion-musical",
  "psicologia",
  "nutricion",
  "ciberseguridad",
  "dibujo-e-ilustracion",
  "guitarra",
  "desarrollo-web",
]);

/** Nombre dentro de una frase: «inteligencia artificial», pero «Python». */
export function nombreEnFrase(id: TemaId): string {
  const nombre = nombreTema(id);
  return NOMBRES_COMUNES.has(id) ? nombre.charAt(0).toLocaleLowerCase("es") + nombre.slice(1) : nombre;
}

// El identificador llega por la dirección: solo vale si está en la lista, tal
// cual. Nada de normalizar mayúsculas — /cursos/Python sería otra dirección para
// la misma página.
export function esTema(valor: string | undefined): valor is TemaId {
  return typeof valor === "string" && Object.hasOwn(DEFINICIONES, valor);
}

// Umbral para que una página de tema sea indexable (HU-058). Medido en
// desarrollo: con 20 entran 28 temas; por debajo, el siguiente tema tiene 14
// cursos y se cae enseguida a 3–7. La segunda condición existe porque la
// valoración media, que es el dato propio de la página, necesita cursos
// valorados de verdad.
export const UMBRAL_CURSOS_EN_ESPANOL = 20;
export const UMBRAL_CURSOS_CON_RESENAS = 10;
export const RESENAS_MINIMAS = 50;

export interface RecuentoTema {
  enEspanol: number;
  /** Cursos en español con al menos RESENAS_MINIMAS reseñas. */
  enEspanolConResenas: number;
}

export function superaUmbral(recuento: RecuentoTema): boolean {
  return (
    recuento.enEspanol >= UMBRAL_CURSOS_EN_ESPANOL &&
    recuento.enEspanolConResenas >= UMBRAL_CURSOS_CON_RESENAS
  );
}
