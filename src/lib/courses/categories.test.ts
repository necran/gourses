import { describe, expect, it } from "vitest";
import {
  COURSE_CATEGORIES,
  mapCourseraDomain,
  mapCourseraDomainTypes,
  mapUdemyCategory,
  mapUdemyCategoryId,
} from "./categories";

// Las 13 categorías reales de /api-2.0/course-categories/ (consultadas 2026-08-10).
const CATEGORIAS_UDEMY = [
  "Development",
  "Business",
  "Finance & Accounting",
  "IT & Software",
  "Office Productivity",
  "Personal Development",
  "Design",
  "Marketing",
  "Lifestyle",
  "Photography & Video",
  "Health & Fitness",
  "Music",
  "Teaching & Academics",
];

// Los mismos, con su identificador y con el título que devuelve la API cuando se
// pide en español (comprobado contra la API el 2026-09-13). El identificador no
// cambia con el idioma; el título sí, y eso es lo que rompió la ingesta en
// español (HU-049).
const CATEGORIAS_UDEMY_POR_ID: Array<[number, string, string]> = [
  [288, "Development", "Desarrollo"],
  [268, "Business", "Negocios"],
  [328, "Finance & Accounting", "Finanzas y contabilidad"],
  [294, "IT & Software", "Informática y software"],
  [292, "Office Productivity", "Productividad en la oficina"],
  [296, "Personal Development", "Desarrollo personal"],
  [269, "Design", "Diseño"],
  [290, "Marketing", "Marketing"],
  [274, "Lifestyle", "Estilo de vida"],
  [273, "Photography & Video", "Fotografía y vídeo"],
  [276, "Health & Fitness", "Salud y fitness"],
  [278, "Music", "Música"],
  [300, "Teaching & Academics", "Enseñanzas y disciplinas académicas"],
];

// Los 11 dominios reales de /api/domains.v1 (consultados 2026-08-10).
const DOMINIOS_COURSERA = [
  "arts-and-humanities",
  "business",
  "computer-science",
  "data-science",
  "information-technology",
  "life-sciences",
  "math-and-logic",
  "personal-development",
  "physical-science-and-engineering",
  "social-sciences",
  "language-learning",
];

describe("mapUdemyCategory", () => {
  it("mapea las categorías al vocabulario común", () => {
    expect(mapUdemyCategory("Development")).toBe("desarrollo");
    expect(mapUdemyCategory("IT & Software")).toBe("it-y-software");
    expect(mapUdemyCategory("Health & Fitness")).toBe("salud-y-bienestar");
  });

  it("agrupa varias categorías de Udemy bajo una común", () => {
    expect(mapUdemyCategory("Business")).toBe("negocios");
    expect(mapUdemyCategory("Finance & Accounting")).toBe("negocios");
    expect(mapUdemyCategory("Marketing")).toBe("negocios");
  });

  // Si Udemy añadiera una categoría, ningún curso debe perderse ni romper nada.
  it("devuelve null ante una categoría desconocida, sin lanzar", () => {
    expect(mapUdemyCategory("Categoría Nueva Que No Existía")).toBeNull();
  });

  it("tolera espacios y mayúsculas distintas", () => {
    expect(mapUdemyCategory("  development  ")).toBe("desarrollo");
    expect(mapUdemyCategory("IT & SOFTWARE")).toBe("it-y-software");
  });

  it("devuelve null ante valores vacíos", () => {
    expect(mapUdemyCategory(null)).toBeNull();
    expect(mapUdemyCategory(undefined)).toBeNull();
    expect(mapUdemyCategory("")).toBeNull();
  });

  // Comprobación de cobertura: ninguna categoría real debe quedar sin mapear,
  // porque un hueco aquí significa cursos sin categoría en el buscador.
  it("cubre las 13 categorías reales de Udemy", () => {
    for (const categoria of CATEGORIAS_UDEMY) {
      expect(mapUdemyCategory(categoria), `sin mapear: ${categoria}`).not.toBeNull();
    }
  });
});

