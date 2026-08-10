// @vitest-environment node
//
// HU-010: comprueba contra las APIs reales que ambos adaptadores rellenan
// categoría e instructor, y que el vocabulario común cumple su razón de ser:
// una misma categoría devuelve cursos de las dos plataformas.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { runUdemyIngestJob } from "../../src/lib/ingesta/udemy/job";
import { runCourseraIngestJob } from "../../src/lib/ingesta/coursera/job";
import { createPostgresCourseStore } from "../../src/lib/ingesta/postgres-course-store";
import { COURSE_CATEGORIES } from "../../src/lib/courses/categories";

const databaseUrl = process.env.TEST_DATABASE_URL;
const udemyBaseUrl = process.env.UDEMY_AFFILIATE_API_BASE_URL;
const clientId = process.env.UDEMY_CLIENT_ID;
const clientSecret = process.env.UDEMY_CLIENT_SECRET;
const courseraBaseUrl = process.env.COURSERA_CATALOG_API_BASE_URL;

const configured =
  databaseUrl && udemyBaseUrl && clientId && clientSecret && courseraBaseUrl;
const describeIfConfigured = configured ? describe : describe.skip;

describeIfConfigured("HU-010 — categoría común e instructor", () => {
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

  it("la ingesta de Coursera rellena instructor y categoría", async () => {
    const store = createPostgresCourseStore(client);
    await runCourseraIngestJob({ baseUrl: courseraBaseUrl!, store, maxPages: 1, pageSize: 20 });

    const { rows } = await client.query(
      `select count(*)::int as total,
              count(instructor)::int as con_instructor,
              count(category)::int as con_categoria
       from courses where source = 'coursera'`
    );

    expect(rows[0].total).toBeGreaterThan(0);
    // Antes de HU-010 el instructor era null en el 100% de los cursos.
    expect(rows[0].con_instructor).toBeGreaterThan(0);
    expect(rows[0].con_categoria).toBeGreaterThan(0);
  }, 60_000);

  it("la ingesta de Udemy rellena la categoría del ámbito recorrido", async () => {
    const store = createPostgresCourseStore(client);
    await runUdemyIngestJob({
      creds: { baseUrl: udemyBaseUrl!, clientId: clientId!, clientSecret: clientSecret! },
      store,
      maxScopes: 1,
      maxPagesPerScope: 1,
      pageSize: 5,
    });

    const { rows } = await client.query(
      `select distinct category from courses where source = 'udemy'`
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.category).not.toBeNull();
    }
  }, 60_000);

  it("solo se guardan categorías del vocabulario común, nunca la etiqueta original", async () => {
    const store = createPostgresCourseStore(client);
    await runCourseraIngestJob({ baseUrl: courseraBaseUrl!, store, maxPages: 1, pageSize: 20 });
    await runUdemyIngestJob({
      creds: { baseUrl: udemyBaseUrl!, clientId: clientId!, clientSecret: clientSecret! },
      store,
      maxScopes: 1,
      maxPagesPerScope: 1,
      pageSize: 5,
    });

    const { rows } = await client.query(
      `select distinct category from courses where category is not null`
    );

    const vocabulario = new Set<string>(COURSE_CATEGORIES);
    for (const row of rows) {
      expect(vocabulario.has(row.category), `categoría fuera del vocabulario: ${row.category}`).toBe(
        true
      );
    }
  }, 90_000);

  // HU-011: duración.
  it("la ingesta de Udemy guarda la duración de todos sus cursos", async () => {
    const store = createPostgresCourseStore(client);
    await runUdemyIngestJob({
      creds: { baseUrl: udemyBaseUrl!, clientId: clientId!, clientSecret: clientSecret! },
      store,
      maxScopes: 1,
      maxPagesPerScope: 1,
      pageSize: 5,
    });

    const { rows } = await client.query(
      `select count(*)::int as total, count(duration_min_minutes)::int as con_duracion
       from courses where source = 'udemy'`
    );

    // Udemy publica la duración en el listado en formato uniforme, así que la
    // cobertura debe ser total.
    expect(rows[0].total).toBeGreaterThan(0);
    expect(rows[0].con_duracion).toBe(rows[0].total);
  }, 60_000);

  it("la ingesta de Coursera guarda duraciones, incluidas las de rango", async () => {
    const store = createPostgresCourseStore(client);
    await runCourseraIngestJob({ baseUrl: courseraBaseUrl!, store, maxPages: 1, pageSize: 100 });

    const { rows } = await client.query(
      `select count(duration_min_minutes)::int as con_duracion,
              count(*) filter (where duration_min_minutes <> duration_max_minutes)::int as rangos
       from courses where source = 'coursera'`
    );

    expect(rows[0].con_duracion).toBeGreaterThan(0);
    // Parte de las duraciones de Coursera son rangos genuinos ("2-4 h/semana"),
    // y es justo el motivo de guardar mínimo y máximo por separado.
    expect(rows[0].rangos).toBeGreaterThan(0);
  }, 60_000);

  it("nunca se guarda una duración incoherente", async () => {
    const store = createPostgresCourseStore(client);
    await runCourseraIngestJob({ baseUrl: courseraBaseUrl!, store, maxPages: 1, pageSize: 50 });

    const { rows } = await client.query(
      `select count(*)::int as incoherentes from courses
       where duration_min_minutes is not null
         and (duration_min_minutes <= 0 or duration_max_minutes < duration_min_minutes)`
    );

    expect(rows[0].incoherentes).toBe(0);
  }, 60_000);

  // La razón de ser del vocabulario común: sin él, filtrar por categoría
  // escondería una fuente entera, el fallo que corrigió HU-005 con el orden.
  it("una misma categoría común devuelve cursos de las dos plataformas", async () => {
    // 'desarrollo' es una categoría que ambas sirven: Development en Udemy,
    // computer-science en Coursera.
    await client.query(
      `insert into courses (source, source_id, title, category) values
        ('udemy', 'hu010-u', 'Curso de Udemy de desarrollo', 'desarrollo'),
        ('coursera', 'hu010-c', 'Curso de Coursera de desarrollo', 'desarrollo')`
    );

    const { rows } = await client.query(
      `select source from courses where category = 'desarrollo' order by source`
    );

    expect(rows.map((r) => r.source)).toEqual(["coursera", "udemy"]);
  });
});
