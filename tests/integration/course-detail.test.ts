// @vitest-environment node
//
// Misma excepción documentada que en HU-007 (ver .claude/rules/testing.md): la
// web lee vía Supabase JS + anon key y el NAS solo tiene una instancia de
// PostgREST, sirviendo la base de dev. Se siembran filas marcadas, se consulta
// por el mismo camino que producción (RLS real) y se borran al terminar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCourseById } from "../../src/lib/courses/get-course";
import { resolvePriceDisplay } from "../../src/lib/courses/price-display";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = databaseUrl && supabaseUrl && anonKey ? describe : describe.skip;

const MARKER = "zzz-hu008-test-";

describeIfConfigured("HU-008 — ficha de curso", () => {
  let pgClient: Client;
  let supabase: SupabaseClient;
  let conBajada: string;
  let sinPrecio: string;

  beforeAll(async () => {
    pgClient = new Client({ connectionString: databaseUrl });
    await pgClient.connect();
    supabase = createClient(supabaseUrl!, anonKey!);

    const { rows } = await pgClient.query(
      `insert into courses
        (source, source_id, title, description, price_amount, price_currency, rating, level, language, instructor, affiliate_url, image_url)
       values
        ('udemy', $1, 'Curso HU-008 con bajada de precio', 'Descripción completa del curso', 19.99, 'EUR', 4.7, 'Beginner', 'es', 'Instructora Ejemplo', 'https://www.udemy.com/course/hu008/', 'https://img.example.com/a.jpg'),
        ('coursera', $2, 'Curso HU-008 sin precio', 'Curso por suscripción', null, null, null, null, 'en', null, 'https://www.coursera.org/learn/hu008', null)
       returning id, source_id`,
      [`${MARKER}bajada`, `${MARKER}sin-precio`]
    );

    conBajada = rows.find((r) => r.source_id === `${MARKER}bajada`)!.id;
    sinPrecio = rows.find((r) => r.source_id === `${MARKER}sin-precio`)!.id;

    // Histórico: primero 29.99 y después 19.99, es decir, una bajada real.
    await pgClient.query(
      `insert into course_price_history (course_id, price_amount, price_currency, captured_at)
       values ($1, 29.99, 'EUR', now() - interval '7 days'),
              ($1, 19.99, 'EUR', now())`,
      [conBajada]
    );
  });

  afterAll(async () => {
    await pgClient.query(`delete from courses where source_id like $1`, [`${MARKER}%`]);
    await pgClient.end();
  });

  it("devuelve los datos completos del curso y su histórico de precio", async () => {
    const course = await getCourseById(supabase, conBajada);

    expect(course).not.toBeNull();
    expect(course).toMatchObject({
      id: conBajada,
      source: "udemy",
      title: "Curso HU-008 con bajada de precio",
      description: "Descripción completa del curso",
      priceAmount: 19.99,
      priceCurrency: "EUR",
      rating: 4.7,
      level: "Beginner",
      language: "es",
      instructor: "Instructora Ejemplo",
      affiliateUrl: "https://www.udemy.com/course/hu008/",
      imageUrl: "https://img.example.com/a.jpg",
    });
    expect(course!.priceHistory).toHaveLength(2);
  });

  it("el histórico permite detectar la bajada y mostrar el precio anterior", async () => {
    const course = await getCourseById(supabase, conBajada);
    const price = resolvePriceDisplay(
      course!.priceAmount,
      course!.priceCurrency,
      course!.priceHistory
    );

    expect(price).toEqual({ amount: 19.99, currency: "EUR", previousAmount: 29.99 });
  });

  it("devuelve un curso sin precio sin romper, como los de Coursera", async () => {
    const course = await getCourseById(supabase, sinPrecio);

    expect(course).not.toBeNull();
    expect(course!.priceAmount).toBeNull();
    expect(course!.priceHistory).toEqual([]);
    expect(
      resolvePriceDisplay(course!.priceAmount, course!.priceCurrency, course!.priceHistory)
        .previousAmount
    ).toBeNull();
  });

  it("devuelve null para un id con forma válida que no existe", async () => {
    expect(await getCourseById(supabase, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("devuelve null sin consultar para un id con forma inválida", async () => {
    for (const id of ["no-soy-un-uuid", "' or 1=1 --", "*", ""]) {
      expect(await getCourseById(supabase, id)).toBeNull();
    }
  });
});
