import { describe, expect, it } from "vitest";
import { hrefUltimaBusqueda } from "./ultima-busqueda";

describe("hrefUltimaBusqueda — lo guardado es entrada externa", () => {
  it("sin nada guardado lleva a /buscar", () => {
    expect(hrefUltimaBusqueda(null)).toBe("/buscar");
    expect(hrefUltimaBusqueda("")).toBe("/buscar");
  });

  it("conserva palabra clave, filtros, orden y página", () => {
    expect(hrefUltimaBusqueda("/buscar?keyword=python&orden=precio-asc&pagina=2")).toBe(
      "/buscar?keyword=python&orden=precio-asc&pagina=2"
    );
    expect(hrefUltimaBusqueda("/buscar?category=desarrollo&maxPrice=20&sinDato=1")).toBe(
      "/buscar?maxPrice=20&category=desarrollo&sinDato=1"
    );
  });

  it.each([
    "//evil.com/buscar",
    "https://evil.com/buscar?keyword=x",
    "javascript:alert(1)",
    "data:text/html,hola",
    "/\\evil.com/buscar",
    "\\\\evil.com/buscar",
    "/buscarx",
    "/buscar/../mi-cuenta",
    "/comparar?ids=x",
    "http://[",
  ])("%j no sale de /buscar ni se usa tal cual", (guardado) => {
    expect(hrefUltimaBusqueda(guardado)).toBe("/buscar");
  });

  it("descarta parámetros que no son de búsqueda y valores basura", () => {
    expect(
      hrefUltimaBusqueda("/buscar?keyword=x&evil=1&preseleccionado=abc&orden=inventado&pagina=-3")
    ).toBe("/buscar?keyword=x");
  });

  it("una palabra clave con caracteres especiales sale codificada", () => {
    const href = hrefUltimaBusqueda("/buscar?keyword=%22%3E%3Cscript%3E");
    expect(href.startsWith("/buscar?keyword=")).toBe(true);
    expect(href).not.toMatch(/[<>"]/);
  });
});
