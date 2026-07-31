// Ejecuta el job de ingesta de Coursera bajo demanda (HU-006). La
// recurrencia automática (cron) se decide en Fase 6 — ver .claude/rules/ingesta-fuentes.md.
import { Client } from "pg";
import { runCourseraIngestJob } from "../src/lib/ingesta/coursera/job.ts";
import { createPostgresCourseStore } from "../src/lib/ingesta/postgres-course-store.ts";

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.COURSERA_CATALOG_API_BASE_URL;

if (!databaseUrl) {
  console.error("Falta la variable de entorno DATABASE_URL.");
  process.exit(1);
}
if (!baseUrl) {
  console.error("Falta la variable de entorno COURSERA_CATALOG_API_BASE_URL.");
  process.exit(1);
}

const maxPages = process.env.COURSERA_MAX_PAGES ? Number(process.env.COURSERA_MAX_PAGES) : 1;

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const store = createPostgresCourseStore(client);
  const result = await runCourseraIngestJob({ baseUrl, store, maxPages });
  console.log(`Procesados: ${result.processed}, guardados: ${result.saved}`);
  if (result.failedCourses.length > 0) {
    console.warn(`Cursos fallidos (${result.failedCourses.length}):`, result.failedCourses);
  }
} finally {
  await client.end();
}
