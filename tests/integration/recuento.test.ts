// @vitest-environment node
//
// HU-028. Lo que hay que comprobar contra la base: que el total sea el de la
// búsqueda —no el catálogo entero, no el tamaño de la página— y que no cambie
// al pasar de página. Se prueba en los dos caminos de consulta (HU-025 y
// HU-027), porque cada uno lo calcula de una forma distinta: uno sumando el
// count de cada fuente, el otro con un único count de PostgREST.
//
// Solo lee del catálogo real: no siembra ni borra nada.
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchCourses } from "../../src/lib/courses/search-courses";
import { parseCourseSearchFilters } from "../../src/lib/courses/search-filters";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = supabaseUrl && anonKey ? describe : describe.skip;

describeIfConfigured("HU-028 — cuántos resultados hay", () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(supabaseUrl!, anonKey!);
  });

  it("el total es mayor que lo que cabe en una página, con el catálogo real", async () => {
    const { resultados, total } = await searchCourses(
      supabase,
      parseCourseSearchFilters({}),
      20
    );

    expect(resultados).toHaveLength(20);
    expect(total).toBeGreaterThan(20);
  }, 30_000);

  it("un filtro reduce el total por debajo del catálogo entero", async () => {
    const { total: conFiltro } = await searchCourses(
      supabase,
      parseCourseSearchFilters({ keyword: "python" }),
      20
    );
    const { total: sinFiltro } = await searchCourses(
      supabase,
      parseCourseSearchFilters({}),
      20
    );

    expect(conFiltro).toBeGreaterThan(0);
    expect(conFiltro).toBeLessThan(sinFiltro);
  }, 30_000);

  it("una búsqueda sin coincidencias da total cero", async () => {
    const { total } = await searchCourses(
      supabase,
      parseCourseSearchFilters({ keyword: "zzz-no-existe-ningun-curso-asi" }),
      20
    );

    expect(total).toBe(0);
  }, 30_000);

  it("el total no cambia al pasar de página, sin orden pedido", async () => {
    const { total: primera } = await searchCourses(
      supabase,
      parseCourseSearchFilters({}),
      20
    );
    const { total: segunda } = await searchCourses(
      supabase,
      parseCourseSearchFilters({ pagina: "2" }),
      20
    );

    expect(segunda).toBe(primera);
  }, 30_000);

  // El camino con orden calcula el total de otra forma (un solo count de
  // PostgREST, no una suma): tiene que dar el mismo número que el camino
  // sin orden para la misma búsqueda.
  it("el total no cambia al pasar de página, con un orden pedido", async () => {
    const { total: primera } = await searchCourses(
      supabase,
      parseCourseSearchFilters({ orden: "precio-asc" }),
      20
    );
    const { total: segunda } = await searchCourses(
      supabase,
      parseCourseSearchFilters({ orden: "precio-asc", pagina: "2" }),
      20
    );

    expect(segunda).toBe(primera);
  }, 30_000);

  it("los dos caminos de consulta cuentan lo mismo para la misma búsqueda", async () => {
    const { total: sinOrden } = await searchCourses(
      supabase,
      parseCourseSearchFilters({ keyword: "python" }),
      20
    );
    const { total: conOrden } = await searchCourses(
      supabase,
      parseCourseSearchFilters({ keyword: "python", orden: "precio-asc" }),
      20
    );

    expect(conOrden).toBe(sinOrden);
  }, 30_000);
});
