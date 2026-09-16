import { describe, expect, it } from "vitest";
import {
  MUESTRA_MINIMA,
  aResumenCategoria,
  conclusiones,
  descripcionGuiaPrecios,
  filasGuiaPrecios,
  muestraSuficiente,
  tituloGuiaPrecios,
} from "./guia-precios";

// Cifras de la base de desarrollo del 2026-09-16, como las devuelve la vista.
const fila = (
  category: string,
  cursos: number,
  overrides: Partial<Record<string, number | string | null>> = {}
) =>
  aResumenCategoria({
    category,
    cursos,
    con_precio: cursos,
    precio_habitual_eur: "14.99",
    precio_minimo_eur: "14.99",
    precio_maximo_eur: "219.99",
    con_duracion: cursos,
    duracion_mediana_minutos: 270,
    con_respaldo: Math.round(cursos * 0.6),
    ...overrides,
  } as never)!;

const NEGOCIOS = fila("negocios", 1044, { con_precio: 956, con_respaldo: 656 });
const DESARROLLO = fila("desarrollo", 407, {
  con_precio: 364,
  precio_maximo_eur: "39.99",
  duracion_mediana_minutos: 780,
  con_respaldo: 295,
});
const SALUD = fila("salud-y-bienestar", 377, {
  con_precio: 358,
  precio_maximo_eur: "139.99",
  duracion_mediana_minutos: 195,
  con_respaldo: 148,
});
// Coursera: sin precio y muestra pequeña.
const IDIOMAS = fila("idiomas", 4, {
  con_precio: 0,
  precio_habitual_eur: null,
  precio_minimo_eur: null,
  precio_maximo_eur: null,
  duracion_mediana_minutos: 3840,
  con_respaldo: 0,
});
const DATOS = fila("datos-e-ia", 16, {
  con_precio: 0,
  precio_habitual_eur: null,
  precio_minimo_eur: null,
  precio_maximo_eur: null,
  con_respaldo: 0,
});
// Muestra suficiente pero sin precio: Coursera con más cursos.
const CIENCIA = fila("ciencia-y-matematicas", 40, {
  con_precio: 0,
  precio_habitual_eur: null,
  precio_minimo_eur: null,
  precio_maximo_eur: null,
  duracion_mediana_minutos: 930,
  con_respaldo: 0,
});

const TODAS = [NEGOCIOS, DESARROLLO, SALUD, IDIOMAS, DATOS, CIENCIA];

describe("aResumenCategoria", () => {
  it("convierte las cifras que PostgREST devuelve como texto", () => {
    expect(NEGOCIOS.cursos).toBe(1044);
    expect(NEGOCIOS.precioHabitualEur).toBe(14.99);
    expect(IDIOMAS.precioMaximoEur).toBeNull();
  });

  it("descarta una categoría que ya no está en la lista del código", () => {
    expect(aResumenCategoria({ category: "alquimia", cursos: 30 } as never)).toBeNull();
  });
});

describe("muestra mínima", () => {
  it("son 20 cursos, el mismo umbral que las páginas de tema", () => {
    expect(MUESTRA_MINIMA).toBe(20);
    expect(muestraSuficiente(IDIOMAS)).toBe(false);
    expect(muestraSuficiente(DATOS)).toBe(false);
    expect(muestraSuficiente(CIENCIA)).toBe(true);
  });
});

describe("filasGuiaPrecios", () => {
  const filas = filasGuiaPrecios(TODAS);
  const de = (categoria: string) => filas.find((f) => f.categoria === categoria)!;

  it("ordena de más a menos cursos y pone la etiqueta de cada categoría", () => {
    expect(filas.map((f) => f.categoria)).toEqual([
      "negocios",
      "desarrollo",
      "salud-y-bienestar",
      "ciencia-y-matematicas",
      "datos-e-ia",
      "idiomas",
    ]);
    expect(de("salud-y-bienestar").etiqueta).toBe("Salud y bienestar");
  });

  it("el precio lleva el habitual y el rango", () => {
    expect(de("negocios").precio.texto).toBe("14,99 € (de 14,99 € a 219,99 €)");
    expect(de("desarrollo").precio.texto).toBe("14,99 € (de 14,99 € a 39,99 €)");
  });

  it("con muestra pequeña no se dan cifras, ni de precio ni de duración", () => {
    for (const celda of [de("idiomas").precio, de("idiomas").duracion, de("idiomas").respaldo]) {
      expect(celda).toEqual({ texto: "Pocos cursos para decirlo", publicado: false });
    }
    expect(de("idiomas").suficiente).toBe(false);
    // 3.840 minutos son 64 h, salidas de cuatro cursos: no se enseñan.
    expect(JSON.stringify(de("idiomas"))).not.toContain("64");
  });

  it("una materia con muestra suficiente pero sin precio dice que no se publica, nunca cero", () => {
    expect(de("ciencia-y-matematicas").precio).toEqual({ texto: "No lo publica", publicado: false });
    expect(de("ciencia-y-matematicas").duracion.texto).toBe("15,5 h de mediana");
    const textos = filas.flatMap((f) => [f.precio.texto, f.duracion.texto]).join(" | ");
    expect(textos).not.toMatch(/0,00|gratis|(^|\s)0 €/i);
  });

  it("dice cuántos cursos llevan respaldo de reseñas y qué parte son", () => {
    expect(de("negocios").respaldo.texto).toBe("656 (62,8 %)");
  });
});

describe("conclusiones", () => {
  const frases = conclusiones(TODAS);

  it("si el precio habitual coincide en todas, lo dice y señala lo que sí cambia", () => {
    expect(frases[0]).toContain("El precio más repetido es el mismo en las 3 materias");
    expect(frases[0]).toContain("14,99 €");
  });

  it("compara los techos de precio entre materias, con sus cifras", () => {
    expect(frases.join(" ")).toContain("El curso más caro de Negocios cuesta 219,99 €");
    expect(frases.join(" ")).toContain("Desarrollo, el techo se queda en 39,99 €");
  });

  it("compara las duraciones medianas de la materia más larga y la más corta", () => {
    expect(frases.join(" ")).toMatch(/Por horas, un curso de .* dura 15,5 h de mediana/);
    expect(frases.join(" ")).toContain("Salud y bienestar, 3,3 h");
  });

  it("avisa de las materias con muestra insuficiente en vez de callarlas", () => {
    expect(frases.join(" ")).toContain("Datos e IA, Idiomas");
    expect(frases.join(" ")).toContain("menos de 20 cursos en español");
  });

  it("no opina: no dice qué materia conviene ni qué comprar", () => {
    expect(frases.join(" ")).not.toMatch(/mejor|peor|recomend|deberías|merece la pena/i);
  });
});

describe("metadatos", () => {
  it("título y descripción propios, por debajo de 160 caracteres", () => {
    expect(tituloGuiaPrecios()).toMatch(/^Cuánto cuesta/);
    const descripcion = descripcionGuiaPrecios(TODAS);
    expect(descripcion).toContain("1.888 cursos");
    expect(descripcion.length).toBeLessThanOrEqual(160);
  });
});
