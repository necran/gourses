// Ejecuta el job de ingesta de Udemy bajo demanda (HU-005). La recurrencia
// automática (cron) se decide en Fase 6 — ver .claude/rules/ingesta-fuentes.md.
//
// Las credenciales se leen aquí, en el entrypoint del job, y se pasan hacia
// abajo: nunca se leen dentro de la librería ni llegan al frontend
// (ver .claude/rules/seguridad.md).
import { Client } from "pg";
import { runUdemyIngestJob } from "../src/lib/ingesta/udemy/job.ts";
import { createPostgresCourseStore } from "../src/lib/ingesta/postgres-course-store.ts";

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.UDEMY_AFFILIATE_API_BASE_URL;
const clientId = process.env.UDEMY_CLIENT_ID;
const clientSecret = process.env.UDEMY_CLIENT_SECRET;

for (const [nombre, valor] of [
  ["DATABASE_URL", databaseUrl],
  ["UDEMY_AFFILIATE_API_BASE_URL", baseUrl],
  ["UDEMY_CLIENT_ID", clientId],
  ["UDEMY_CLIENT_SECRET", clientSecret],
]) {
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre}.`);
    process.exit(1);
  }
}

const maxScopes = process.env.UDEMY_MAX_SCOPES ? Number(process.env.UDEMY_MAX_SCOPES) : 13;
const maxPagesPerScope = process.env.UDEMY_MAX_PAGES ? Number(process.env.UDEMY_MAX_PAGES) : 2;
const includeSubcategories = process.env.UDEMY_INCLUDE_SUBCATEGORIES === "true";

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const store = createPostgresCourseStore(client);
  const result = await runUdemyIngestJob({
    creds: { baseUrl, clientId, clientSecret },
    store,
    includeSubcategories,
    maxScopes,
    maxPagesPerScope,
  });
  console.log(
    `Ámbitos recorridos: ${result.scopes}, procesados: ${result.processed}, guardados: ${result.saved}`
  );
  if (result.failedCourses.length > 0) {
    console.warn(`Cursos fallidos (${result.failedCourses.length}):`, result.failedCourses.slice(0, 10));
  }
} finally {
  await client.end();
}
