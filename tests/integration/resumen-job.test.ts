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
import {
  LONGITUD_MINIMA_DESCRIPCION,
  huellaDescripcion,
  resumenDefectuoso,
} from "../../src/lib/ia/resumen-curso";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeIfConfigured = databaseUrl ? describe : describe.skip;

const DESCRIPCION_LARGA = "d".repeat(LONGITUD_MINIMA_DESCRIPCION);

// Un resumen como los de verdad. Desde HU-068, uno demasiado corto o que no
// cierra la frase cuenta como cortado y el job lo rehace: una ficha de dos
// palabras ya no representa a un resumen bueno.
const RESUMEN_BUENO =
  "Este curso enseña a programar en Python desde cero, con ejercicios prácticos en cada módulo. " +
  "Cubre estructuras de datos, funciones y manejo de errores.";

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

  // HU-068. El orden lo pone Postgres, así que la regla de «resumen cortado»
  // vive dos veces: en SQL (el ORDER BY del store) y en TypeScript
  // (`resumenDefectuoso`, que decide si hay que regenerarlo). Si dejaran de
  // coincidir, el job pondría primero cursos que luego descarta, o al revés.
  it("la regla de «resumen cortado» dice lo mismo en SQL que en TypeScript", async () => {
    const muestras = [
      "Este curso enseña a aplicar LLM SEO y",
      ":* Lifetime access, 30-day money-back",
      RESUMEN_BUENO,
      `${RESUMEN_BUENO.slice(0, 200)}…`,
      "Corto pero con punto.",
      `${"x".repeat(130)} sin cierre`,
      `${"x".repeat(130)} con cierre.`,
    ];

    const { rows } = await client.query<{ resumen: string; sql: boolean }>(
      `select resumen,
              (length(btrim(resumen)) < 120 or btrim(resumen) !~ '[.!?…]$') as sql
         from unnest($1::text[]) as resumen`,
      [muestras]
    );

    for (const fila of rows) {
      expect(fila.sql, `«${fila.resumen.slice(0, 40)}…»`).toBe(resumenDefectuoso(fila.resumen));
    }
  }, 30_000);

  // Los rotos ya están publicados en su ficha y se arreglan con una llamada;
  // los pendientes en español son miles. Primero lo roto (HU-068).
  it("pone los resúmenes cortados por delante de los cursos en español sin resumen", async () => {
    const roto = await insertar({ sourceId: "roto-en", language: "en", numSubscribers: 1 });
    await insertar({ sourceId: "es-sin-resumen", language: "es", numSubscribers: 900_000 });
    await client.query(
      `update courses
          set resumen_ia = 'Este curso enseña a aplicar LLM SEO y',
              resumen_ia_generado_en = now(),
              resumen_ia_descripcion_sha256 = $2
        where id = $1`,
      [roto, huellaDescripcion(DESCRIPCION_LARGA)]
    );

    const orden: string[] = [];
    await runResumenJob({
      store: createPostgresResumenStore(client),
      concurrencia: 1,
      generador: async ({ title }) => {
        orden.push(title.replace("Curso ", ""));
        return RESUMEN_BUENO;
      },
    });

    expect(orden).toEqual(["roto-en", "es-sin-resumen"]);
  }, 30_000);

  // El fallo que motivó HU-052: la ingesta diaria pone updated_at = now() a
  // todos los cursos, cambien o no.
  it("no regenera un resumen si la ingesta solo actualiza la fecha del curso", async () => {
    const id = await insertar({ sourceId: "s3" });
    const store = createPostgresResumenStore(client);
    await runResumenJob({ store, generador: async () => RESUMEN_BUENO });

    await client.query("update courses set updated_at = now() + interval '1 day' where id = $1", [id]);
    const result = await runResumenJob({ store, generador: async () => "No debería llamarse." });

    expect(result.candidatos).toBe(0);
    const { rows } = await client.query("select resumen_ia from courses where id = $1", [id]);
    expect(rows[0].resumen_ia).toBe(RESUMEN_BUENO);
  }, 30_000);

  // HU-068. Los 16 resúmenes cortados de la base de desarrollo tenían la huella
  // correcta, así que ninguna regla los tocaba: se quedaban rotos para siempre.
  it("rehace un resumen cortado a media palabra y no toca el que está entero", async () => {
    const roto = await insertar({ sourceId: "roto" });
    const bueno = await insertar({ sourceId: "bueno" });
    const store = createPostgresResumenStore(client);

    // Como estaban en la base: resumen a medias, pero con la huella de su propia
    // descripción, que no ha cambiado.
    await client.query(
      `update courses
          set resumen_ia = case when id = $1 then 'Este curso enseña a aplicar LLM SEO y' else $3 end,
              resumen_ia_generado_en = now(),
              resumen_ia_descripcion_sha256 = $4
        where id in ($1, $2)`,
      [roto, bueno, RESUMEN_BUENO, huellaDescripcion(DESCRIPCION_LARGA)]
    );

    const result = await runResumenJob({ store, generador: async () => RESUMEN_BUENO });

    expect(result).toMatchObject({ candidatos: 1, generados: 1 });
    const { rows } = await client.query(
      "select id, resumen_ia from courses where id in ($1, $2)",
      [roto, bueno]
    );
    const porId = new Map(rows.map((r) => [r.id, r.resumen_ia]));
    expect(porId.get(roto)).toBe(RESUMEN_BUENO);
    expect(porId.get(bueno)).toBe(RESUMEN_BUENO);
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
      "update courses set resumen_ia = $2, resumen_ia_generado_en = now() where id = $1",
      [id, RESUMEN_BUENO]
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
