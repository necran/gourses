import { describe, expect, it, vi } from "vitest";
import { runResumenJob, type ResumenStore } from "./resumen-job";
import {
  CuotaDiariaAgotadaError,
  LONGITUD_MINIMA_DESCRIPCION,
  huellaDescripcion,
  type CursoConEstadoResumen,
} from "./resumen-curso";

const sinEsperas = { dormir: async () => {} };
const DESCRIPCION = "d".repeat(LONGITUD_MINIMA_DESCRIPCION);

function curso(overrides: Partial<CursoConEstadoResumen> = {}): CursoConEstadoResumen {
  return {
    id: "1",
    title: "Curso",
    description: DESCRIPCION,
    resumenIA: null,
    resumenIADescripcionSha256: null,
    ...overrides,
  };
}

function makeStore(cursos: CursoConEstadoResumen[]): ResumenStore {
  return {
    cursosConDescripcion: vi.fn().mockResolvedValue(cursos),
    guardarResumen: vi.fn().mockResolvedValue(undefined),
  };
}

describe("runResumenJob", () => {
  it("genera y guarda el resumen de los cursos que lo necesitan", async () => {
    const cursos = [curso({ id: "a" }), curso({ id: "b" })];
    const store = makeStore(cursos);
    const generador = vi.fn().mockResolvedValue("Un resumen.");

    const result = await runResumenJob({ store, generador });

    expect(result.candidatos).toBe(2);
    expect(result.generados).toBe(2);
    expect(result.fallidos).toEqual([]);
    // Con la huella de la descripción que se resumió (HU-052).
    expect(store.guardarResumen).toHaveBeenCalledWith("a", "Un resumen.", huellaDescripcion(DESCRIPCION));
    expect(store.guardarResumen).toHaveBeenCalledWith("b", "Un resumen.", huellaDescripcion(DESCRIPCION));
    expect(result.detenidoPorCuota).toBe(false);
    expect(result.pendientes).toBe(0);
  });

  // El filtrado de candidatos no lo repite el job: confía en necesitaResumen.
  // Aquí solo se comprueba que de verdad lo aplica antes de gastar una llamada.
  it("no genera resumen para un curso que no lo necesita", async () => {
    const cursos = [
      curso({ id: "corto", description: "Muy corta." }),
      curso({
        id: "ya-resumido",
        // Entero y de longitud normal: desde HU-068, un resumen de dos palabras
        // se considera cortado y el job lo rehace.
        resumenIA:
          "Este curso enseña a programar en Python desde cero, con ejercicios prácticos en cada " +
          "módulo. Cubre estructuras de datos, funciones y manejo de errores.",
        resumenIADescripcionSha256: huellaDescripcion(DESCRIPCION),
      }),
    ];
    const store = makeStore(cursos);
    const generador = vi.fn().mockResolvedValue("Un resumen.");

    const result = await runResumenJob({ store, generador });

    expect(result.candidatos).toBe(0);
    expect(generador).not.toHaveBeenCalled();
    expect(store.guardarResumen).not.toHaveBeenCalled();
  });

  // Mismo criterio que la ingesta: un curso que falla no se lleva por delante
  // a los demás. Se distinguen por título, porque es lo único que recibe el
  // generador.
  it("un curso que falla no impide que los demás se guarden", async () => {
    const cursos = [curso({ id: "malo", title: "Malo" }), curso({ id: "bueno", title: "Bueno" })];
    const store = makeStore(cursos);
    const generador = vi.fn().mockImplementation(async (c: { title: string }) => {
      if (c.title === "Malo") throw new Error("500 fallo del servidor");
      return "Resumen de Bueno.";
    });

    const result = await runResumenJob({
      store,
      generador,
      opcionesReintento: { ...sinEsperas, intentos: 1 },
    });

    expect(result.candidatos).toBe(2);
    expect(result.generados).toBe(1);
    expect(result.fallidos).toEqual([
      { id: "malo", error: expect.stringContaining("fallo del servidor") },
    ]);
    expect(store.guardarResumen).toHaveBeenCalledWith(
      "bueno",
      "Resumen de Bueno.",
      huellaDescripcion(DESCRIPCION)
    );
  });

  // HU-052. Con la cuota diaria agotada fallarían todos los que quedan: se
  // para en vez de pasar horas esperando turno para nada.
  it("se detiene al agotarse la cuota diaria, sin pedir más ni reintentar", async () => {
    const cursos = ["a", "b", "c", "d"].map((id) => curso({ id, title: id }));
    const store = makeStore(cursos);
    const pedidos: string[] = [];
    const generador = vi.fn().mockImplementation(async (c: { title: string }) => {
      pedidos.push(c.title);
      if (c.title === "b") throw new CuotaDiariaAgotadaError();
      return `Resumen de ${c.title}.`;
    });

    const result = await runResumenJob({
      store,
      generador,
      concurrencia: 1,
      opcionesReintento: sinEsperas,
    });

    expect(pedidos).toEqual(["a", "b"]);
    expect(result).toMatchObject({
      candidatos: 4,
      generados: 1,
      fallidos: [],
      detenidoPorCuota: true,
      pendientes: 3,
    });
  });

  // El orden lo decide el store (español primero); el job no debe deshacerlo.
  it("resume en el orden en que el store entrega los cursos", async () => {
    const cursos = ["es-1", "es-2", "en-1"].map((id) => curso({ id, title: id }));
    const pedidos: string[] = [];

    await runResumenJob({
      store: makeStore(cursos),
      concurrencia: 1,
      generador: async ({ title }) => {
        pedidos.push(title);
        return "R";
      },
    });

    expect(pedidos).toEqual(["es-1", "es-2", "en-1"]);
  });

  it("reintenta un fallo reintentable antes de darlo por perdido", async () => {
    const store = makeStore([curso({ id: "a" })]);
    let intentos = 0;
    const generador = vi.fn().mockImplementation(async () => {
      intentos += 1;
      if (intentos < 3) throw new Error("429 demasiadas peticiones");
      return "Resumen tras reintentar.";
    });

    const result = await runResumenJob({
      store,
      generador,
      opcionesReintento: sinEsperas,
    });

    expect(intentos).toBe(3);
    expect(result.generados).toBe(1);
    expect(result.fallidos).toEqual([]);
  });

  it("respeta el tope de concurrencia pedido", async () => {
    const cursos = Array.from({ length: 6 }, (_, i) => curso({ id: String(i), title: `C${i}` }));
    const store = makeStore(cursos);

    let enVuelo = 0;
    let maxEnVuelo = 0;
    const generador = vi.fn().mockImplementation(async () => {
      enVuelo += 1;
      maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
      await new Promise((r) => setTimeout(r, 5));
      enVuelo -= 1;
      return "R";
    });

    await runResumenJob({ store, generador, concurrencia: 2 });

    expect(maxEnVuelo).toBeLessThanOrEqual(2);
  });
});
