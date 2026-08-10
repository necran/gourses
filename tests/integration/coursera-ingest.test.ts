// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { runCourseraIngestJob } from "../../src/lib/ingesta/coursera/job";
import { createPostgresCourseStore } from "../../src/lib/ingesta/postgres-course-store";

const databaseUrl = process.env.TEST_DATABASE_URL;
const baseUrl = process.env.COURSERA_CATALOG_API_BASE_URL;
const describeIfConfigured = databaseUrl && baseUrl ? describe : describe.skip;

describeIfConfigured("HU-006 — ingesta de Coursera", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterEach(async () => {
    await client.query("delete from course_price_history");
    await client.query("delete from courses");
  });

  afterAll(async () => {
    await client.end();
  });

  it("ejecuta el job contra la Catalog API real y guarda los cursos en la BD de test", async () => {
    const store = createPostgresCourseStore(client);
    const result = await runCourseraIngestJob({ baseUrl: baseUrl!, store, maxPages: 1, pageSize: 5 });

    expect(result.saved).toBeGreaterThan(0);

    const { rows } = await client.query(`select source, source_id, title from courses where source = 'coursera'`);
    expect(rows.length).toBe(result.saved);
    for (const row of rows) {
      expect(row.source).toBe("coursera");
      expect(row.title).toBeTruthy();
    }
    // Llamada a la API real: el timeout por defecto de 5s depende demasiado de
    // la latencia de red (ver la nota equivalente en udemy-ingest.test.ts).
  }, 60_000);

  it("un curso de Udemy y uno de Coursera conviven sin colisión de (source, source_id)", async () => {
    await client.query(
      `insert into courses (source, source_id, title) values ('udemy', 'shared-id', 'Curso de Udemy')`
    );

    const store = createPostgresCourseStore(client);
    await store.insertCourse({
      source: "coursera",
      sourceId: "shared-id",
      title: "Curso de Coursera",
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
