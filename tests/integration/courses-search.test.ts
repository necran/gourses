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
import { searchCourses, sinTildes } from "../../src/lib/courses/search-courses";
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
      // `publicado_en` en la fila de Rust: desde HU-067, Coursera se ordena por
      // fecha de publicación y los cursos sin ella van al final. Esta ficha es
      // anterior a que existieran las fechas (HU-059) y se quedaba detrás de
      // todos los cursos reales que coinciden con «rust», fuera de los 100
      // primeros. Todos los cursos reales de Coursera la traen, así que sin
      // fecha el dato de prueba no representaba a ninguno.
      `insert into courses
        (source, source_id, title, description, price_amount, price_currency, rating, language, publicado_en)
       values
        ('coursera', $1, 'Curso de prueba HU-007: introducción a Rust', 'aprende rust desde cero', 19.99, 'EUR', 4.5, 'en', now() - interval '1 day'),
        -- Las demás sin fecha a propósito: sus tests buscan por el marcador, así
        -- que coinciden pocas filas y el orden no las deja fuera. Y una de ellas
        -- sin fecha comprueba de paso que esos cursos siguen encontrándose.
        ('coursera', $2, 'Curso de prueba HU-007: cocina italiana', 'pasta y pizza', 99.99, 'EUR', 3.0, 'es', null),
        ('coursera', $3, 'Curso de prueba HU-007: sin valoración ni precio', 'catálogo por suscripción', null, null, null, 'es', null),
        ('coursera', $4, 'Curso de prueba HU-057: zq9 100% práctico', 'sin comodines', null, null, null, 'es', null),
        ('coursera', $5, 'Curso de prueba HU-057: 100 x práctico', 'la descripción menciona zq9 de pasada', null, null, null, 'es', null),
        ('coursera', $6, 'Curso de prueba "HU-059": Godot, nivel (2026) C:\\ruta', 'con signos', null, null, null, 'es', null),
        ('coursera', $7, 'Curso de prueba HU-061: Diseño y Programación zqx', 'con tildes', null, null, null, 'es', null),
        ('coursera', $8, 'Curso de prueba HU-061: Diseno sin tildes zqy', 'escrito sin tildes', null, null, null, 'es', null)`,
      [`${MARKER}rust`, `${MARKER}cocina`, `${MARKER}sin-precio`, `${MARKER}porcentaje`, `${MARKER}sin-porcentaje`, `${MARKER}signos`, `${MARKER}tildes`, `${MARKER}sin-tildes`]
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

  // HU-057. Por el mismo camino que producción (supabase-js → PostgREST): el
  // escapado tiene que sobrevivir al filtro .or() y llegar literal al ILIKE.
  it("un % en la palabra clave se busca como carácter, no como comodín", async () => {
    const filters = parseCourseSearchFilters({ keyword: "100% práctico" });
    const { resultados } = await searchCourses(supabase, filters, 100);
    const titles = resultados.map((r) => r.title);

    expect(titles).toContain("Curso de prueba HU-057: zq9 100% práctico");
    // Con el % como comodín, «100 x práctico» también coincidía.
    expect(titles).not.toContain("Curso de prueba HU-057: 100 x práctico");
  });

  it("una palabra clave de menos de tres caracteres se busca solo en el título", async () => {
    // «zq» está en el título de uno y solo en la descripción del otro.
    const filters = parseCourseSearchFilters({ keyword: "zq" });
    const { resultados } = await searchCourses(supabase, filters, 100);
    const titles = resultados.map((r) => r.title);

    expect(titles).toContain("Curso de prueba HU-057: zq9 100% práctico");
    expect(titles).not.toContain("Curso de prueba HU-057: 100 x práctico");
  });

  it("con tres caracteres o más se sigue buscando también en la descripción", async () => {
    const filters = parseCourseSearchFilters({ keyword: "zq9" });
    const { resultados } = await searchCourses(supabase, filters, 100);

    expect(resultados.map((r) => r.title).sort()).toEqual([
      "Curso de prueba HU-057: 100 x práctico",
      "Curso de prueba HU-057: zq9 100% práctico",
    ]);
  });

  // Descubierto el 2026-09-15: buscar un título con paréntesis daba 500 desde
  // HU-007. Por el mismo camino que producción, con los signos que el filtro
  // .or() de PostgREST trata como sintaxis: comilla, coma, paréntesis y barra.
  it("un título con comillas, coma, paréntesis y barra se encuentra buscándolo tal cual", async () => {
    const titulo = 'Curso de prueba "HU-059": Godot, nivel (2026) C:\\ruta';
    const { resultados } = await searchCourses(supabase, parseCourseSearchFilters({ keyword: titulo }), 100);

    expect(resultados.map((r) => r.title)).toEqual([titulo]);
  });

  it("también con el camino de solo título y con orden explícito", async () => {
    // «(2026)» tiene 4 números: va por título y descripción; «C:\» no llega a 3 letras.
    for (const params of [{ keyword: "(2026)", orden: "precio-asc" }, { keyword: "C:\\" }]) {
      const { resultados } = await searchCourses(supabase, parseCourseSearchFilters(params), 1000);
      expect(resultados.map((r) => r.title), JSON.stringify(params)).toContain(
        'Curso de prueba "HU-059": Godot, nivel (2026) C:\\ruta'
      );
    }
  });

  // HU-061. Por el mismo camino que la web.
  it("sin tildes encuentra lo escrito con tildes, y con tildes lo escrito sin ellas", async () => {
    const titulos = async (keyword: string) =>
      (await searchCourses(supabase, parseCourseSearchFilters({ keyword }), 1000)).resultados.map((r) => r.title);

    expect(await titulos("diseno y programacion zqx")).toContain("Curso de prueba HU-061: Diseño y Programación zqx");
    expect(await titulos("diseño sin tildes zqy")).toContain("Curso de prueba HU-061: Diseno sin tildes zqy");
  });

  it("la palabra clave se normaliza en TypeScript igual que unaccent en la base", async () => {
    const palabras = ["Programación", "DISEÑO", "pingüino", "Ñandú", "café", "naïve", "œuvre", "Fotografía", "Inglés", "informática", "100% C#"];
    const { rows } = await pgClient.query(
      "select unnest($1::text[]) as original, extensions.sin_tildes(unnest($1::text[])) as base",
      [palabras]
    );
    for (const { original, base } of rows) {
      expect(sinTildes(original), original).toBe(base);
    }
  });

  it("una búsqueda sin coincidencias devuelve una lista vacía, no un error", async () => {
    const filters = parseCourseSearchFilters({ keyword: "zzz-no-existe-ningun-curso-asi" });
    const { resultados: results } = await searchCourses(supabase, filters, 100);

    expect(results).toEqual([]);
  });
});
