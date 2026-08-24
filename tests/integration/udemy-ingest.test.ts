// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { runUdemyIngestJob } from "../../src/lib/ingesta/udemy/job";
import * as api from "../../src/lib/ingesta/udemy/fetch-catalog";
import { UdemyShapeError } from "../../src/lib/ingesta/udemy/normalize";
import { createPostgresCourseStore } from "../../src/lib/ingesta/postgres-course-store";

const databaseUrl = process.env.TEST_DATABASE_URL;
const baseUrl = process.env.UDEMY_AFFILIATE_API_BASE_URL;
const clientId = process.env.UDEMY_CLIENT_ID;
const clientSecret = process.env.UDEMY_CLIENT_SECRET;

const configured = databaseUrl && baseUrl && clientId && clientSecret;
const describeIfConfigured = configured ? describe : describe.skip;

describeIfConfigured("HU-005 — ingesta de Udemy", () => {
  let client: Client;
  const creds = { baseUrl: baseUrl!, clientId: clientId!, clientSecret: clientSecret! };

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await client.query("delete from course_price_history");
    await client.query("delete from courses");
  });

  afterAll(async () => {
    await client.end();
  });

  it("ejecuta el job contra la API real y guarda los cursos en la BD de test", async () => {
    const store = createPostgresCourseStore(client);
    const result = await runUdemyIngestJob({
      creds,
      store,
      maxScopes: 1,
      maxPagesPerScope: 1,
      pageSize: 5,
    });

    expect(result.saved).toBeGreaterThan(0);

    const { rows } = await client.query(
      `select source, source_id, title, price_amount, price_currency, affiliate_url
       from courses where source = 'udemy'`
    );
    expect(rows.length).toBe(result.saved);

    for (const row of rows) {
      expect(row.source).toBe("udemy");
      expect(row.title).toBeTruthy();
      expect(row.affiliate_url).toMatch(/^https:\/\/www\.udemy\.com\//);
    }

    // El precio viene de la llamada de detalle: al menos uno debe traerlo,
    // porque es lo que da sentido a las alertas de precio de Fase 4.
    const conPrecio = rows.filter((r) => r.price_amount !== null);
    expect(conPrecio.length).toBeGreaterThan(0);
    for (const row of conPrecio) {
      expect(Number(row.price_amount)).toBeGreaterThan(0);
      expect(row.price_currency).toMatch(/^[A-Z]{3}$/);
    }
    // Encadena ~8 llamadas de red reales (categorías, descubrimiento y una de
    // detalle por curso): con el timeout por defecto de 5s se agotaba a veces,
    // y al quedar trabajo en vuelo contaminaba el test siguiente.
  }, 60_000);

  it("registra el precio inicial en el histórico y añade una fila solo cuando cambia", async () => {
    const store = createPostgresCourseStore(client);
    await runUdemyIngestJob({ creds, store, maxScopes: 1, maxPagesPerScope: 1, pageSize: 3 });

    const { rows: iniciales } = await client.query(
      `select c.id, count(h.id)::int as historico
       from courses c join course_price_history h on h.course_id = c.id
       where c.source = 'udemy' group by c.id`
    );
    expect(iniciales.length).toBeGreaterThan(0);
    for (const row of iniciales) expect(row.historico).toBe(1);

    // Segunda pasada sin cambios de precio: no debe duplicar histórico.
    await runUdemyIngestJob({ creds, store, maxScopes: 1, maxPagesPerScope: 1, pageSize: 3 });

    const { rows: repetidos } = await client.query(
      `select count(*)::int as total from course_price_history`
    );
    expect(repetidos[0].total).toBe(iniciales.length);

    // Bajada de precio simulada sobre un curso ya ingerido: sí añade histórico.
    const cursoId = iniciales[0].id;
    await client.query(`update courses set price_amount = 999.99 where id = $1`, [cursoId]);
    await runUdemyIngestJob({ creds, store, maxScopes: 1, maxPagesPerScope: 1, pageSize: 3 });

    const { rows: tras } = await client.query(
      `select count(*)::int as total from course_price_history where course_id = $1`,
      [cursoId]
    );
    expect(tras[0].total).toBe(2);
    // Tres ingestas completas contra la API real (listado + detalle por curso):
    // el timeout por defecto de 5s se queda corto por la latencia de red, no
    // por lentitud del código.
  }, 60_000);

  it("se detiene de forma controlada ante un error de la API sin dejar datos a medias", async () => {
    vi.spyOn(api, "fetchCategories").mockRejectedValue(
      new Error("Udemy API respondió 429 Too Many Requests en /api-2.0/course-categories/")
    );

    const store = createPostgresCourseStore(client);
    await expect(runUdemyIngestJob({ creds, store })).rejects.toThrow(/429/);

    const { rows } = await client.query(`select count(*)::int as total from courses`);
    expect(rows[0].total).toBe(0);
  });

  it("se detiene si la API cambia de contrato, sin guardar cursos a medio normalizar", async () => {
    vi.spyOn(api, "fetchCategories").mockRejectedValue(
      new UdemyShapeError("falta 'results' o no es un array en course-categories", null)
    );

    const store = createPostgresCourseStore(client);
    await expect(runUdemyIngestJob({ creds, store })).rejects.toThrow(UdemyShapeError);

    const { rows } = await client.query(`select count(*)::int as total from courses`);
    expect(rows[0].total).toBe(0);
  });

  it("un curso de Udemy y uno de Coursera conviven sin colisión de (source, source_id)", async () => {
    await client.query(
      `insert into courses (source, source_id, title) values ('coursera', 'shared-id', 'Curso de Coursera')`
    );

    const store = createPostgresCourseStore(client);
    await store.insertCourse({
      source: "udemy",
      sourceId: "shared-id",
      title: "Curso de Udemy",
      description: null,
      priceAmount: null,
      priceCurrency: null,
      rating: null,
      level: null,
      language: null,
      instructor: null,
      affiliateUrl: null,
      imageUrl: null,
      category: null,
      numReviews: null,
      numSubscribers: null,
      whatYouWillLearn: null,
      requirements: null,
      durationMinMinutes: null,
      durationMaxMinutes: null,
    });

    const { rows } = await client.query(
      `select source, title from courses where source_id = 'shared-id' order by source`
    );
    expect(rows).toEqual([
      { source: "coursera", title: "Curso de Coursera" },
      { source: "udemy", title: "Curso de Udemy" },
    ]);
  });
});
