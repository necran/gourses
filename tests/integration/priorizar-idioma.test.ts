// @vitest-environment node
//
// Misma excepción documentada en HU-007 (ver .claude/rules/testing.md): se
// siembran filas marcadas en dev, se consulta por el mismo camino que
// producción (supabase-js/anon, RLS real) y se borran al terminar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchCourses } from "../../src/lib/courses/search-courses";
import { parseCourseSearchFilters } from "../../src/lib/courses/search-filters";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = databaseUrl && supabaseUrl && anonKey ? describe : describe.skip;

const MARKER = "zzz-hu032-test-";
const KEYWORD = "Curso de prueba HU-032";

describeIfConfigured("HU-032 — priorizar el idioma del visitante", () => {
  let pgClient: Client;
  let supabase: SupabaseClient;

  beforeAll(async () => {
    pgClient = new Client({ connectionString: databaseUrl });
    await pgClient.connect();
    supabase = createClient(supabaseUrl!, anonKey!);

    // Todos con la misma valoración a propósito: si el idioma no se
    // priorizara, PostgREST devolvería el empate en el orden que sea, y el
    // test no podría distinguir "prioriza de verdad" de "coincidencia".
    await pgClient.query(
      `insert into courses
        (source, source_id, title, description, price_amount, price_currency, rating, language)
       values
        ('udemy', $1, '${KEYWORD}: inglés A', 'x', 10, 'EUR', 4.0, 'en'),
        ('udemy', $2, '${KEYWORD}: español A', 'x', 10, 'EUR', 4.0, 'es'),
        ('udemy', $3, '${KEYWORD}: inglés B', 'x', 10, 'EUR', 4.0, 'en'),
        ('udemy', $4, '${KEYWORD}: español B', 'x', 10, 'EUR', 4.0, 'es')`,
      [`${MARKER}en-a`, `${MARKER}es-a`, `${MARKER}en-b`, `${MARKER}es-b`]
    );
  });

  afterAll(async () => {
    await pgClient.query(`delete from courses where source_id like $1`, [`${MARKER}%`]);
    await pgClient.end();
  });

  it("en la página 1, los cursos del idioma preferido aparecen antes, sin desaparecer los demás", async () => {
    const filters = parseCourseSearchFilters({ keyword: KEYWORD });
    const { resultados } = await searchCourses(supabase, filters, 100, "es");

    const idiomas = resultados.map((r) => r.language);
    const primerNoEs = idiomas.indexOf("en");
    const ultimoEs = idiomas.lastIndexOf("es");

    // Los dos "es" van antes que cualquier "en" — no es que estén mezclados.
    expect(ultimoEs).toBeLessThan(primerNoEs);
    expect(resultados).toHaveLength(4);
  });

  it("sin idioma preferido, no reordena por idioma", async () => {
    const filters = parseCourseSearchFilters({ keyword: KEYWORD });
    const { resultados } = await searchCourses(supabase, filters, 100, null);

    expect(resultados).toHaveLength(4);
    // No hay ninguna garantía de que los "es" vayan agrupados sin priorizar.
  });

  // El caso que HU-025 exige que nunca pase, ahora con un idioma preferido de
  // por medio: la ventana que se prioriza crece con la página, así que si se
  // priorizara también en la página 2, un curso podría colarse por delante de
  // otro que la página 1 ya había mostrado (repetido) o quedarse sin mostrar
  // (saltado). Por eso searchCourses solo prioriza en la página 1.
  it("con idioma preferido, la página 2 no repite ni se salta cursos de la página 1", async () => {
    const filters1 = parseCourseSearchFilters({ keyword: KEYWORD, pagina: "1" });
    const filters2 = parseCourseSearchFilters({ keyword: KEYWORD, pagina: "2" });

    const pagina1 = await searchCourses(supabase, filters1, 2, "es");
    const pagina2 = await searchCourses(supabase, filters2, 2, "es");

    const idsPagina1 = pagina1.resultados.map((r) => r.id);
    const idsPagina2 = pagina2.resultados.map((r) => r.id);

    expect(new Set(idsPagina1).size).toBe(idsPagina1.length);
    expect(idsPagina1.filter((id) => idsPagina2.includes(id))).toEqual([]);
    expect([...idsPagina1, ...idsPagina2].sort()).toEqual(
      [...idsPagina1, ...idsPagina2].filter((v, i, a) => a.indexOf(v) === i).sort()
    );
  });
});

// El fallo real que se coló en la primera versión: reordenar por idioma
// **antes** de intercalar podía colar en la página 1 el curso de más que
// solo se trae para saber si hay página siguiente (nunca se muestra),
// simplemente porque era del idioma preferido — y entonces el que de verdad
// tocaba en esa página se quedaba fuera para siempre, porque la página 2
// sigue desde el corte real, sin idioma de por medio. Se reproduce aquí a
// propósito: cuatro cursos de sobra en el idioma que no se prefiere, y uno
// del idioma preferido pero con la peor valoración — justo el que debería
// quedar como "el de más" de la página 1, nunca dentro de ella.
describeIfConfigured("HU-032 — el curso 'de más' nunca se cuela en la página 1", () => {
  let pgClient: Client;
  let supabase: SupabaseClient;
  const MARKER2 = "zzz-hu032-seam-";
  const KEYWORD2 = "Curso de prueba HU-032-seam";

  beforeAll(async () => {
    pgClient = new Client({ connectionString: databaseUrl });
    await pgClient.connect();
    supabase = createClient(supabaseUrl!, anonKey!);

    await pgClient.query(
      `insert into courses
        (source, source_id, title, description, price_amount, price_currency, rating, language)
       values
        ('udemy', $1, '${KEYWORD2} en 1', 'x', 10, 'EUR', 5.0, 'en'),
        ('udemy', $2, '${KEYWORD2} en 2', 'x', 10, 'EUR', 5.0, 'en'),
        ('udemy', $3, '${KEYWORD2} en 3', 'x', 10, 'EUR', 5.0, 'en'),
        ('udemy', $4, '${KEYWORD2} en 4', 'x', 10, 'EUR', 5.0, 'en'),
        ('udemy', $5, '${KEYWORD2} es peor', 'x', 10, 'EUR', 1.0, 'es')`,
      [
        `${MARKER2}en1`,
        `${MARKER2}en2`,
        `${MARKER2}en3`,
        `${MARKER2}en4`,
        `${MARKER2}es-peor`,
      ]
    );
  });

  afterAll(async () => {
    await pgClient.query(`delete from courses where source_id like $1`, [`${MARKER2}%`]);
    await pgClient.end();
  });

  it("la página 1 son los 4 mejor valorados, no el 'es' peor valorado colado por delante", async () => {
    const filters = parseCourseSearchFilters({ keyword: KEYWORD2, pagina: "1" });
    const { resultados } = await searchCourses(supabase, filters, 4, "es");

    expect(resultados.map((r) => r.language).sort()).toEqual(["en", "en", "en", "en"]);
  });

  it("y el 'es' peor valorado aparece en la página 2, no se pierde", async () => {
    const filters = parseCourseSearchFilters({ keyword: KEYWORD2, pagina: "2" });
    const { resultados } = await searchCourses(supabase, filters, 4, "es");

    expect(resultados.map((r) => r.language)).toEqual(["es"]);
  });
});
