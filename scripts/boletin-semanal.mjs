// Ejecuta el boletín semanal (HU-066).
//
// Sin RESEND_API_KEY corre igual y registra los asuntos en vez de enviar, como
// los avisos de precio (ver src/lib/alertas/enviar.ts).
import { Client } from "pg";
import { runBoletinJob } from "../src/lib/boletin/job.ts";
import { crearEnviadorDesdeEntorno } from "../src/lib/alertas/enviar.ts";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Falta la variable de entorno DATABASE_URL.");
  process.exit(1);
}

// En CI apunta a producción: sin clave no se corre en seco en silencio.
if (!process.env.RESEND_API_KEY && (process.env.CI || process.env.GITHUB_ACTIONS)) {
  console.error("Falta RESEND_API_KEY. En CI no se ejecuta el boletín en seco.");
  process.exit(1);
}

const enviador = crearEnviadorDesdeEntorno();
console.log(`Enviador de correo: ${enviador.nombre}`);

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const r = await runBoletinJob({ client, enviador });
  if (r.sinContenido) {
    console.log(`Semana ${r.semana}: sin cursos nuevos ni bajadas, no se envía nada (${r.suscritos} apuntados).`);
  } else {
    console.log(`Semana ${r.semana}: apuntados pendientes ${r.suscritos}, enviados ${r.enviados}, fallidos ${r.fallidos}`);
  }
  if (r.fallidos > 0) process.exitCode = 1;
} finally {
  await client.end();
}
