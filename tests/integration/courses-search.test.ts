// @vitest-environment node
//
// Excepción documentada en .claude/rules/testing.md (HU-007): la web lee vía
// Supabase JS + anon key (PostgREST), y el NAS solo tiene una instancia de
// Supabase sirviendo la base de dev — no existe una segunda instancia para
// gourses_test. Este test siembra filas marcadas en dev vía DATABASE_URL,
// consulta por el mismo camino que producción (supabase-js/anon, RLS real)
// y las borra siempre al terminar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchCourses } from "../../src/lib/courses/search-courses";
import { parseCourseSearchFilters } from "../../src/lib/courses/search-filters";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = databaseUrl && supabaseUrl && anonKey ? describe : describe.skip;

const MARKER = "zzz-hu007-test-";

describeIfConfigured("HU-007 — searchCourses", () => {
  let pgClient: Client;
  let supabase: SupabaseClient;

  beforeAll(async () => {
    pgClient = new Client({ connectionString: databaseUrl });
    await pgClient.connect();
    supabase = createClient(supabaseUrl!, anonKey!);

    await pgClient.query(
      `insert into courses
        (source, source_id, title, description, price_amount, price_currency, rating, language)
       values
        ('coursera', $1, 'Curso de prueba HU-007: introducción a Rust', 'aprende rust desde cero', 19.99, 'EUR', 4.5, 'en'),
        ('coursera', $2, 'Curso de prueba HU-007: cocina italiana', 'pasta y pizza', 99.99, 'EUR', 3.0, 'es'),
        ('coursera', $3, 'Curso de prueba HU-007: sin valoración ni precio', 'catálogo por suscripción', null, null, null, 'es')`,
      [`${MARKER}rust`, `${MARKER}cocina`, `${MARKER}sin-precio`]
    );
  });

  afterAll(async () => {
    await pgClient.query(`delete from courses where source_id like $1`, [`${MARKER}%`]);
    await pgClient.end();
  });

  it("filtra por palabra clave en título o descripción", async () => {
    const filters = parseCourseSearchFilters({ keyword: "rust" });
    const { resultados: results } = await searchCourses(supabase, filters, 100);
    const titles = results.map((r) => r.title);

    expect(titles).toContain("Curso de prueba HU-007: introducción a Rust");
    expect(titles).not.toContain("Curso de prueba HU-007: cocina italiana");
  });

  // Se acota por palabra clave, como el resto de tests de este fichero: sin
  // ella el resultado depende del tamaño del catálogo real (el orden es por
  // valoración y hay límite), no de la lógica de filtros que se quiere probar.
  it("combina palabra clave, precio máximo y valoración mínima con AND", async () => {
    const filters = parseCourseSearchFilters({
      keyword: "Curso de prueba HU-007",
      maxPrice: "50",
      minRating: "4",
    });
    const { resultados: results } = await searchCourses(supabase, filters, 100);

    expect(results.map((r) => r.title)).toEqual([
      "Curso de prueba HU-007: introducción a Rust",
    ]);
  });

  it("filtra por idioma", async () => {
    const filters = parseCourseSearchFilters({ keyword: "Curso de prueba HU-007", language: "es" });
    const { resultados: results } = await searchCourses(supabase, filters, 100);

    expect(results.map((r) => r.title).sort()).toEqual([
      "Curso de prueba HU-007: cocina italiana",
      "Curso de prueba HU-007: sin valoración ni precio",
    ]);
  });

  it("una búsqueda sin coincidencias devuelve una lista vacía, no un error", async () => {
    const filters = parseCourseSearchFilters({ keyword: "zzz-no-existe-ningun-curso-asi" });
    const { resultados: results } = await searchCourses(supabase, filters, 100);

    expect(results).toEqual([]);
  });
});
