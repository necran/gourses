// Aplica todos los ficheros de supabase/migrations/*.sql, en orden, contra la
// base de datos indicada en DATABASE_URL. Las migraciones son idempotentes
// (IF NOT EXISTS / DROP POLICY IF EXISTS + CREATE), así que reaplicarlas no falla.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Falta la variable de entorno DATABASE_URL.");
  process.exit(1);
}

const migrationsDir = path.join(import.meta.dirname, "..", "supabase", "migrations");
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Aplicando ${file}...`);
    await client.query(sql);
  }
  console.log(`${files.length} migración(es) aplicada(s) correctamente.`);
} finally {
  await client.end();
}
