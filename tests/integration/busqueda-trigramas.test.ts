// @vitest-environment node
//
// HU-057. La búsqueda por palabra clave (`title ILIKE '%…%' OR description ILIKE
// '%…%'`) recorría la tabla entera. La migración 0010 añade índices de
// trigramas. Aquí se comprueba contra Postgres de verdad, con la misma forma de
// consulta que genera PostgREST:
//
// - que los índices existen;
// - que la consulta **puede** usarlos. Con pocas filas sembradas, el
//   planificador prefiere leer la tabla (es más barato), así que se le prohíbe
//   el recorrido secuencial para ver si hay un índice aplicable: si no lo
//   hubiera, seguiría leyendo la tabla igualmente;
// - que los resultados son exactamente los mismos con índice que sin él.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeIfConfigured = databaseUrl ? describe : describe.skip;

// Desde HU-061 la búsqueda compara las columnas sin tildes.
const CONSULTA = `select id from courses
  where titulo_busqueda ilike $1 or descripcion_busqueda ilike $1
  order by id`;

describeIfConfigured("HU-057 — búsqueda por palabra clave con índices de trigramas", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterEach(async () => {
    await client.query("reset enable_seqscan");
    await client.query("reset enable_bitmapscan");
    await client.query("reset enable_indexscan");
    await client.query("delete from courses");
  });

  afterAll(async () => {
    await client.end();
  });

  async function sembrar() {
    const cursos = [
      ["t1", "Python desde cero", "Aprende a programar."],
      ["t2", "Excel avanzado", "Tablas dinámicas y macros con Python embebido."],
      ["t3", "Diseño gráfico", "Composición, color y tipografía."],
      ["t4", "PYTHON para datos", null],
      ["t5", "Marketing digital", "Campañas, embudos y analítica."],
    ];
    for (const [sourceId, title, description] of cursos) {
      await client.query(
        "insert into courses (source, source_id, title, description) values ('udemy', $1, $2, $3)",
        [sourceId, title, description]
      );
    }
    // Relleno para que la tabla no quepa en una sola página y el plan sea
    // representativo.
    await client.query(`
      insert into courses (source, source_id, title, description)
      select 'coursera', 'relleno-' || g, 'Curso de relleno ' || g, repeat('texto de relleno ', 50)
      from generate_series(1, 400) g`);
    await client.query("analyze courses");
  }

  it("la migración crea los dos índices de trigramas", async () => {
    const { rows } = await client.query(
      "select indexname from pg_indexes where tablename = 'courses' and indexname like '%trgm%' order by indexname"
    );
    // HU-061 los movió a las columnas sin tildes y quitó los de title/description.
    expect(rows.map((r) => r.indexname)).toEqual([
      "courses_descripcion_busqueda_trgm_idx",
      "courses_titulo_busqueda_trgm_idx",
    ]);
  });

  it("la búsqueda por palabra clave puede usar los índices en vez de leer la tabla", async () => {
    await sembrar();
    await client.query("set enable_seqscan = off");

    const { rows } = await client.query(`explain ${CONSULTA.replace("$1", "'%python%'").replace("$1", "'%python%'")}`);
    const plan = rows.map((r) => r["QUERY PLAN"]).join("\n");

    expect(plan).toMatch(/courses_titulo_busqueda_trgm_idx/);
    expect(plan).toMatch(/courses_descripcion_busqueda_trgm_idx/);
    expect(plan).not.toMatch(/Seq Scan/);
  }, 30_000);

  it("encuentra exactamente los mismos cursos con índice que sin él", async () => {
    await sembrar();

    for (const palabra of ["python", "PYTHON", "relleno 17", "tipografía", "no-existe-nada"]) {
      await client.query("set enable_seqscan = off");
      const conIndice = (await client.query(CONSULTA, [`%${palabra}%`])).rows.map((r) => r.id);

      await client.query("reset enable_seqscan");
      await client.query("set enable_bitmapscan = off");
      await client.query("set enable_indexscan = off");
      const sinIndice = (await client.query(CONSULTA, [`%${palabra}%`])).rows.map((r) => r.id);
      await client.query("reset enable_bitmapscan");
      await client.query("reset enable_indexscan");

      expect(conIndice, palabra).toEqual(sinIndice);
    }
  }, 30_000);
});
