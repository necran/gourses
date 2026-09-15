// Ejecuta el job de resumen con IA (HU-030). En producción lo lanza cada día
// la tarea programada `.github/workflows/resumenes.yml` (HU-053); en local se
// lanza a mano con `npm run resumir:cursos`, contra la base de desarrollo.
//
// La clave se lee aquí, en el entrypoint del job, y se pasa hacia abajo:
// nunca dentro de la librería ni llega al frontend (ver .claude/rules/seguridad.md).
import { Pool } from "pg";
import { runResumenJob } from "../src/lib/ia/resumen-job.ts";
import { createPostgresResumenStore } from "../src/lib/ia/postgres-resumen-store.ts";
import { creaGeneradorDeResumenGemini } from "../src/lib/ia/gemini-resumen.ts";

const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.GEMINI_API_KEY;

for (const [nombre, valor] of [
  ["DATABASE_URL", databaseUrl],
  ["GEMINI_API_KEY", apiKey],
]) {
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre}.`);
    process.exit(1);
  }
}

// 1 a propósito: el nivel gratuito de Gemini limita las peticiones por
// minuto, y el propio adaptador ya se autorregula al ritmo — subir la
// concurrencia aquí no acelera nada, solo hace que varias tareas esperen en
// fila la misma puerta.
const concurrencia = process.env.RESUMEN_CONCURRENCIA ? Number(process.env.RESUMEN_CONCURRENCIA) : 1;

const client = new Pool({ connectionString: databaseUrl, max: concurrencia + 2 });

try {
  const store = createPostgresResumenStore(client);
  const generador = creaGeneradorDeResumenGemini(apiKey);

  const result = await runResumenJob({ store, generador, concurrencia });

  console.log(
    `Candidatos: ${result.candidatos}, resúmenes generados: ${result.generados}, pendientes: ${result.pendientes}`
  );
  if (result.detenidoPorCuota) {
    // Con el nivel gratuito es lo normal, no una avería: la siguiente
    // ejecución sigue por los pendientes, en el mismo orden (HU-052).
    console.log("Detenido: la cuota diaria de la API de IA está agotada.");
  }
  if (result.fallidos.length > 0) {
    console.warn(`Cursos fallidos (${result.fallidos.length}):`, result.fallidos.slice(0, 10));
  }
} finally {
  await client.end();
}
