// @vitest-environment node
//
// HU-027. El orden lo pone Postgres, así que lo que hay que comprobar contra la
// base es que lo ponga como se le pide: ordenado de verdad, con los cursos sin
// el dato al final, y sin romperse en la costura entre dos páginas.
//
// Solo lee del catálogo real: no siembra ni borra nada.
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchCourses, type CourseSearchResult } from "../../src/lib/courses/search-courses";
import { parseCourseSearchFilters } from "../../src/lib/courses/search-filters";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = supabaseUrl && anonKey ? describe : describe.skip;

const POR_PAGINA = 20;

// Comprueba que una lista no rompe el orden pedido. Los nulos solo pueden
// aparecer después del último valor, nunca entre medias.
function vaOrdenada(
  valores: Array<number | null>,
  comparar: (anterior: number, actual: number) => boolean
): boolean {
  let ultimo: number | null = null;
  let yaHuboNulo = false;

  for (const valor of valores) {
    if (valor === null) {
      yaHuboNulo = true;
      continue;
    }
    if (yaHuboNulo) return false;
    if (ultimo !== null && !comparar(ultimo, valor)) return false;
    ultimo = valor;
  }
  return true;
}

describeIfConfigured("HU-027 — ordenar los resultados", () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(supabaseUrl!, anonKey!);
  });

  async function buscar(params: Record<string, string>): Promise<CourseSearchResult[]> {
    const { resultados } = await searchCourses(
      supabase,
      parseCourseSearchFilters(params),
      POR_PAGINA
    );
    return resultados;
  }

  it("por precio, de menor a mayor", async () => {
    const resultados = await buscar({ orden: "precio-asc" });

    expect(resultados).toHaveLength(POR_PAGINA);
    expect(vaOrdenada(resultados.map((c) => c.priceAmount), (a, b) => a <= b)).toBe(true);
  }, 30_000);

  it("por valoración, de mayor a menor", async () => {
    const resultados = await buscar({ orden: "valoracion-desc" });

    expect(resultados).toHaveLength(POR_PAGINA);
    expect(vaOrdenada(resultados.map((c) => c.rating), (a, b) => a >= b)).toBe(true);
  }, 30_000);

  // Un hueco no es un cero: los cursos sin precio no pueden colarse como los
  // más baratos. Es la misma regla del filtro (HU-026) y del comparador.
  it("los cursos sin precio no salen los primeros al ordenar por precio", async () => {
    const resultados = await buscar({ orden: "precio-asc" });

    expect(resultados[0].priceAmount).not.toBeNull();
  }, 30_000);

  // La costura es donde falla siempre: cada página puede estar ordenada por
  // dentro y aun así el primero de la segunda ser más barato que el último de
  // la primera.
  it("el orden aguanta entre el final de una página y el principio de la siguiente", async () => {
    const primera = await buscar({ orden: "precio-asc" });
    const segunda = await buscar({ orden: "precio-asc", pagina: "2" });

    const juntas = [...primera, ...segunda];
    expect(vaOrdenada(juntas.map((c) => c.priceAmount), (a, b) => a <= b)).toBe(true);

    // Y de paso: dos páginas seguidas no comparten cursos.
    const ids = new Set(primera.map((c) => c.id));
    expect(segunda.filter((c) => ids.has(c.id))).toEqual([]);
  }, 30_000);

  it("el orden se combina con los filtros, no los sustituye", async () => {
    const resultados = await buscar({ orden: "precio-asc", maxPrice: "15", keyword: "python" });

    expect(resultados.length).toBeGreaterThan(0);
    for (const curso of resultados) {
      expect(curso.priceAmount).not.toBeNull();
      expect(curso.priceAmount!).toBeLessThanOrEqual(15);
      expect(`${curso.title} ${curso.description ?? ""}`.toLowerCase()).toContain("python");
    }
    expect(vaOrdenada(resultados.map((c) => c.priceAmount), (a, b) => a <= b)).toBe(true);
  }, 30_000);

  // Lo que no puede romper esta historia: sin orden pedido, el reparto
  // equilibrado de HU-007 sigue funcionando igual.
  it("sin orden pedido siguen apareciendo las dos plataformas", async () => {
    const resultados = await buscar({});
    const fuentes = new Set(resultados.map((c) => c.source));

    expect([...fuentes].sort()).toEqual(["coursera", "udemy"]);
  }, 30_000);

  it("un orden inventado cae en el de por defecto, con las dos plataformas", async () => {
    const resultados = await buscar({ orden: "lo-que-sea" });
    const fuentes = new Set(resultados.map((c) => c.source));

    expect([...fuentes].sort()).toEqual(["coursera", "udemy"]);
  }, 30_000);
});
