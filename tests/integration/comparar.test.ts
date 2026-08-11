// @vitest-environment node
//
// Misma excepción documentada que en HU-007 (ver .claude/rules/testing.md): se
// siembran filas marcadas en dev, se consultan por el mismo camino que
// producción (supabase-js/anon, RLS real) y se borran al terminar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCoursesByIds } from "../../src/lib/courses/get-course";
import { buildCompareRows } from "../../src/lib/courses/compare";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = databaseUrl && supabaseUrl && anonKey ? describe : describe.skip;

const MARKER = "zzz-hu017-test-";

describeIfConfigured("HU-017 — comparador", () => {
  let pgClient: Client;
  let supabase: SupabaseClient;
  let idUdemy: string;
  let idCoursera: string;

  beforeAll(async () => {
    pgClient = new Client({ connectionString: databaseUrl });
    await pgClient.connect();
    supabase = createClient(supabaseUrl!, anonKey!);

    const { rows } = await pgClient.query(
      `insert into courses
        (source, source_id, title, price_amount, price_currency, rating, level, language, instructor, category, duration_min_minutes, duration_max_minutes)
       values
        ('udemy', $1, 'HU-017 curso de Udemy', 19.99, 'EUR', 4.5, 'Beginner', 'es', 'Instructor Uno', 'desarrollo', 120, 120),
        ('coursera', $2, 'HU-017 curso de Coursera', null, null, null, null, 'en', 'Universidad Ejemplo', 'desarrollo', 480, 960)
       returning id, source`,
      [`${MARKER}udemy`, `${MARKER}coursera`]
    );

    idUdemy = rows.find((r) => r.source === "udemy")!.id;
    idCoursera = rows.find((r) => r.source === "coursera")!.id;
  });

  afterAll(async () => {
    await pgClient.query(`delete from courses where source_id like $1`, [`${MARKER}%`]);
    await pgClient.end();
  });

  it("recupera varios cursos reales en una sola consulta", async () => {
    const cursos = await getCoursesByIds(supabase, [idUdemy, idCoursera]);

    expect(cursos).toHaveLength(2);
    expect(cursos.map((c) => c.title)).toEqual([
      "HU-017 curso de Udemy",
      "HU-017 curso de Coursera",
    ]);
  });

  // El orden que ve el usuario es el que pidió, no el que devuelva la base.
  it("respeta el orden en que se piden los cursos", async () => {
    const cursos = await getCoursesByIds(supabase, [idCoursera, idUdemy]);
    expect(cursos.map((c) => c.source)).toEqual(["coursera", "udemy"]);
  });

  it("ignora los identificadores que no existen y devuelve el resto", async () => {
    const cursos = await getCoursesByIds(supabase, [
      idUdemy,
      "00000000-0000-4000-8000-000000000000",
      idCoursera,
    ]);
    expect(cursos).toHaveLength(2);
  });

  it("no consulta nada si ningún identificador es válido", async () => {
    expect(await getCoursesByIds(supabase, ["no-soy-un-uuid", "' or 1=1 --"])).toEqual([]);
  });

  it("construye la comparación con los huecos explícitos de cada plataforma", async () => {
    const cursos = await getCoursesByIds(supabase, [idUdemy, idCoursera]);
    const filas = buildCompareRows(cursos);

    const precio = filas.find((f) => f.etiqueta === "Precio")!;
    expect(precio.celdas[0].valor).toBe("19.99 EUR");
    expect(precio.celdas[1].valor).toBeNull();

    const duracion = filas.find((f) => f.etiqueta === "Duración")!;
    expect(duracion.celdas[0].valor).toBe("2 h");
    expect(duracion.celdas[1].valor).toBe("8 h–16 h");
  });
});
