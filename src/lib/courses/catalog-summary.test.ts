import { describe, expect, it } from "vitest";
import { summarizeCatalog } from "./catalog-summary";

describe("summarizeCatalog", () => {
  it("resume el catálogo con las cifras reales", () => {
    expect(summarizeCatalog(413, 2)).toEqual({ courseCount: 413, sourceCount: 2 });
  });

  // Sin catálogo no hay nada de lo que presumir: la portada debe omitir las
  // cifras en vez de anunciar "0 cursos".
  it("no devuelve resumen si el catálogo está vacío", () => {
    expect(summarizeCatalog(0, 0)).toBeNull();
  });

  it("no devuelve resumen si la cuenta no se pudo obtener", () => {
    expect(summarizeCatalog(null, 2)).toBeNull();
  });

  it("no devuelve resumen ante una cuenta negativa", () => {
    expect(summarizeCatalog(-1, 2)).toBeNull();
  });

  // Solo cuentan las plataformas que hoy aportan cursos: anunciar dos con una
  // vacía sería mentir al visitante.
  it("refleja una sola plataforma cuando solo una tiene cursos", () => {
    expect(summarizeCatalog(100, 1)).toEqual({ courseCount: 100, sourceCount: 1 });
  });
});