// HU-049. El fallo que motiva esto: la pasada en español recibía los títulos
// traducidos, no casaban con el mapeo en inglés y 316 cursos se quedaron sin
// categoría. El identificador no cambia con el idioma.
describe("mapUdemyCategoryId", () => {
  it("cubre los 13 identificadores reales de Udemy", () => {
    for (const [id, titulo] of CATEGORIAS_UDEMY_POR_ID) {
      expect(mapUdemyCategoryId(id), `sin mapear: ${id} (${titulo})`).not.toBeNull();
    }
  });

  it("da la misma categoría que el título en inglés, que es la que ya era correcta", () => {
    for (const [id, tituloEn] of CATEGORIAS_UDEMY_POR_ID) {
      expect(mapUdemyCategoryId(id), `id ${id}`).toBe(mapUdemyCategory(tituloEn));
    }
  });

  // La razón de ser de esta función: estos títulos no mapean, y su id sí.
  it("resuelve las categorías cuyo título en español no mapea", () => {
    const sinMapeoPorTitulo = CATEGORIAS_UDEMY_POR_ID.filter(
      ([, , tituloEs]) => mapUdemyCategory(tituloEs) === null
    );

    expect(sinMapeoPorTitulo.length).toBeGreaterThan(0);
    for (const [id, , tituloEs] of sinMapeoPorTitulo) {
      expect(mapUdemyCategoryId(id), `«${tituloEs}» debería resolverse por id`).not.toBeNull();
    }
  });

  it("un identificador desconocido devuelve null, sin lanzar", () => {
    expect(mapUdemyCategoryId(999_999)).toBeNull();
  });

  it("devuelve null ante valores que no son un identificador", () => {
    expect(mapUdemyCategoryId(null)).toBeNull();
    expect(mapUdemyCategoryId(undefined)).toBeNull();
    expect(mapUdemyCategoryId(Number.NaN)).toBeNull();
    expect(mapUdemyCategoryId(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("todo identificador apunta a una categoría del vocabulario común", () => {
    for (const [id] of CATEGORIAS_UDEMY_POR_ID) {
      expect(COURSE_CATEGORIES).toContain(mapUdemyCategoryId(id));
    }
  });
});

describe("mapCourseraDomain", () => {
  it("mapea los dominios al vocabulario común", () => {
    expect(mapCourseraDomain("computer-science")).toBe("desarrollo");
    expect(mapCourseraDomain("data-science")).toBe("datos-e-ia");
    expect(mapCourseraDomain("language-learning")).toBe("idiomas");
  });

  it("agrupa varios dominios bajo una misma categoría común", () => {
    expect(mapCourseraDomain("math-and-logic")).toBe("ciencia-y-matematicas");
    expect(mapCourseraDomain("physical-science-and-engineering")).toBe("ciencia-y-matematicas");
  });

  it("devuelve null ante un dominio desconocido", () => {
    expect(mapCourseraDomain("quantum-astrology")).toBeNull();
  });

  it("cubre los 11 dominios reales de Coursera", () => {
    for (const dominio of DOMINIOS_COURSERA) {
      expect(mapCourseraDomain(dominio), `sin mapear: ${dominio}`).not.toBeNull();
    }
  });
});

describe("mapCourseraDomainTypes", () => {
  it("toma el dominio del curso tal y como llega de la API", () => {
    const domainTypes = [
      { subdomainId: "cloud-computing", domainId: "information-technology" },
      { subdomainId: "machine-learning", domainId: "data-science" },
    ];
    expect(mapCourseraDomainTypes(domainTypes)).toBe("it-y-software");
  });

  // Que Coursera añada un dominio nuevo no debe dejar sin categoría a un curso
  // que además pertenece a otro que sí conocemos.
  it("salta un dominio desconocido y usa el siguiente que sí conoce", () => {
    const domainTypes = [{ domainId: "dominio-nuevo" }, { domainId: "business" }];
    expect(mapCourseraDomainTypes(domainTypes)).toBe("negocios");
  });

  it("devuelve null si ningún dominio es conocido", () => {
    expect(mapCourseraDomainTypes([{ domainId: "dominio-nuevo" }])).toBeNull();
  });

  it("devuelve null ante una lista vacía o un valor que no es lista", () => {
    expect(mapCourseraDomainTypes([])).toBeNull();
    expect(mapCourseraDomainTypes(null)).toBeNull();
    expect(mapCourseraDomainTypes("information-technology")).toBeNull();
  });

  it("no rompe con elementos malformados dentro de la lista", () => {
    expect(mapCourseraDomainTypes([null, { sinDomainId: 1 }, { domainId: "business" }])).toBe(
      "negocios"
    );
  });
});

describe("vocabulario común", () => {
  it("todo mapeo apunta a una categoría del vocabulario", () => {
    const validas = new Set<string>(COURSE_CATEGORIES);
    for (const categoria of CATEGORIAS_UDEMY) {
      const mapped = mapUdemyCategory(categoria);
      if (mapped) expect(validas.has(mapped)).toBe(true);
    }
    for (const dominio of DOMINIOS_COURSERA) {
      const mapped = mapCourseraDomain(dominio);
      if (mapped) expect(validas.has(mapped)).toBe(true);
    }
  });
});
