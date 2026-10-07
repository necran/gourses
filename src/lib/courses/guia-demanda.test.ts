import { describe, expect, it } from "vitest";
import {
  aResumenCategoriaDemanda,
  conclusiones,
  descripcionGuiaDemanda,
  filasGuiaDemanda,
  tituloGuiaDemanda,
} from "./guia-demanda";

// Cifras medidas en producción el 2026-10-07 (HU-076), como las devuelve la vista.
const fila = (category: string, cursos: number, overrides: Partial<Record<string, number | string | null>> = {}) =>
  aResumenCategoriaDemanda({
    category,
    cursos,
    alumnos_mediana: 500,
    alumnos_media: 600,
    ...overrides,
  } as never)!;

const IT = fila("it-y-software", 180, { alumnos_mediana: 3021, alumnos_media: 6652 });
const DESARROLLO = fila("desarrollo", 364, { alumnos_mediana: 2140, alumnos_media: 12073 });
const NEGOCIOS = fila("negocios", 956, { alumnos_mediana: 671, alumnos_media: 2972 });
const SALUD = fila("salud-y-bienestar", 358, { alumnos_mediana: 195, alumnos_media: 754 });

const TODAS = [IT, DESARROLLO, NEGOCIOS, SALUD];

describe("aResumenCategoriaDemanda", () => {
  it("convierte las cifras que PostgREST devuelve como texto", () => {
    expect(IT.cursos).toBe(180);
    expect(IT.alumnosMediana).toBe(3021);
  });

  it("descarta una categoría que ya no está en la lista del código", () => {
    expect(aResumenCategoriaDemanda({ category: "alquimia", cursos: 30 } as never)).toBeNull();
  });
});

describe("filasGuiaDemanda", () => {
  const filas = filasGuiaDemanda(TODAS);

  it("ordena de más a menos alumnos por curso, no por número de cursos", () => {
    expect(filas.map((f) => f.categoria)).toEqual(["it-y-software", "desarrollo", "negocios", "salud-y-bienestar"]);
  });

  it("formatea los alumnos con separador de miles y la etiqueta de la categoría", () => {
    const it = filas.find((f) => f.categoria === "it-y-software")!;
    expect(it.alumnosMediana).toBe("3.021");
    expect(it.etiqueta).toBe("IT y software");
  });
});

describe("conclusiones", () => {
  const frases = conclusiones(TODAS);

  it("señala la categoría con más y con menos alumnos por curso", () => {
    expect(frases.join(" ")).toContain("IT y software tiene la mediana de alumnos por curso más alta: 3.021");
    expect(frases.join(" ")).toContain("más baja: 195");
  });

  it("compara cursos y alumnos cuando la categoría con más cursos no es la de más demanda", () => {
    expect(frases.join(" ")).toContain("Negocios tiene");
    expect(frases.join(" ")).toContain("956 frente a 180");
    expect(frases.join(" ")).toMatch(/el número de cursos no mide la demanda real/);
  });

  it("explica por qué se usa la mediana cuando la media se dispara", () => {
    expect(frases.join(" ")).toContain("Se usa la mediana, no la media");
    expect(frases.join(" ")).toContain("Desarrollo");
  });

  it("no opina: no dice qué materia conviene estudiar", () => {
    expect(frases.join(" ")).not.toMatch(/mejor|peor|recomend|deberías|merece la pena/i);
  });

  it("si no hay distorsión entre media y mediana, no la menciona", () => {
    const parejas = [
      fila("it-y-software", 180, { alumnos_mediana: 1000, alumnos_media: 1050 }),
      fila("negocios", 200, { alumnos_mediana: 900, alumnos_media: 950 }),
    ];
    expect(conclusiones(parejas).join(" ")).not.toContain("Se usa la mediana");
  });
});

describe("metadatos", () => {
  it("título y descripción propios, por debajo de 160 caracteres", () => {
    expect(tituloGuiaDemanda()).toMatch(/^Qué categoría tiene más demanda/);
    const descripcion = descripcionGuiaDemanda(TODAS);
    expect(descripcion).toContain("1.858 cursos");
    expect(descripcion.length).toBeLessThanOrEqual(160);
  });
});
