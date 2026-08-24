import { describe, expect, it } from "vitest";
import { escapeOrFilterValue, interleaveBySource, paginarIntercalado } from "./search-courses";
import type { CourseSearchResult } from "./search-courses";

function curso(source: string, n: number): CourseSearchResult {
  return {
    id: `${source}-${n}`,
    source: source as CourseSearchResult["source"],
    title: `${source} ${n}`,
    description: null,
    priceAmount: null,
    priceCurrency: null,
    rating: null,
    language: null,
    imageUrl: null,
    affiliateUrl: null,
    duration: null,
  };
}

describe("escapeOrFilterValue", () => {
  it("deja intacto un texto de búsqueda normal", () => {
    expect(escapeOrFilterValue("python para principiantes")).toBe(
      "python para principiantes"
    );
  });

  it("escapa coma y paréntesis, que PostgREST interpreta como sintaxis de filtro", () => {
    expect(escapeOrFilterValue("curso (avanzado), nivel 2")).toBe(
      "curso \\(avanzado\\)\\, nivel 2"
    );
  });
});

describe("interleaveBySource", () => {
  it("alterna una fuente y otra, conservando el orden dentro de cada una", () => {
    const udemy = [curso("udemy", 1), curso("udemy", 2), curso("udemy", 3)];
    const coursera = [curso("coursera", 1), curso("coursera", 2), curso("coursera", 3)];

    expect(interleaveBySource([udemy, coursera], 6).map((c) => c.id)).toEqual([
      "udemy-1",
      "coursera-1",
      "udemy-2",
      "coursera-2",
      "udemy-3",
      "coursera-3",
    ]);
  });

  // Es el caso que motivó el cambio: sin intercalar, los 312 cursos de Udemy
  // (todos con valoración) dejaban fuera de la página a los 100 de Coursera
  // (ninguno con valoración).
  it("garantiza presencia de la fuente pequeña aunque la otra tenga muchos más", () => {
    const udemy = Array.from({ length: 50 }, (_, i) => curso("udemy", i));
    const coursera = Array.from({ length: 5 }, (_, i) => curso("coursera", i));

    const resultado = interleaveBySource([udemy, coursera], 10);

    expect(resultado.filter((c) => c.source === "coursera")).toHaveLength(5);
    expect(resultado.filter((c) => c.source === "udemy")).toHaveLength(5);
  });

  it("completa con la fuente que queda cuando la otra se agota", () => {
    const udemy = [curso("udemy", 1), curso("udemy", 2), curso("udemy", 3)];
    const coursera = [curso("coursera", 1)];

    expect(interleaveBySource([udemy, coursera], 10).map((c) => c.id)).toEqual([
      "udemy-1",
      "coursera-1",
      "udemy-2",
      "udemy-3",
    ]);
  });

  it("respeta el límite total", () => {
    const udemy = Array.from({ length: 30 }, (_, i) => curso("udemy", i));
    const coursera = Array.from({ length: 30 }, (_, i) => curso("coursera", i));

    expect(interleaveBySource([udemy, coursera], 7)).toHaveLength(7);
  });

  it("no rompe si una fuente no devuelve nada", () => {
    const udemy = [curso("udemy", 1), curso("udemy", 2)];

    expect(interleaveBySource([udemy, []], 10).map((c) => c.id)).toEqual(["udemy-1", "udemy-2"]);
  });

  it("devuelve lista vacía si no hay resultados en ninguna fuente", () => {
    expect(interleaveBySource([[], []], 10)).toEqual([]);
  });
});

describe("paginarIntercalado (HU-025)", () => {
  // Grupos "hasta el final de la página pedida, más uno", que es lo que le
  // entrega searchCourses.
  function grupos(nUdemy: number, nCoursera: number) {
    return [
      Array.from({ length: nUdemy }, (_, i) => curso("udemy", i)),
      Array.from({ length: nCoursera }, (_, i) => curso("coursera", i)),
    ];
  }

  it("la primera página trae los primeros resultados", () => {
    const pagina = paginarIntercalado(grupos(10, 10), 1, 4);

    expect(pagina.resultados.map((c) => c.id)).toEqual([
      "udemy-0",
      "coursera-0",
      "udemy-1",
      "coursera-1",
    ]);
    expect(pagina.pagina).toBe(1);
  });

  it("la segunda página sigue donde acabó la primera", () => {
    expect(paginarIntercalado(grupos(10, 10), 2, 4).resultados.map((c) => c.id)).toEqual([
      "udemy-2",
      "coursera-2",
      "udemy-3",
      "coursera-3",
    ]);
  });

  // Lo que nunca puede pasar: que un curso salga en dos páginas, o que uno se
  // pierda entre medias.
  it("recorriendo todas las páginas se ve cada curso una sola vez", () => {
    const vistos: string[] = [];
    for (let p = 1; p <= 5; p += 1) {
      vistos.push(...paginarIntercalado(grupos(10, 10), p, 4).resultados.map((c) => c.id));
    }

    expect(new Set(vistos).size).toBe(vistos.length);
    expect(vistos).toHaveLength(20);
  });

  // El motivo de intercalar sigue vigente en la página 3, no solo en la 1: si
  // se pierde, Coursera vuelve a desaparecer de la búsqueda.
  it("mantiene las dos plataformas en páginas profundas", () => {
    const pagina = paginarIntercalado(grupos(30, 30), 5, 4);

    expect(pagina.resultados.filter((c) => c.source === "udemy")).toHaveLength(2);
    expect(pagina.resultados.filter((c) => c.source === "coursera")).toHaveLength(2);
  });

  it("dice que hay más cuando sobra al menos un resultado", () => {
    // 4 por página y 9 en total: la segunda página no es la última.
    expect(paginarIntercalado(grupos(5, 4), 2, 4).hayMas).toBe(true);
  });

  it("no dice que hay más en la última página exacta", () => {
    // 8 resultados justos en dos páginas de 4: no hay nada detrás.
    expect(paginarIntercalado(grupos(4, 4), 2, 4).hayMas).toBe(false);
  });

  it("una página más allá del final sale vacía en vez de repetir la última", () => {
    const pagina = paginarIntercalado(grupos(2, 2), 9, 4);

    expect(pagina.resultados).toEqual([]);
    expect(pagina.hayMas).toBe(false);
  });

  // Cuando una fuente se agota, la otra rellena: la página sigue completa en
  // vez de quedarse a medias.
  it("completa la página con la fuente que queda si la otra se acaba", () => {
    const pagina = paginarIntercalado(grupos(9, 2), 2, 4);

    expect(pagina.resultados).toHaveLength(4);
    expect(pagina.resultados.every((c) => c.source === "udemy")).toBe(true);
  });
});
