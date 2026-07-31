// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

// Corre contra TEST_DATABASE_URL (base "gourses_test" dedicada, nunca la de
// desarrollo), ver .claude/rules/testing.md. Se salta si no hay conexión
// configurada, en vez de fallar el resto de la suite.
const databaseUrl = process.env.TEST_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

describeIfDb("HU-004 — esquema común de cursos", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client.query("delete from course_price_history");
    await client.query("delete from courses");
    await client.end();
  });

  it("crea la tabla courses con la restricción de unicidad (source, source_id)", async () => {
    const { rows } = await client.query(
      `select indexname from pg_indexes where tablename = 'courses' and indexname = 'courses_source_source_id_key'`
    );
    expect(rows).toHaveLength(1);
  });

  it("crea la tabla course_price_history", async () => {
    const { rows } = await client.query(
      `select table_name from information_schema.tables where table_name = 'course_price_history'`
    );
    expect(rows).toHaveLength(1);
  });

  it("rechaza insertar un (source, source_id) duplicado", async () => {
    await client.query(
      `insert into courses (source, source_id, title) values ('udemy', 'dup-1', 'Curso original')`
    );

    await expect(
      client.query(
        `insert into courses (source, source_id, title) values ('udemy', 'dup-1', 'Curso duplicado')`
      )
    ).rejects.toThrow(/duplicate key value/);
  });

  it("reaplica la migración sobre una base ya migrada sin fallar", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const sql = await readFile(
      path.join(import.meta.dirname, "..", "..", "supabase", "migrations", "0001_courses_schema.sql"),
      "utf8"
    );
    await expect(client.query(sql)).resolves.not.toThrow();
  });
});
