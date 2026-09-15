// @vitest-environment node
//
// HU-065. La migración 0016 corrige los niveles ya guardados. Contra la base de
// test: se siembran cursos marcados con cada variante, se aplica la migración y
// se comprueba que el resultado es el mismo que da `normalizarNivel`, la función
// que usa la ingesta. Así SQL y TypeScript no se desincronizan en silencio.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizarNivel } from "../../src/lib/courses/nivel";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeIfConfigured = testDatabaseUrl ? describe : describe.skip;

const VARIANTES = [
  "All Levels",
  "Todos los niveles",
  "Beginner",
  "Beginner Level",
  "Principiante",
  "Intermediate",
  "  intermediate   LEVEL ",
  "Intermedio",
  "Expert",
  "Expert Level",
  "Experto",
  "Avanzado",
];

describeIfConfigured("HU-065 — niveles en español", () => {
  const pg = new Client({ connectionString: testDatabaseUrl });
  let sql = "";

  beforeAll(async () => {
    await pg.connect();
    sql = await readFile(
      path.join(import.meta.dirname, "..", "..", "supabase", "migrations", "0016_niveles_en_espanol.sql"),
      "utf8"
    );
  });

  afterAll(async () => {
    await pg.query("delete from courses where source_id like 'hu065-%'");
    await pg.end();
  });

  it("la migración deja cada nivel igual que normalizarNivel, y es idempotente", async () => {
    await pg.query("delete from courses where source_id like 'hu065-%'");
    for (const [i, nivel] of [...VARIANTES, null].entries()) {
      await pg.query("insert into courses (source, source_id, title, level) values ('udemy', $1, 'Curso de prueba', $2)", [
        `hu065-${i}`,
        nivel,
      ]);
    }

    await pg.query(sql);
    await pg.query(sql);

    const { rows } = await pg.query<{ source_id: string; level: string | null }>(
      "select source_id, level from courses where source_id like 'hu065-%'"
    );
    const porId = new Map(rows.map((r) => [r.source_id, r.level]));
    for (const [i, nivel] of [...VARIANTES, null].entries()) {
      // Lo que la migración no toca (español, desconocidos) se queda como estaba;
      // `normalizarNivel` además recorta, así que se compara sin espacios de más.
      const esperado = normalizarNivel(nivel);
      expect(porId.get(`hu065-${i}`)?.trim().replace(/\s+/g, " ") ?? null, String(nivel)).toBe(esperado);
    }
    expect(rows.map((r) => r.level)).not.toContain("All Levels");
  });
});
