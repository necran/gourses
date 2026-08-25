import type { Client, Pool } from "pg";
import type { ResumenStore } from "./resumen-job.ts";

// Implementación de ResumenStore contra Postgres directo (no PostgREST) —
// mismo criterio que postgres-course-store.ts: corre server-side, en el job,
// nunca desde el cliente (ver .claude/rules/seguridad.md).
//
// Solo Udemy y solo con descripción: es la condición fija que no depende del
// estado del resumen (HU-030 deja Coursera fuera de alcance). El resto de la
// decisión —si hace falta generar o regenerar— vive en `necesitaResumen`,
// pura y sin base de datos.
export function createPostgresResumenStore(client: Client | Pool): ResumenStore {
  return {
    async cursosUdemyConDescripcion() {
      const { rows } = await client.query(
        `select id, title, description, updated_at, resumen_ia, resumen_ia_generado_en
         from courses
         where source = 'udemy' and description is not null`
      );
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        updatedAt: r.updated_at.toISOString(),
        resumenIA: r.resumen_ia,
        resumenIAGeneradoEn: r.resumen_ia_generado_en ? r.resumen_ia_generado_en.toISOString() : null,
      }));
    },

    async guardarResumen(id, resumen) {
      await client.query(
        `update courses set resumen_ia = $2, resumen_ia_generado_en = now() where id = $1`,
        [id, resumen]
      );
    },
  };
}
