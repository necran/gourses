import type { Client, Pool } from "pg";
import type { ResumenStore } from "./resumen-job.ts";

// Implementación de ResumenStore contra Postgres directo (no PostgREST) —
// mismo criterio que postgres-course-store.ts: corre server-side, en el job,
// nunca desde el cliente (ver .claude/rules/seguridad.md).
//
// Udemy y Coursera, solo con descripción (HU-052; HU-030 dejaba Coursera
// fuera). El resto de la decisión —si hace falta generar o regenerar— vive en
// `necesitaResumen`, pura y sin base de datos.
//
// El orden es parte del contrato: español primero (es el contenido que puede
// posicionar), luego los cursos con más alumnos, y `id` para que dos
// ejecuciones recorran lo mismo en el mismo orden.
export function createPostgresResumenStore(client: Client | Pool): ResumenStore {
  return {
    async cursosConDescripcion() {
      const { rows } = await client.query(
        // Primero lo roto, luego lo que falta (HU-068). Un resumen cortado a
        // media palabra ya está publicado en su ficha y cuesta una llamada
        // arreglarlo; con el español por delante, los 16 de la base quedaban
        // detrás de 3.636 cursos y no se habrían rehecho en semanas.
        //
        // La condición repite `resumenDefectuoso` en SQL —menos de 120
        // caracteres o sin cerrar la frase—, porque el orden lo pone Postgres.
        // Un test de integración comprueba que las dos versiones coinciden.
        `select id, title, description, resumen_ia, resumen_ia_descripcion_sha256
         from courses
         where source in ('udemy', 'coursera') and description is not null
         order by (resumen_ia is not null
                   and (length(btrim(resumen_ia)) < 120 or btrim(resumen_ia) !~ '[.!?…]$')) desc,
                  coalesce(language ilike 'es%', false) desc,
                  num_subscribers desc nulls last,
                  id`
      );
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        resumenIA: r.resumen_ia,
        resumenIADescripcionSha256: r.resumen_ia_descripcion_sha256,
      }));
    },

    async guardarResumen(id, resumen, huella) {
      await client.query(
        `update courses
            set resumen_ia = $2, resumen_ia_generado_en = now(), resumen_ia_descripcion_sha256 = $3
          where id = $1`,
        [id, resumen, huella]
      );
    },
  };
}
