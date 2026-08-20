// Ejecuta el job de ingesta de Udemy bajo demanda (HU-005). La recurrencia
// automática (cron) se decide en Fase 6 — ver .claude/rules/ingesta-fuentes.md.
//
// Las credenciales se leen aquí, en el entrypoint del job, y se pasan hacia
// abajo: nunca se leen dentro de la librería ni llegan al frontend
// (ver .claude/rules/seguridad.md).
import { Pool } from "pg";
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

// Medido contra la API real (HU-023): 143 ámbitos, ~59 cursos únicos por ámbito
// y ~12 s por ámbito con concurrencia 6 → unos 8.500 cursos en ~29 min.
//
// `page_size` no puede pasar de 50: con 100 la API responde 400. Y subir las
// páginas por ámbito no aporta nada, porque cada unidad se agota sobre los 71
// cursos; lo que multiplica el catálogo son las subcategorías.
const maxScopes = process.env.UDEMY_MAX_SCOPES ? Number(process.env.UDEMY_MAX_SCOPES) : Infinity;
const maxPagesPerScope = process.env.UDEMY_MAX_PAGES ? Number(process.env.UDEMY_MAX_PAGES) : 3;
const pageSize = process.env.UDEMY_PAGE_SIZE ? Number(process.env.UDEMY_PAGE_SIZE) : 50;
// Medido: con 3 la ingesta tarda lo mismo que con 6 (la API es el cuello de
// botella, no nuestro paralelismo) pero pedimos la mitad de rápido. En una
// ejecución completa a 6, Udemy devolvió 429 en el 21 % de los cursos: no es la
// concurrencia instantánea sino una cuota acumulada, y bajar el ritmo sostenido
// es lo único que ayuda. Con 2 sí se nota la pérdida de velocidad.
const concurrenciaDetalle = process.env.UDEMY_CONCURRENCIA
  ? Number(process.env.UDEMY_CONCURRENCIA)
  : 3;
// Por defecto sí: recorrer solo las 13 categorías raíz dejaba el catálogo en 425
// cursos, y con ese tamaño casi nadie encuentra lo que busca.
const includeSubcategories = process.env.UDEMY_INCLUDE_SUBCATEGORIES !== "false";

// Pool y no Client: la ingesta escribe desde varias tareas a la vez, y sobre
// una sola conexión `pg` las encola y avisa de que dejará de permitirlo.
// El tamaño acompaña a la concurrencia, con un hueco de sobra.
const client = new Pool({ connectionString: databaseUrl, max: concurrenciaDetalle + 2 });

try {
  const store = createPostgresCourseStore(client);
  const result = await runUdemyIngestJob({
    creds: { baseUrl, clientId, clientSecret },
    store,
    includeSubcategories,
    maxScopes,
    maxPagesPerScope,
    pageSize,
    concurrenciaDetalle,
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
