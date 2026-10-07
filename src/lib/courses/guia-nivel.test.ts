import { describe, expect, it } from "vitest";
import {
  aResumenNivel,
  conclusiones,
  descripcionGuiaNivel,
  filasGuiaNivel,
  tituloGuiaNivel,
} from "./guia-nivel";

// Cifras medidas en producción el 2026-10-07 (HU-075), como las devuelve la vista.
const fila = (level: string, cursos: number, overrides: Partial<Record<string, number | string | null>> = {}) =>
  aResumenNivel({
    level,
    cursos,
    con_respaldo: Math.round(cursos * 0.6),
    duracion_mediana_minutos: 300,
    valoracion_media: "4.57",
    ...overrides,
  } as never)!;

const EXPERTO = fila("Experto", 112, { con_respaldo: 70, duracion_mediana_minutos: 390, valoracion_media: "4.56" });
const TODOS = fila("Todos los niveles", 2249, {
  con_respaldo: 1400,
  duracion_mediana_minutos: 360,
  valoracion_media: "4.58",
});
const INTERMEDIO = fila("Intermedio", 479, {
  con_respaldo: 300,
  duracion_mediana_minutos: 300,
  valoracion_media: "4.58",
});
const PRINCIPIANTE = fila("Principiante", 1137, {
  con_respaldo: 650,
  duracion_mediana_minutos: 210,
  valoracion_media: "4.57",
});

const TODOS_LOS_NIVELES = [EXPERTO, TODOS, INTERMEDIO, PRINCIPIANTE];

describe("aResumenNivel", () => {
  it("convierte las cifras que PostgREST devuelve como texto", () => {
    expect(EXPERTO.cursos).toBe(112);
    expect(EXPERTO.duracionMedianaMinutos).toBe(390);
    expect(EXPERTO.valoracionMedia).toBe(4.56);
  });

  it("descarta un nivel que no está en la lista cerrada (datos de antes de HU-065)", () => {
    expect(aResumenNivel({ level: "beginner", cursos: 10 } as never)).toBeNull();
  });
});

describe("filasGuiaNivel", () => {
  const filas = filasGuiaNivel(TODOS_LOS_NIVELES);

  it("ordena del que más dura al que menos, no por número de cursos", () => {
    expect(filas.map((f) => f.nivel)).toEqual(["Experto", "Todos los niveles", "Intermedio", "Principiante"]);
  });

  it("formatea duración en horas y respaldo con su porcentaje", () => {
    const experto = filas.find((f) => f.nivel === "Experto")!;
    expect(experto.duracion).toBe("6,5 h");
    expect(experto.respaldo).toBe("70 (62,5 %)");
    expect(experto.valoracion).toBe("4,56");
  });
});

describe("conclusiones", () => {
  const frases = conclusiones(TODOS_LOS_NIVELES);

  it("compara el nivel que más dura con el que menos, con sus cifras", () => {
    expect(frases.join(" ")).toContain("Un curso de Experto dura 6,5 h de mediana");
    expect(frases.join(" ")).toContain("Principiante, 3,5 h");
  });

  it("señala que «Todos los niveles» no es la opción corta", () => {
    expect(frases.join(" ")).toContain("«Todos los niveles» no es la opción corta");
    expect(frases.join(" ")).toContain("6 h de mediana");
    expect(frases.join(" ")).toContain("3,5 h de un curso de Principiante");
  });

  it("dice que la valoración apenas cambia entre niveles, sin opinar sobre cuál elegir", () => {
    expect(frases.join(" ")).toContain("La valoración media apenas cambia");
    expect(frases.join(" ")).not.toMatch(/mejor|peor|recomend|deberías|merece la pena/i);
  });

  it("si la valoración variara de verdad, no afirma que es pareja", () => {
    const dispares = [
      fila("Experto", 112, { valoracion_media: "3.2" }),
      fila("Principiante", 1137, { valoracion_media: "4.8" }),
    ];
    expect(conclusiones(dispares).join(" ")).not.toContain("apenas cambia");
  });
});

describe("metadatos", () => {
  it("título y descripción propios, por debajo de 160 caracteres", () => {
    expect(tituloGuiaNivel()).toMatch(/^Cuánto dura/);
    const descripcion = descripcionGuiaNivel(TODOS_LOS_NIVELES);
    expect(descripcion).toContain("3.977 cursos");
    expect(descripcion.length).toBeLessThanOrEqual(160);
  });
});
