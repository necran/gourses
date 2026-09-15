import { describe, expect, it } from "vitest";
import {
  interleaveBySource,
  paginarIntercalado,
  patronPalabraClave,
  priorizarIdioma,
  valorFiltroOr,
} from "./search-courses";
import type { CourseSearchResult } from "./search-courses";

function curso(source: string, n: number, language: string | null = null): CourseSearchResult {
  return {
    id: `${source}-${n}`,
    source: source as CourseSearchResult["source"],
    title: `${source} ${n}`,
    description: null,
    priceAmount: null,
    priceCurrency: null,
    rating: null,
    language,
    imageUrl: null,
    affiliateUrl: null,
    duration: null,
  };
}

describe("priorizarIdioma (HU-032)", () => {
  it("sin idioma preferido, no cambia nada", () => {
    const cursos = [curso("udemy", 1, "en"), curso("udemy", 2, "es")];
    expect(priorizarIdioma(cursos, null)).toEqual(cursos);
  });

  it("pasa los del idioma preferido delante, sin descartar los demás", () => {
    const en1 = curso("udemy", 1, "en");
    const es1 = curso("udemy", 2, "es");
    const en2 = curso("udemy", 3, "en");
    const es2 = curso("udemy", 4, "es");

    const resultado = priorizarIdioma([en1, es1, en2, es2], "es");

    expect(resultado.map((c) => c.id)).toEqual(["udemy-2", "udemy-4", "udemy-1", "udemy-3"]);
  });

  it("dentro de cada grupo conserva el orden de llegada (mejor valorado primero)", () => {
    const es1 = curso("udemy", 1, "es");
    const es2 = curso("udemy", 2, "es");
    const en1 = curso("udemy", 3, "en");

    const resultado = priorizarIdioma([es1, en1, es2], "es");
    expect(resultado.map((c) => c.id)).toEqual(["udemy-1", "udemy-2", "udemy-3"]);
  });

  it("un curso sin idioma cae en «los demás», nunca en los preferidos", () => {
    const sinIdioma = curso("udemy", 1, null);
    const es = curso("udemy", 2, "es");

    expect(priorizarIdioma([sinIdioma, es], "es").map((c) => c.id)).toEqual([
      "udemy-2",
      "udemy-1",
    ]);
  });

  it("no distingue mayúsculas del idioma guardado", () => {
    const cursos = [curso("udemy", 1, "ES")];
    expect(priorizarIdioma(cursos, "es").map((c) => c.id)).toEqual(["udemy-1"]);
  });

  it("si nada coincide, el orden no cambia", () => {
    const cursos = [curso("udemy", 1, "en"), curso("udemy", 2, "fr")];
    expect(priorizarIdioma(cursos, "es")).toEqual(cursos);
  });

  it("una lista vacía no rompe", () => {
    expect(priorizarIdioma([], "es")).toEqual([]);
  });
});

