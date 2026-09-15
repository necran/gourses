import { describe, expect, it } from "vitest";
import {
  asuntoBoletin,
  componerBoletin,
  esTokenBaja,
  hayContenido,
  inicioSemana,
  mayoresBajadas,
  precio,
  type Bajada,
  type ContenidoBoletin,
} from "./contenido";

const TOKEN = "3f2c8a1e-9b7d-4c6e-8a5f-1d2e3f4a5b6c";

const nuevo = (id: string, title = `Curso ${id}`) => ({
  id,
  source: "udemy",
  title,
  priceAmount: 14.99,
  priceCurrency: "EUR",
});

const bajada = (id: string, precioAnterior: number, precioActual: number): Bajada => ({
  id,
  source: "udemy",
  title: `Curso ${id}`,
  precioAnterior,
  precioActual,
  divisa: "EUR",
});

const VACIO: ContenidoBoletin = { novedades: [], totalNovedades: 0, bajadas: [] };

describe("inicioSemana", () => {
  it("es el lunes de la semana", () => {
    expect(inicioSemana(new Date("2026-09-16T10:00:00Z"))).toBe("2026-09-14"); // miércoles
    expect(inicioSemana(new Date("2026-09-14T00:00:00Z"))).toBe("2026-09-14"); // lunes
    expect(inicioSemana(new Date("2026-09-20T23:59:00Z"))).toBe("2026-09-14"); // domingo
  });
});

describe("esTokenBaja", () => {
  it("solo acepta un UUID", () => {
    expect(esTokenBaja(TOKEN)).toBe(true);
    expect(esTokenBaja("abc")).toBe(false);
    expect(esTokenBaja(`${TOKEN}' or 1=1`)).toBe(false);
    expect(esTokenBaja(undefined)).toBe(false);
  });
});

describe("mayoresBajadas", () => {
  it("ordena por porcentaje y se queda con cinco", () => {
    const lista = [
      bajada("a", 20, 18),
      bajada("b", 100, 10),
      bajada("c", 50, 25),
      bajada("d", 30, 15),
      bajada("e", 40, 30),
      bajada("f", 219.99, 14.99),
    ];
    expect(mayoresBajadas(lista).map((b) => b.id)).toEqual(["f", "b", "c", "d", "e"]);
  });
});

describe("precio", () => {
  it("con coma decimal y divisa", () => {
    expect(precio(14.99, "EUR")).toBe("14,99 EUR");
    expect(precio(10, null)).toBe("10,00");
  });
});

describe("componerBoletin", () => {
  it("sin cursos nuevos ni bajadas no hay boletín", () => {
    expect(hayContenido(VACIO)).toBe(false);
    expect(componerBoletin(VACIO, TOKEN)).toBeNull();
  });

  it("el asunto cuenta lo que trae", () => {
    expect(asuntoBoletin({ novedades: [nuevo("1")], totalNovedades: 12, bajadas: [bajada("x", 50, 10)] })).toBe(
      "Esta semana: 12 cursos nuevos en español y 1 bajada de precio"
    );
    expect(asuntoBoletin({ novedades: [nuevo("1")], totalNovedades: 1, bajadas: [] })).toBe(
      "Esta semana: 1 curso nuevo en español"
    );
    expect(asuntoBoletin({ ...VACIO, bajadas: [bajada("x", 50, 10), bajada("y", 50, 20)] })).toBe(
      "Esta semana: 2 bajadas de precio"
    );
  });

  it("lista los cursos nuevos y las bajadas, con enlace a su ficha", () => {
    const m = componerBoletin(
      { novedades: [nuevo("n1", "Python desde cero")], totalNovedades: 1, bajadas: [bajada("b1", 219.99, 14.99)] },
      TOKEN
    )!;
    expect(m.texto).toContain("- Python desde cero (Udemy) · 14,99 EUR");
    expect(m.texto).toContain("https://gourses.com/curso/n1");
    expect(m.texto).toContain("antes 219,99 EUR, ahora 14,99 EUR (-93 %)");
    expect(m.html).toContain('<a href="https://gourses.com/curso/b1">Curso b1</a>');
    expect(m.texto).not.toContain("Ver todos");
  });

  it("si hay más cursos nuevos de los que caben, enlaza a todos", () => {
    const m = componerBoletin({ novedades: [nuevo("1")], totalNovedades: 30, bajadas: [] }, TOKEN)!;
    expect(m.texto).toContain("Ver todos: https://gourses.com/novedades");
  });

  it("cada correo lleva su enlace de baja, la cuenta y la cabecera List-Unsubscribe", () => {
    const m = componerBoletin({ novedades: [nuevo("1")], totalNovedades: 1, bajadas: [] }, TOKEN)!;
    const baja = `https://gourses.com/boletin/baja?t=${TOKEN}`;
    expect(m.texto).toContain(`Darte de baja: ${baja}`);
    expect(m.texto).toContain("https://gourses.com/mi-cuenta");
    expect(m.html).toContain(`href="${baja}"`);
    expect(m.cabeceras).toEqual({ "List-Unsubscribe": `<${baja}>` });
    expect(m.texto).toMatch(/te apuntaste al boletín/);
  });

  it("escapa en el HTML los títulos, que vienen de las plataformas", () => {
    const m = componerBoletin(
      { novedades: [nuevo("1", '<img src=x onerror="alert(1)">')], totalNovedades: 1, bajadas: [] },
      TOKEN
    )!;
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
