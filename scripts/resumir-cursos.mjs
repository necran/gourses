// Ejecuta el job de resumen con IA bajo demanda (HU-030). Nunca automático:
// a diferencia de la ingesta, no hay cron para esto — se lanza a mano cuando
// se quiere, para ver el resultado y el coste antes de repetirlo.
//
// La clave se lee aquí, en el entrypoint del job, y se pasa hacia abajo:
// nunca dentro de la librería ni llega al frontend (ver .claude/rules/seguridad.md).
import { Pool } from "pg";
import { runResumenJob } from "../src/lib/ia/resumen-job.ts";
import { createPostgresResumenStore } from "../src/lib/ia/postgres-resumen-store.ts";
import { creaGeneradorDeResumenAnthropic } from "../src/lib/ia/anthropic-resumen.ts";

const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.ANTHROPIC_API_KEY;

for (const [nombre, valor] of [
  ["DATABASE_URL", databaseUrl],
  ["ANTHROPIC_API_KEY", apiKey],
]) {
  if (!valor) {
    console.error(`Falta la variable de entorno ${nombre}.`);
    process.exit(1);
  }
}

// Bajo, a propósito: es una API de pago y el job se lanza a mano, no hay
// prisa por acabar rápido. Subir esto es aceptar más 429, no menos tiempo.
const concurrencia = process.env.RESUMEN_CONCURRENCIA ? Number(process.env.RESUMEN_CONCURRENCIA) : 3;

const client = new Pool({ connectionString: databaseUrl, max: concurrencia + 2 });

try {
  const store = createPostgresResumenStore(client);
  const generador = creaGeneradorDeResumenAnthropic(apiKey);

  const result = await runResumenJob({ store, generador, concurrencia });

  console.log(
    `Candidatos: ${result.candidatos}, resúmenes generados: ${result.generados}`
  );
  if (result.fallidos.length > 0) {
    console.warn(`Cursos fallidos (${result.fallidos.length}):`, result.fallidos.slice(0, 10));
  }
} finally {
  await client.end();
}
