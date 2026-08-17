// Ejecuta el job de avisos de bajada de precio (HU-021).
//
// Va después de la ingesta: primero se actualizan los precios, luego se mira
// quién tenía guardado algo que ha bajado.
//
// Si no hay RESEND_API_KEY, el job corre igual y registra los avisos que
// mandaría en vez de enviarlos. Es deliberado: permite comprobar la detección
// completa antes de dar de alta el correo (ver src/lib/alertas/enviar.ts).
import { Client } from "pg";
import { runAlertasPrecioJob } from "../src/lib/alertas/job.ts";
import { crearEnviadorDesdeEntorno } from "../src/lib/alertas/enviar.ts";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Falta la variable de entorno DATABASE_URL.");
  process.exit(1);
}

// En local, no tener clave es lo normal y el job corre en seco. En CI no: ahí
// apunta a la base de producción, con personas de verdad dentro, y degradar en
// silencio significaría que cada noche se procesan sus bajadas sin que llegue
// ningún aviso y sin que nadie se entere. Mejor fallar y que se vea.
if (!process.env.RESEND_API_KEY && (process.env.CI || process.env.GITHUB_ACTIONS)) {
  console.error(
    "Falta RESEND_API_KEY. En CI no se ejecuta el job en seco: créala como secreto del repositorio."
  );
  process.exit(1);
}

const enviador = crearEnviadorDesdeEntorno();
console.log(`Enviador de correo: ${enviador.nombre}`);

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const r = await runAlertasPrecioJob({ client, enviador });

  console.log(
    `Favoritos revisados: ${r.candidatos}, avisos enviados: ${r.enviados}, fallidos: ${r.fallidos}`
  );

  const motivos = Object.entries(r.descartados).filter(([, n]) => n > 0);
  if (motivos.length > 0) {
    console.log("Descartados:", motivos.map(([m, n]) => `${m}=${n}`).join(", "));
  }

  // Un fallo de envío no tumba el job, pero sí debe verse en rojo en Actions:
  // si no, un problema con Resend pasaría desapercibido durante días.
  if (r.fallidos > 0) {
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
