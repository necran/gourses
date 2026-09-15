// @vitest-environment node
//
// HU-058. Dos cosas contra Postgres de verdad:
//
// 1. Que la ingesta escribe los temas al guardar un curso y los recalcula si el
//    título cambia. Contra la base de test, con el mismo CourseStore que usan los
//    jobs.
// 2. Que la lectura de un tema, por el mismo camino que la web (supabase-js con
//    la clave anon, RLS real), devuelve solo sus cursos en español, de más a menos
//    reseñados, y cuenta bien los de todos los idiomas. Como en HU-007, se
//    siembran filas marcadas en la base de desarrollo —la única que sirve
//    PostgREST en el NAS— y se borran siempre al terminar.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createPostgresCourseStore } from "../../src/lib/ingesta/postgres-course-store";
import type { NormalizedCourse } from "../../src/lib/courses/schema";
import { contarCursosDeTema, leerCursosDeTema } from "../../src/lib/courses/temas-datos";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function curso(overrides: Partial<NormalizedCourse> = {}): NormalizedCourse {
  return {
    source: "udemy",
    sourceId: "hu058-1",
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

(testDatabaseUrl ? describe : describe.skip)("HU-058 — la ingesta guarda los temas", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();
  });

  afterEach(async () => {
    await client.query("delete from courses");
  });

  afterAll(async () => {
    await client.end();
  });

  it("al insertar un curso escribe los temas de su título", async () => {
    const store = createPostgresCourseStore(client);
    const { id } = await store.insertCourse(curso({ title: "Trading con Python y MetaTrader 5" }));

    const { rows } = await client.query("select temas from courses where id = $1", [id]);
    expect(rows[0].temas).toEqual(["python", "trading"]);
  }, 30_000);

  it("al actualizar recalcula los temas si cambia el título, y un curso sin tema queda vacío", async () => {
    const store = createPostgresCourseStore(client);
    const { id } = await store.insertCourse(curso({ title: "Excel desde cero" }));

    await store.updateCourse(id, curso({ title: "Cocina italiana tradicional" }));

    const { rows } = await client.query("select temas from courses where id = $1", [id]);
    expect(rows[0].temas).toEqual([]);
  }, 30_000);
});

const MARCA = "zzz-hu058-test-";

(databaseUrl && supabaseUrl && anonKey ? describe : describe.skip)(
  "HU-058 — la web lee los cursos de un tema",
  () => {
    let pgClient: Client;
    let supabase: SupabaseClient;

    beforeAll(async () => {
      pgClient = new Client({ connectionString: databaseUrl });
      await pgClient.connect();
      supabase = createClient(supabaseUrl!, anonKey!);

      // Un tema de la lista que no existe en el catálogo real con estos títulos:
      // se siembran con el array ya calculado, como lo dejaría la ingesta.
      await pgClient.query(
        `insert into courses (source, source_id, title, language, num_reviews, temas)
         values
           ('udemy', $1, 'Guitarra HU-058 pocas reseñas', 'es', 5, '{guitarra}'),
           ('udemy', $2, 'Guitarra HU-058 muchas reseñas', 'es', 900, '{guitarra}'),
           ('udemy', $3, 'Guitar HU-058 in English', 'en', 5000, '{guitarra}'),
           ('udemy', $4, 'Sin tema HU-058', 'es', 10000, '{}')`,
        [`${MARCA}pocas`, `${MARCA}muchas`, `${MARCA}ingles`, `${MARCA}sin-tema`]
      );
    });

    afterAll(async () => {
      await pgClient.query("delete from courses where source_id like $1", [`${MARCA}%`]);
      await pgClient.end();
    });

    it("devuelve solo los cursos en español del tema, de más a menos reseñados", async () => {
      const cursos = await leerCursosDeTema(supabase, "guitarra");
      const sembrados = cursos.filter((c) => c.title.includes("HU-058"));

      expect(sembrados.map((c) => c.title)).toEqual([
        "Guitarra HU-058 muchas reseñas",
        "Guitarra HU-058 pocas reseñas",
      ]);
      expect(cursos.every((c) => c.language === "es")).toBe(true);
    }, 30_000);

    it("cuenta los cursos del tema en todos los idiomas", async () => {
      const { rows } = await pgClient.query(
        "select count(*) n from courses where temas @> '{guitarra}'"
      );
      expect(await contarCursosDeTema(supabase, "guitarra")).toBe(Number(rows[0].n));
    }, 30_000);
  }
);
