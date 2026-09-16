// @vitest-environment node
//
// HU-067. Los unitarios fijan qué criterios se piden; lo que hay que comprobar
// contra la base es que el orden que sale sea de verdad ese: Udemy con los
// cursos respaldados por reseñas delante, y Coursera del más reciente al más
// antiguo. Se lee por el mismo camino que la web (supabase-js con la clave
// anon, RLS real).
//
// Solo lee: no siembra ni borra nada.
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { searchCourses, type CourseSearchResult } from "../../src/lib/courses/search-courses";
import { parseCourseSearchFilters } from "../../src/lib/courses/search-filters";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = databaseUrl && supabaseUrl && anonKey ? describe : describe.skip;

const RESENAS_MINIMAS = 50;

interface DatosCurso {
  num_reviews: number | null;
  publicado_en: string | null;
}

describeIfConfigured("HU-067 — orden por defecto de la portada y el buscador", () => {
  let supabase: SupabaseClient;
  let resultados: CourseSearchResult[];
  let datos: Map<string, DatosCurso>;

  beforeAll(async () => {
    supabase = createClient(supabaseUrl!, anonKey!);
    // Como la portada: sin filtros, sin orden pedido y sin idioma preferido.
    resultados = (await searchCourses(supabase, parseCourseSearchFilters({}), 40)).resultados;

    // Reseñas y fechas no viajan en el resultado de la búsqueda; se leen aparte
    // para poder comprobar el orden.
    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    try {
      const { rows } = await pg.query<DatosCurso & { id: string }>(
        `select id, num_reviews, publicado_en from courses where id = any($1)`,
        [resultados.map((c) => c.id)]
      );
      datos = new Map(rows.map((r) => [r.id, { num_reviews: r.num_reviews, publicado_en: r.publicado_en }]));
    } finally {
      await pg.end();
    }
  }, 30_000);

  const de = (source: string) => resultados.filter((c) => c.source === source).map((c) => datos.get(c.id)!);

  it("trae cursos de las dos plataformas, como antes", () => {
    expect(de("udemy").length).toBeGreaterThan(0);
    expect(de("coursera").length).toBeGreaterThan(0);
  });

  it("en Udemy, ninguno con pocas reseñas se cuela delante de uno respaldado", () => {
    const respaldados = de("udemy").map((c) => (c.num_reviews ?? 0) >= RESENAS_MINIMAS);
    expect(respaldados.some(Boolean)).toBe(true);
    // Una vez aparece el primero por debajo del umbral, ya no puede volver uno por encima.
    expect(respaldados.indexOf(false) === -1 || !respaldados.slice(respaldados.indexOf(false)).includes(true)).toBe(
      true
    );
  });

  it("los primeros de Udemy son cursos muy valorados y con muchas reseñas, no un 5,00 con once votos", () => {
    const primeros = de("udemy").slice(0, 5);
    for (const curso of primeros) {
      expect(curso.num_reviews ?? 0).toBeGreaterThanOrEqual(RESENAS_MINIMAS);
    }
  });

  it("en Coursera, que no publica valoración, van del más reciente al más antiguo", () => {
    const fechas = de("coursera").map((c) => c.publicado_en);
    const conFecha = fechas.filter((f): f is string => f !== null);
    // Los que no publican fecha, al final.
    expect(fechas.slice(0, conFecha.length).every((f) => f !== null)).toBe(true);
    for (let i = 1; i < conFecha.length; i++) {
      expect(Date.parse(conFecha[i - 1])).toBeGreaterThanOrEqual(Date.parse(conFecha[i]));
    }
  });

  it("el orden sigue siendo estable: dos páginas seguidas no repiten ningún curso", async () => {
    const [primera, segunda] = [
      await searchCourses(supabase, parseCourseSearchFilters({ pagina: "1" }), 10),
      await searchCourses(supabase, parseCourseSearchFilters({ pagina: "2" }), 10),
    ];
    const ids = new Set(primera.resultados.map((c) => c.id));
    expect(segunda.resultados.filter((c) => ids.has(c.id))).toEqual([]);
  }, 30_000);
});
