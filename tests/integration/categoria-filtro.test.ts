// @vitest-environment node
//
// HU-022. Los unitarios cubren el saneado del parámetro; esto comprueba la otra
// mitad: que la consulta filtre de verdad por categoría contra PostgREST.
//
// Misma excepción documentada que el resto de tests de búsqueda
// (.claude/rules/testing.md, HU-007): se siembran filas marcadas en dev y se
// consultan por el mismo camino que producción, borrándolas al terminar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchCourses } from "../../src/lib/courses/search-courses";
import { parseCourseSearchFilters } from "../../src/lib/courses/search-filters";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = databaseUrl && supabaseUrl && anonKey ? describe : describe.skip;

const MARKER = `zzz-hu022-${Date.now()}-`;

describeIfConfigured("HU-022 — filtro por categoría", () => {
  let pgClient: Client;
  let supabase: SupabaseClient;

  beforeAll(async () => {
    pgClient = new Client({ connectionString: databaseUrl });
    await pgClient.connect();
    supabase = createClient(supabaseUrl!, anonKey!);

    // Títulos en inglés a propósito: es justo lo que hacía inútil buscar la
    // etiqueta española como texto libre.
    await pgClient.query(
      `insert into courses (source, source_id, title, category, language)
       values
        ('udemy', $1, 'zzzhu022 Advanced TypeScript patterns', 'desarrollo', 'en'),
        ('udemy', $2, 'zzzhu022 Machine learning with Python', 'datos-e-ia', 'en'),
        ('coursera', $3, 'zzzhu022 Watercolour for beginners', 'diseno-y-creatividad', 'en')`,
      [`${MARKER}dev`, `${MARKER}ia`, `${MARKER}arte`]
    );
  });

  afterAll(async () => {
    await pgClient.query(`delete from courses where source_id like $1`, [`${MARKER}%`]);
    await pgClient.end();
  });

  // Los cursos sembrados no tienen valoración, así que el orden los manda al
  // final y no entran en el límite si se pide el catálogo entero. Se busca
  // siempre por un marcador del título para que el conjunto sea pequeño y el
  // test mida el filtro de categoría, no el tamaño de la página.
  const MARCA = "zzzhu022";

  function titulos(resultados: Array<{ title: string }>): string[] {
    return resultados.filter((c) => c.title.includes(MARCA)).map((c) => c.title);
  }

  it("devuelve solo los cursos de la categoría pedida", async () => {
    const filtros = parseCourseSearchFilters({ category: "datos-e-ia", keyword: MARCA });
    const todos = await searchCourses(supabase, filtros, 200);

    expect(titulos(todos)).toEqual(["zzzhu022 Machine learning with Python"]);
  }, 30_000);

  // El fallo original: la portada mandaba la etiqueta visible como palabra
  // clave, y ningún curso en inglés la contiene.
  it("buscar la etiqueta visible como texto no encuentra nada", async () => {
    const filtros = parseCourseSearchFilters({ keyword: "Datos e IA" });
    const todos = await searchCourses(supabase, filtros, 200);

    expect(titulos(todos)).toHaveLength(0);
  }, 30_000);

  it("una categoría inventada no filtra, en vez de vaciar la búsqueda", async () => {
    const filtros = parseCourseSearchFilters({ category: "no-existe", keyword: MARCA });
    const todos = await searchCourses(supabase, filtros, 200);

    expect(titulos(todos)).toHaveLength(3);
  }, 30_000);

  it("la categoría se combina con la palabra clave", async () => {
    const filtros = parseCourseSearchFilters({ category: "desarrollo", keyword: "TypeScript" });
    const todos = await searchCourses(supabase, filtros, 200);

    expect(titulos(todos)).toEqual(["zzzhu022 Advanced TypeScript patterns"]);
  }, 30_000);
});
