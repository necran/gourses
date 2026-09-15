// @vitest-environment node
//
// HU-030 y HU-052. Se prueba el job contra la base de test real, con un
// generador falso (nunca la API real: gastaría cuota en cada ejecución de los
// tests). Lo que hay que comprobar contra Postgres de verdad es que el store lee
// las filas que tocan, en el orden que toca, y que guarda el resumen, la fecha
// y la huella donde toca.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { runResumenJob } from "../../src/lib/ia/resumen-job";
import { createPostgresResumenStore } from "../../src/lib/ia/postgres-resumen-store";
import { LONGITUD_MINIMA_DESCRIPCION, huellaDescripcion } from "../../src/lib/ia/resumen-curso";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeIfConfigured = databaseUrl ? describe : describe.skip;

const DESCRIPCION_LARGA = "d".repeat(LONGITUD_MINIMA_DESCRIPCION);

describeIfConfigured("HU-030 / HU-052 — job de resumen con IA", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterEach(async () => {
    await client.query("delete from courses");
  });

  async function insertar(campos: {
    source?: string;
    sourceId: string;
    description?: string;
    language?: string | null;
    numSubscribers?: number | null;
  }): Promise<string> {
    const { rows } = await client.query(
      `insert into courses (source, source_id, title, description, language, num_subscribers)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        campos.source ?? "udemy",
        campos.sourceId,
        `Curso ${campos.sourceId}`,
        campos.description ?? DESCRIPCION_LARGA,
        campos.language ?? null,
        campos.numSubscribers ?? null,
      ]
    );
    return rows[0].id;
  }

  it("genera y guarda el resumen, su fecha y la huella de la descripción resumida", async () => {
    const id = await insertar({ sourceId: "s1" });

    const result = await runResumenJob({
      store: createPostgresResumenStore(client),
      generador: async () => "Resumen de prueba.",
    });

    expect(result).toMatchObject({ candidatos: 1, generados: 1, fallidos: [], pendientes: 0 });
    const { rows } = await client.query(
      "select resumen_ia, resumen_ia_generado_en, resumen_ia_descripcion_sha256 from courses where id = $1",
      [id]
    );
    expect(rows[0].resumen_ia).toBe("Resumen de prueba.");
    expect(rows[0].resumen_ia_generado_en).not.toBeNull();
    expect(rows[0].resumen_ia_descripcion_sha256).toBe(huellaDescripcion(DESCRIPCION_LARGA));
  }, 30_000);

  // HU-030 dejaba Coursera fuera y este test exigía lo contrario. Cambia
  // porque cambió el alcance (HU-052), no para que pase.
  it("resume también un curso de Coursera con descripción suficiente", async () => {
    const id = await insertar({ source: "coursera", sourceId: "s2" });

    const result = await runResumenJob({
      store: createPostgresResumenStore(client),
      generador: async () => "Resumen de Coursera.",
    });

    expect(result.generados).toBe(1);
    const { rows } = await client.query("select resumen_ia from courses where id = $1", [id]);
    expect(rows[0].resumen_ia).toBe("Resumen de Coursera.");
  }, 30_000);

  it("resume primero los cursos en español y, dentro de cada idioma, los de más alumnos", async () => {
    await insertar({ sourceId: "en-muchos", language: "en", numSubscribers: 900_000 });
    await insertar({ sourceId: "es-pocos", language: "es", numSubscribers: 10 });
    await insertar({ sourceId: "sin-idioma", language: null, numSubscribers: 5_000 });
    await insertar({ sourceId: "es-muchos", language: "es", numSubscribers: 50_000 });
    await insertar({ sourceId: "es-sin-alumnos", language: "es", numSubscribers: null });
    await insertar({ sourceId: "en-pocos", language: "en", numSubscribers: 1 });

    const orden: string[] = [];
    await runResumenJob({
      store: createPostgresResumenStore(client),
      concurrencia: 1,
      generador: async ({ title }) => {
        orden.push(title.replace("Curso ", ""));
        return "Resumen.";
      },
    });

    expect(orden.slice(0, 3)).toEqual(["es-muchos", "es-pocos", "es-sin-alumnos"]);
    expect(orden.slice(3)).toEqual(["en-muchos", "sin-idioma", "en-pocos"]);
  }, 30_000);

  // El fallo que motivó HU-052: la ingesta diaria pone updated_at = now() a
  // todos los cursos, cambien o no.
  it("no regenera un resumen si la ingesta solo actualiza la fecha del curso", async () => {
    const id = await insertar({ sourceId: "s3" });
    const store = createPostgresResumenStore(client);
    await runResumenJob({ store, generador: async () => "Resumen original." });

    await client.query("update courses set updated_at = now() + interval '1 day' where id = $1", [id]);
    const result = await runResumenJob({ store, generador: async () => "No debería llamarse." });

    expect(result.candidatos).toBe(0);
    const { rows } = await client.query("select resumen_ia from courses where id = $1", [id]);
    expect(rows[0].resumen_ia).toBe("Resumen original.");
  }, 30_000);

  it("regenera el resumen si la descripción cambia", async () => {
    const id = await insertar({ sourceId: "s4" });
    const store = createPostgresResumenStore(client);
    await runResumenJob({ store, generador: async () => "Resumen del texto anterior." });

    const nueva = `${DESCRIPCION_LARGA} (cambiada)`;
    await client.query("update courses set description = $2 where id = $1", [id, nueva]);
    const result = await runResumenJob({ store, generador: async () => "Resumen nuevo." });

    expect(result).toMatchObject({ candidatos: 1, generados: 1 });
    const { rows } = await client.query(
      "select resumen_ia, resumen_ia_descripcion_sha256 from courses where id = $1",
      [id]
    );
    expect(rows[0].resumen_ia).toBe("Resumen nuevo.");
    expect(rows[0].resumen_ia_descripcion_sha256).toBe(huellaDescripcion(nueva));
  }, 30_000);

  it("la migración da por bueno un resumen antiguo sin huella, sin regenerarlo", async () => {
    const id = await insertar({ sourceId: "s5" });
    await client.query(
      "update courses set resumen_ia = 'Resumen de antes de HU-052.', resumen_ia_generado_en = now() where id = $1",
      [id]
    );

    // Mismo UPDATE que la migración 0009.
    await client.query(`
      update courses
         set resumen_ia_descripcion_sha256 = encode(sha256(convert_to(description, 'UTF8')), 'hex')
       where resumen_ia is not null and resumen_ia_descripcion_sha256 is null and description is not null`);
    const result = await runResumenJob({
      store: createPostgresResumenStore(client),
      generador: async () => "No debería llamarse.",
    });

    expect(result.candidatos).toBe(0);
  }, 30_000);
});
