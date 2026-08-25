import { mapConLimite } from "../ingesta/comun/concurrencia.ts";
import { conReintentos } from "../ingesta/comun/reintentos.ts";
import { necesitaResumen, type CursoConEstadoResumen, type GeneradorDeResumen } from "./resumen-curso.ts";

// Puerto mínimo que necesita el job, implementado por Postgres real o por
// dobles de test — mismo patrón que CourseStore en la ingesta.
export interface ResumenStore {
  cursosUdemyConDescripcion(): Promise<CursoConEstadoResumen[]>;
  guardarResumen(id: string, resumen: string): Promise<void>;
}

export interface ResumenJobResult {
  /** Cuántos cursos cumplían las condiciones para generar resumen. */
  candidatos: number;
  generados: number;
  fallidos: Array<{ id: string; error: string }>;
}

export interface ResumenJobOptions {
  store: ResumenStore;
  generador: GeneradorDeResumen;
  /** Cuántas llamadas a la API van a la vez. */
  concurrencia?: number;
  opcionesReintento?: Parameters<typeof conReintentos>[1];
}

// Job de resumen con IA (HU-030). Se ejecuta bajo demanda (ver
// scripts/resumir-cursos.mjs), nunca desde una ruta de la web.
//
// Mismo criterio que la ingesta: un curso que falla no tumba la ejecución
// entera — se anota en `fallidos` y el resto sigue.
export async function runResumenJob({
  store,
  generador,
  concurrencia = 3,
  opcionesReintento,
}: ResumenJobOptions): Promise<ResumenJobResult> {
  const todos = await store.cursosUdemyConDescripcion();
  const candidatos = todos.filter(necesitaResumen);

  const result: ResumenJobResult = {
    candidatos: candidatos.length,
    generados: 0,
    fallidos: [],
  };

  await mapConLimite(candidatos, concurrencia, async (curso) => {
    try {
      const resumen = await conReintentos(
        () => generador({ title: curso.title, description: curso.description }),
        opcionesReintento
      );
      await store.guardarResumen(curso.id, resumen);
      result.generados += 1;
    } catch (error) {
      result.fallidos.push({
        id: curso.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return result;
}
