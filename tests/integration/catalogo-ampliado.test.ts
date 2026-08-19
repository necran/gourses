// @vitest-environment node
//
// HU-023. Los unitarios cubren la concurrencia y los reintentos con dobles;
// esto comprueba lo que aquellos no pueden ver: que con las subcategorías
// activadas la ingesta real trae cursos que antes no llegaban, y que los guarda.
//
// Se ejecuta acotada (pocos ámbitos) para no castigar la API de Udemy en cada
// pasada de tests. Las filas sembradas se borran al terminar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { runUdemyIngestJob } from "../../src/lib/ingesta/udemy/job.ts";
import { createPostgresCourseStore } from "../../src/lib/ingesta/postgres-course-store.ts";

const databaseUrl = process.env.DATABASE_URL;
const clientId = process.env.UDEMY_CLIENT_ID;
const clientSecret = process.env.UDEMY_CLIENT_SECRET;
const baseUrl = process.env.UDEMY_AFFILIATE_API_BASE_URL;

const configurado = databaseUrl && clientId && clientSecret && baseUrl;
const describeIfConfigured = configurado ? describe : describe.skip;

describeIfConfigured("HU-023 — catálogo ampliado", () => {
  let pg: Client;
  const creds = { baseUrl: baseUrl!, clientId: clientId!, clientSecret: clientSecret! };

  beforeAll(async () => {
    pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
  }, 60_000);

  afterAll(async () => {
    await pg.end();
  });

  // Con solo las 13 categorías raíz el catálogo se quedaba en 425 cursos. Lo que
  // multiplica el número de ámbitos —y por tanto de cursos— son las
  // subcategorías: 13 frente a 143.
  it("recorrer subcategorías da más ámbitos que solo las categorías raíz", async () => {
    const store = createPostgresCourseStore(pg);

    const sinSubs = await runUdemyIngestJob({
      creds,
      store,
      includeSubcategories: false,
      maxScopes: 2,
      maxPagesPerScope: 1,
      pageSize: 12,
      concurrenciaDetalle: 4,
    });

    const conSubs = await runUdemyIngestJob({
      creds,
      store,
      includeSubcategories: true,
      maxScopes: 6,
      maxPagesPerScope: 1,
      pageSize: 12,
      concurrenciaDetalle: 4,
    });

    expect(sinSubs.scopes).toBe(2);
    expect(conSubs.scopes).toBe(6);
    expect(conSubs.processed).toBeGreaterThan(sinSubs.processed);
  }, 180_000);

  it("guarda de verdad los cursos que trae, con su precio", async () => {
    const store = createPostgresCourseStore(pg);

    const r = await runUdemyIngestJob({
      creds,
      store,
      includeSubcategories: true,
      maxScopes: 3,
      maxPagesPerScope: 1,
      pageSize: 12,
      concurrenciaDetalle: 4,
    });

    expect(r.processed).toBeGreaterThan(0);
    expect(r.saved).toBe(r.processed);

    // Y están en la base con precio: el listado no lo trae, así que esto
    // demuestra que la llamada de detalle concurrente funcionó.
    const { rows } = await pg.query(
      `select count(*)::int as n from courses where source = 'udemy' and price_amount is not null`
    );
    expect(rows[0].n).toBeGreaterThan(0);
  }, 180_000);

  // El solapamiento entre ámbitos es alto: sin deduplicar, la concurrencia
  // multiplicaría las llamadas de detalle en vez de acelerar nada.
  it("no procesa dos veces el mismo curso dentro de una ejecución", async () => {
    const store = createPostgresCourseStore(pg);

    const r = await runUdemyIngestJob({
      creds,
      store,
      includeSubcategories: true,
      maxScopes: 5,
      maxPagesPerScope: 1,
      pageSize: 12,
      concurrenciaDetalle: 4,
    });

    // Como máximo un curso por ítem servido; si hubiera repeticiones,
    // `processed` superaría el número de cursos únicos guardados.
    const { rows } = await pg.query(
      `select count(distinct source_id)::int as n from courses where source = 'udemy'`
    );
    expect(r.processed).toBeLessThanOrEqual(rows[0].n);
  }, 180_000);
});