// Las cadenas esperadas se comprobaron contra el PostgREST real (2026-09-15):
// dan los mismos cursos que la consulta SQL equivalente.
describe("valorFiltroOr", () => {
  it("va entre comillas dobles, así que coma y paréntesis quedan como texto", () => {
    expect(valorFiltroOr("%curso (avanzado), nivel 2%")).toBe('"%curso (avanzado), nivel 2%"');
  });

  it("duplica la barra invertida: dentro de las comillas PostgREST quita una", () => {
    // El patrón de LIKE `%100\%%` (un % literal) viaja como `"%100\\%%"`.
    expect(valorFiltroOr("%100\\%%")).toBe('"%100\\\\%%"');
  });

  it("escapa la comilla doble para no cerrar el valor antes de tiempo", () => {
    expect(valorFiltroOr('%el "mejor" curso%')).toBe('"%el \\"mejor\\" curso%"');
  });

  it("un intento de meter otra condición en el filtro queda como texto dentro de las comillas", () => {
    const valor = valorFiltroOr('%x",id.neq.0,title.ilike."%');
    expect(valor.startsWith('"')).toBe(true);
    expect(valor.endsWith('"')).toBe(true);
    // Todas las comillas interiores van escapadas: ninguna cierra el valor.
    expect(valor.slice(1, -1)).not.toMatch(/(?<!\\)"/);
  });
});

describe("patronPalabraClave (HU-057)", () => {
  it("una palabra normal se busca contenida, en título y descripción", () => {
    expect(patronPalabraClave("python")).toEqual({ patron: "%python%", soloTitulo: false });
  });

  it("% y _ se buscan como caracteres, no como comodines", () => {
    expect(patronPalabraClave("100%").patron).toBe("%100\\%%");
    expect(patronPalabraClave("snake_case").patron).toBe("%snake\\_case%");
    expect(patronPalabraClave("%%%").patron).toBe("%\\%\\%\\%%");
  });

  it("la barra invertida también se escapa, para no escaparse a sí misma lo siguiente", () => {
    expect(patronPalabraClave("C:\\ruta").patron).toBe("%C:\\\\ruta%");
  });

  // El patrón es el de Postgres: coma y paréntesis no son especiales en LIKE.
  // Protegerlos del filtro .or() es cosa de valorFiltroOr.
  it("coma y paréntesis quedan tal cual en el patrón de LIKE", () => {
    expect(patronPalabraClave("curso (avanzado), 50%").patron).toBe("%curso (avanzado), 50\\%%");
  });

  it("con menos de tres letras o números busca solo en el título", () => {
    expect(patronPalabraClave("go").soloTitulo).toBe(true);
    expect(patronPalabraClave("R").soloTitulo).toBe(true);
    expect(patronPalabraClave("sql").soloTitulo).toBe(false);
  });

  // Los trigramas solo se forman con letras y números: `%%%` son tres
  // caracteres pero ninguno sirve al índice, y tardaba 1,4 s (HU-057).
  it("los signos no cuentan como letras", () => {
    expect(patronPalabraClave("%%%").soloTitulo).toBe(true);
    expect(patronPalabraClave("C++").soloTitulo).toBe(true);
    expect(patronPalabraClave("c#").soloTitulo).toBe(true);
    expect(patronPalabraClave("100%").soloTitulo).toBe(false);
  });

  // Letras con tilde o de otros alfabetos cuentan; un emoji no es una letra.
  it("cuenta letras de cualquier alfabeto, no bytes", () => {
    expect(patronPalabraClave("ñú").soloTitulo).toBe(true);
    expect(patronPalabraClave("año").soloTitulo).toBe(false);
    expect(patronPalabraClave("日本語").soloTitulo).toBe(false);
    expect(patronPalabraClave("🐍ab").soloTitulo).toBe(true);
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
    const pagina = paginarIntercalado(grupos(10, 10), 1, 4, 20);

    expect(pagina.resultados.map((c) => c.id)).toEqual([
      "udemy-0",
      "coursera-0",
      "udemy-1",
      "coursera-1",
    ]);
    expect(pagina.pagina).toBe(1);
  });

  it("la segunda página sigue donde acabó la primera", () => {
    expect(paginarIntercalado(grupos(10, 10), 2, 4, 20).resultados.map((c) => c.id)).toEqual([
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
      vistos.push(...paginarIntercalado(grupos(10, 10), p, 4, 20).resultados.map((c) => c.id));
    }

    expect(new Set(vistos).size).toBe(vistos.length);
    expect(vistos).toHaveLength(20);
  });

  // El motivo de intercalar sigue vigente en la página 3, no solo en la 1: si
  // se pierde, Coursera vuelve a desaparecer de la búsqueda.
  it("mantiene las dos plataformas en páginas profundas", () => {
    const pagina = paginarIntercalado(grupos(30, 30), 5, 4, 20);

    expect(pagina.resultados.filter((c) => c.source === "udemy")).toHaveLength(2);
    expect(pagina.resultados.filter((c) => c.source === "coursera")).toHaveLength(2);
  });

  it("dice que hay más cuando sobra al menos un resultado", () => {
    // 4 por página y 9 en total: la segunda página no es la última.
    expect(paginarIntercalado(grupos(5, 4), 2, 4, 20).hayMas).toBe(true);
  });

  it("no dice que hay más en la última página exacta", () => {
    // 8 resultados justos en dos páginas de 4: no hay nada detrás.
    expect(paginarIntercalado(grupos(4, 4), 2, 4, 20).hayMas).toBe(false);
  });

  it("una página más allá del final sale vacía en vez de repetir la última", () => {
    const pagina = paginarIntercalado(grupos(2, 2), 9, 4, 20);

    expect(pagina.resultados).toEqual([]);
    expect(pagina.hayMas).toBe(false);
  });

  // Cuando una fuente se agota, la otra rellena: la página sigue completa en
  // vez de quedarse a medias.
  it("completa la página con la fuente que queda si la otra se acaba", () => {
    const pagina = paginarIntercalado(grupos(9, 2), 2, 4, 20);

    expect(pagina.resultados).toHaveLength(4);
    expect(pagina.resultados.every((c) => c.source === "udemy")).toBe(true);
  });

  // El total no lo calcula paginarIntercalado: lo recibe hecho, porque cada
  // fuente lo cuenta en su propia consulta (HU-028).
  it("el total es el que se le pasa, no el tamaño de la página", () => {
    expect(paginarIntercalado(grupos(9, 2), 1, 4, 11).total).toBe(11);
  });
});
