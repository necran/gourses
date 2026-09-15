import { mapConLimite } from "../ingesta/comun/concurrencia.ts";
import { conReintentos } from "../ingesta/comun/reintentos.ts";
import {
  CuotaDiariaAgotadaError,
  huellaDescripcion,
  necesitaResumen,
  type CursoConEstadoResumen,
  type GeneradorDeResumen,
} from "./resumen-curso.ts";

// Puerto mínimo que necesita el job, implementado por Postgres real o por
// dobles de test — mismo patrón que CourseStore en la ingesta.
export interface ResumenStore {
  /**
   * Cursos con descripción, **ya en el orden en que conviene resumirlos**
   * (HU-052: español primero). El job no reordena: con una cuota diaria
   * limitada, lo que no dé tiempo a hacer hoy debe ser lo que menos importa.
   */
  cursosConDescripcion(): Promise<CursoConEstadoResumen[]>;
  /** Guarda el resumen junto a la huella de la descripción que resumió. */
  guardarResumen(id: string, resumen: string, huella: string): Promise<void>;
}

export interface ResumenJobResult {
  /** Cuántos cursos cumplían las condiciones para generar resumen. */
  candidatos: number;
  generados: number;
  fallidos: Array<{ id: string; error: string }>;
  /** Si se paró antes de acabar porque la API agotó la cuota del día. */
  detenidoPorCuota: boolean;
  /** Candidatos que quedan sin intentar; la siguiente ejecución los recoge. */
  pendientes: number;
}

export interface ResumenJobOptions {
  store: ResumenStore;
  generador: GeneradorDeResumen;
  /** Cuántas llamadas a la API van a la vez. */
  concurrencia?: number;
  opcionesReintento?: Parameters<typeof conReintentos>[1];
}

// Job de resumen con IA (HU-030, HU-052). Nunca se llama desde una ruta de la
// web (ver scripts/resumir-cursos.mjs).
//
// Mismo criterio que la ingesta: un curso que falla no tumba la ejecución
// entera — se anota en `fallidos` y el resto sigue. La excepción es la cuota
// diaria agotada: ahí no falla un curso, fallarían todos los que quedan, así
// que se para en vez de pasar horas esperando turno para nada.
export async function runResumenJob({
  store,
  generador,
  concurrencia = 3,
  opcionesReintento,
}: ResumenJobOptions): Promise<ResumenJobResult> {
  const todos = await store.cursosConDescripcion();
  const candidatos = todos.filter(necesitaResumen);

  const result: ResumenJobResult = {
    candidatos: candidatos.length,
    generados: 0,
    fallidos: [],
    detenidoPorCuota: false,
    pendientes: 0,
  };

  await mapConLimite(candidatos, concurrencia, async (curso) => {
    if (result.detenidoPorCuota) return;
    try {
      const resumen = await conReintentos(
        () => generador({ title: curso.title, description: curso.description }),
        opcionesReintento
      );
      await store.guardarResumen(curso.id, resumen, huellaDescripcion(curso.description));
      result.generados += 1;
    } catch (error) {
      if (error instanceof CuotaDiariaAgotadaError) {
        result.detenidoPorCuota = true;
        return;
      }
      result.fallidos.push({
        id: curso.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  result.pendientes = result.candidatos - result.generados - result.fallidos.length;
  return result;
}
