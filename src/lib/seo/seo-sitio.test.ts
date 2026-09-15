import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  IMAGEN_COMPARTIR,
  OPEN_GRAPH_SITIO,
  busquedaIndexable,
  datosEstructuradosSitio,
  migasDePan,
  urlAbsoluta,
} from "./seo-sitio";
import { parseCourseSearchFilters } from "../courses/search-filters";
import { serializeStructuredData } from "../courses/course-seo";

describe("busquedaIndexable", () => {
  it("/buscar a secas sí se indexa", () => {
    expect(busquedaIndexable(parseCourseSearchFilters({}))).toBe(true);
  });

  it.each([
    ["palabra clave", { keyword: "python" }],
    ["categoría", { category: "desarrollo" }],
    ["precio máximo", { maxPrice: "20" }],
    ["valoración mínima", { minRating: "4" }],
    ["duración máxima", { maxDuration: "10" }],
    ["idioma", { language: "es" }],
    ["orden", { orden: "precio-asc" }],
    ["incluir sin dato", { maxPrice: "20", sinDato: "1" }],
    ["página 2", { pagina: "2" }],
  ])("con %s no se indexa: sería un duplicado", (_, params) => {
    expect(busquedaIndexable(parseCourseSearchFilters(params))).toBe(false);
  });

  it("un parámetro que no es un filtro no la saca del índice", () => {
    expect(busquedaIndexable(parseCourseSearchFilters({ utm_source: "newsletter" }))).toBe(true);
  });

  it("un filtro inválido no cuenta, porque no se aplica", () => {
    expect(busquedaIndexable(parseCourseSearchFilters({ maxPrice: "gratis" }))).toBe(true);
  });
});

describe("imagen para compartir", () => {
  it("es de 1200 × 630 y tiene texto alternativo", () => {
    expect(IMAGEN_COMPARTIR).toMatchObject({ width: 1200, height: 630 });
    expect(IMAGEN_COMPARTIR.alt.length).toBeGreaterThan(20);
  });

  // Si alguien la renombra o la borra, los metadatos apuntarían a un 404.
  it("el fichero existe donde dicen los metadatos", () => {
    const fichero = path.join(process.cwd(), "public", IMAGEN_COMPARTIR.url);
    expect(existsSync(fichero)).toBe(true);
  });

  it("lo común del openGraph lleva la imagen y el nombre del sitio", () => {
    expect(OPEN_GRAPH_SITIO.images).toContain(IMAGEN_COMPARTIR);
    expect(OPEN_GRAPH_SITIO.siteName).toBe("Gourses");
  });
});

describe("urlAbsoluta", () => {
  it("resuelve contra el dominio canónico", () => {
    expect(urlAbsoluta("/categoria/desarrollo")).toBe("https://gourses.com/categoria/desarrollo");
    expect(urlAbsoluta("/")).toBe("https://gourses.com/");
  });
});

describe("datosEstructuradosSitio", () => {
  interface Nodo {
    "@type": string;
    "@id"?: string;
    url?: string;
    publisher?: { "@id": string };
    potentialAction?: {
      "@type": string;
      target: { urlTemplate: string };
      "query-input": string;
    };
  }
  const datos = datosEstructuradosSitio() as { "@graph": Nodo[] };
  const sitio = datos["@graph"].find((n) => n["@type"] === "WebSite")!;
  const organizacion = datos["@graph"].find((n) => n["@type"] === "Organization")!;

  it("declara el sitio y quién lo publica, enlazados por @id", () => {
    expect(sitio.url).toBe("https://gourses.com/");
    expect(sitio.publisher?.["@id"]).toBe(organizacion["@id"]);
  });

  it("declara el buscador con la plantilla de búsqueda real de /buscar", () => {
    const accion = sitio.potentialAction!;
    expect(accion["@type"]).toBe("SearchAction");
    expect(accion.target.urlTemplate).toBe(
      "https://gourses.com/buscar?keyword={search_term_string}"
    );
    expect(accion["query-input"]).toBe("required name=search_term_string");
  });
});

describe("migasDePan", () => {
  it("numera desde 1 y usa direcciones absolutas", () => {
    const datos = migasDePan([
      { nombre: "Inicio", ruta: "/" },
      { nombre: "Cursos de Desarrollo", ruta: "/categoria/desarrollo" },
    ]) as { "@type": string; itemListElement: Array<Record<string, unknown>> };

    expect(datos["@type"]).toBe("BreadcrumbList");
    expect(datos.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Inicio", item: "https://gourses.com/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Cursos de Desarrollo",
        item: "https://gourses.com/categoria/desarrollo",
      },
    ]);
  });

  // El nombre de la última miga es el título de un curso, que viene de una API
  // de terceros: al incrustarlo tiene que seguir escapándose.
  it("un título con </script> no puede cerrar la etiqueta al serializarse", () => {
    const texto = serializeStructuredData(
      migasDePan([{ nombre: "</script><script>alert(1)</script>", ruta: "/curso/x" }])
    );
    expect(texto).not.toContain("</script>");
    expect(JSON.parse(texto).itemListElement[0].name).toBe("</script><script>alert(1)</script>");
  });
});
