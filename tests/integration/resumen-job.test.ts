// @vitest-environment node
//
// HU-030. Se prueba el job contra la base de test real, con un generador
// falso (nunca la API real de Anthropic: costaría dinero en cada ejecución de
// los tests, y el job es "bajo demanda" — nadie quiere que se dispare solo).
// Lo que hay que comprobar contra Postgres de verdad es que candidatos.ts lee
// bien las filas y guardarResumen escribe el texto y la fecha donde toca.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { runResumenJob } from "../../src/lib/ia/resumen-job";
import { createPostgresResumenStore } from "../../src/lib/ia/postgres-resumen-store";
import { LONGITUD_MINIMA_DESCRIPCION } from "../../src/lib/ia/resumen-curso";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeIfConfigured = databaseUrl ? describe : describe.skip;

const DESCRIPCION_LARGA = "d".repeat(LONGITUD_MINIMA_DESCRIPCION);

describeIfConfigured("HU-030 — job de resumen con IA", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterEach(async () => {
    await client.query("delete from courses");
  });

  it("genera y guarda el resumen de un curso candidato, con su fecha", async () => {
    const { rows } = await client.query(
      `insert into courses (source, source_id, title, description)
       values ('udemy', 's1', 'Curso de prueba', $1)
       returning id`,
      [DESCRIPCION_LARGA]
    );
    const id = rows[0].id;

    const store = createPostgresResumenStore(client);
    const result = await runResumenJob({
      store,
      generador: async () => "Resumen de prueba.",
    });

    expect(result.candidatos).toBe(1);
    expect(result.generados).toBe(1);
    expect(result.fallidos).toEqual([]);

    const { rows: guardado } = await client.query(
      "select resumen_ia, resumen_ia_generado_en from courses where id = $1",
      [id]
    );
    expect(guardado[0].resumen_ia).toBe("Resumen de prueba.");
    expect(guardado[0].resumen_ia_generado_en).not.toBeNull();
  }, 30_000);

  it("no toca un curso de Coursera, aunque tenga descripción larga", async () => {
    await client.query(
      `insert into courses (source, source_id, title, description)
       values ('coursera', 's2', 'Curso de Coursera', $1)`,
      [DESCRIPCION_LARGA]
    );

    const store = createPostgresResumenStore(client);
    const result = await runResumenJob({ store, generador: async () => "No debería llamarse." });

    expect(result.candidatos).toBe(0);
  }, 30_000);

  it("no regenera un resumen ya guardado si la descripción no ha cambiado", async () => {
    const { rows } = await client.query(
      `insert into courses (source, source_id, title, description, resumen_ia, resumen_ia_generado_en)
       values ('udemy', 's3', 'Curso ya resumido', $1, 'Resumen viejo.', now())
       returning id`,
      [DESCRIPCION_LARGA]
    );
    const id = rows[0].id;

    const store = createPostgresResumenStore(client);
    const result = await runResumenJob({ store, generador: async () => "No debería llamarse." });

    expect(result.candidatos).toBe(0);

    const { rows: sinTocar } = await client.query("select resumen_ia from courses where id = $1", [
      id,
    ]);
    expect(sinTocar[0].resumen_ia).toBe("Resumen viejo.");
  }, 30_000);

  it("regenera el resumen si la descripción cambió después del último resumen", async () => {
    // El resumen se guarda un momento después de crear el curso: en ese
    // instante, updated_at (de la inserción) es anterior a
    // resumen_ia_generado_en, así que todavía NO hace falta regenerar.
    const { rows } = await client.query(
      `insert into courses (source, source_id, title, description)
       values ('udemy', 's4', 'Curso con descripción nueva', $1)
       returning id`,
      [DESCRIPCION_LARGA]
    );
    const id = rows[0].id;
    await client.query(
      "update courses set resumen_ia = 'Resumen del texto anterior.', resumen_ia_generado_en = now() where id = $1",
      [id]
    );

    const storeAntes = createPostgresResumenStore(client);
    const antesDeCambiar = await runResumenJob({
      store: storeAntes,
      generador: async () => "No debería llamarse.",
    });
    expect(antesDeCambiar.candidatos).toBe(0);

    // Ahora sí cambia la descripción, y con ella updated_at pasa a ser
    // posterior al resumen guardado — es lo único que tiene que importar.
    await client.query(
      "update courses set description = $2, updated_at = now() where id = $1",
      [id, DESCRIPCION_LARGA + " (cambiada)"]
    );

    const store = createPostgresResumenStore(client);
    const result = await runResumenJob({ store, generador: async () => "Resumen nuevo." });

    expect(result.candidatos).toBe(1);
    expect(result.generados).toBe(1);

    const { rows: actualizado } = await client.query(
      "select resumen_ia from courses where id = $1",
      [id]
    );
    expect(actualizado[0].resumen_ia).toBe("Resumen nuevo.");
  }, 30_000);
});
