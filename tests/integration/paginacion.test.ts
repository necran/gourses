// @vitest-environment node
//
// HU-025. Lo que se prueba aquí es lo que los unitarios no pueden ver: que el
// **orden que devuelve Postgres** sea estable entre dos consultas seguidas.
//
// Es el fallo clásico de paginar: si el criterio de orden no distingue una fila
// de otra, la base de datos puede devolverlas en distinto orden cada vez, y la
// página 2 repite cursos de la 1 y se salta otros. Aquí hay 4.000 cursos de
// Coursera sin valoración y con la misma fecha de ingesta, así que el caso no
// es teórico: sin el desempate por `id` esto falla.
//
// Solo lee: no siembra ni borra nada del catálogo.
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchCourses } from "../../src/lib/courses/search-courses";
import { parseCourseSearchFilters } from "../../src/lib/courses/search-filters";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = supabaseUrl && anonKey ? describe : describe.skip;

const POR_PAGINA = 10;

describeIfConfigured("HU-025 — paginación del buscador", () => {
  // El cliente se crea en `beforeAll` y no aquí: la suite unitaria también
  // carga este fichero, donde no hay credenciales, y `describe.skip` salta los
  // tests pero **no** evita que se ejecute el cuerpo del bloque.
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(supabaseUrl!, anonKey!);
  });

  async function paginaDe(n: number) {
    return searchCourses(supabase, parseCourseSearchFilters({ pagina: String(n) }), POR_PAGINA);
  }

  it("dos páginas seguidas no comparten ningún curso", async () => {
    const [primera, segunda] = await Promise.all([paginaDe(1), paginaDe(2)]);

    expect(primera.resultados).toHaveLength(POR_PAGINA);
    expect(segunda.resultados).toHaveLength(POR_PAGINA);

    const idsPrimera = new Set(primera.resultados.map((c) => c.id));
    const repetidos = segunda.resultados.filter((c) => idsPrimera.has(c.id));

    expect(repetidos.map((c) => c.title)).toEqual([]);
  }, 30_000);

  it("recorrer cinco páginas no repite ni un curso", async () => {
    const vistos: string[] = [];
    for (let p = 1; p <= 5; p += 1) {
      const { resultados } = await paginaDe(p);
      vistos.push(...resultados.map((c) => c.id));
    }

    expect(new Set(vistos).size).toBe(vistos.length);
    expect(vistos).toHaveLength(5 * POR_PAGINA);
  }, 60_000);

  // El motivo por el que existe `interleaveBySource` no caduca en la página 1.
  it("sigue habiendo las dos plataformas en una página profunda", async () => {
    const { resultados } = await paginaDe(5);
    const fuentes = new Set(resultados.map((c) => c.source));

    expect([...fuentes].sort()).toEqual(["coursera", "udemy"]);
  }, 30_000);

  it("pedir la misma página dos veces devuelve lo mismo", async () => {
    const [una, otra] = await Promise.all([paginaDe(3), paginaDe(3)]);

    expect(una.resultados.map((c) => c.id)).toEqual(otra.resultados.map((c) => c.id));
  }, 30_000);

  it("con catálogo de sobra, la primera página dice que hay más", async () => {
    expect((await paginaDe(1)).hayMas).toBe(true);
  }, 30_000);
});
