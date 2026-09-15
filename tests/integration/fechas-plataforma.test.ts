// @vitest-environment node
//
// HU-059. Contra la base de test, con el mismo CourseStore que usan los jobs:
// la ingesta guarda las fechas de la plataforma, y una pasada que no las trae
// no borra las que ya había (mismo criterio que el precio desconocido, HU-029).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createPostgresCourseStore } from "../../src/lib/ingesta/postgres-course-store";
import type { NormalizedCourse } from "../../src/lib/courses/schema";

const databaseUrl = process.env.TEST_DATABASE_URL;

function curso(overrides: Partial<NormalizedCourse> = {}): NormalizedCourse {
  return {
    source: "udemy",
    sourceId: "hu059-1",
    title: "Curso de prueba",
    description: null,
    priceAmount: 14.99,
    priceCurrency: "EUR",
    rating: 4.5,
    level: null,
    language: "es",
    instructor: null,
    affiliateUrl: null,
    imageUrl: null,
    numReviews: null,
    numSubscribers: null,
    whatYouWillLearn: null,
    requirements: null,
    category: null,
    durationMinMinutes: null,
    durationMaxMinutes: null,
    ...overrides,
  };
}

(databaseUrl ? describe : describe.skip)("HU-059 — la ingesta guarda las fechas de la plataforma", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  });

  afterEach(async () => {
    await client.query("delete from courses");
  });

  afterAll(async () => {
    await client.end();
  });

  async function fechas(id: string) {
    const { rows } = await client.query(
      "select publicado_en, to_char(actualizado_en_plataforma, 'YYYY-MM-DD') as actualizado from courses where id = $1",
      [id]
    );
    return { publicado: rows[0].publicado_en?.toISOString() ?? null, actualizado: rows[0].actualizado };
  }

  it("al insertar guarda la publicación y la última actualización", async () => {
    const store = createPostgresCourseStore(client);
    const { id } = await store.insertCourse(
      curso({ publishedAt: "2017-07-03T17:39:15.000Z", platformUpdatedAt: "2026-06-04" })
    );

    expect(await fechas(id)).toEqual({ publicado: "2017-07-03T17:39:15.000Z", actualizado: "2026-06-04" });
  }, 30_000);

  it("sin fechas, las columnas quedan vacías, no con la fecha de hoy", async () => {
    const store = createPostgresCourseStore(client);
    const { id } = await store.insertCourse(curso());

    expect(await fechas(id)).toEqual({ publicado: null, actualizado: null });
  }, 30_000);

  it("una actualización sin fechas no borra las que ya había, y una con fechas las cambia", async () => {
    const store = createPostgresCourseStore(client);
    const { id } = await store.insertCourse(
      curso({ publishedAt: "2017-07-03T17:39:15.000Z", platformUpdatedAt: "2026-06-04" })
    );

    await store.updateCourse(id, curso());
    expect(await fechas(id)).toEqual({ publicado: "2017-07-03T17:39:15.000Z", actualizado: "2026-06-04" });

    await store.updateCourse(id, curso({ platformUpdatedAt: "2026-09-10" }));
    expect(await fechas(id)).toEqual({ publicado: "2017-07-03T17:39:15.000Z", actualizado: "2026-09-10" });
  }, 30_000);
});
