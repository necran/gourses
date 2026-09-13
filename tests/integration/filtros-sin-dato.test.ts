// @vitest-environment node
//
// HU-026. Lo que se prueba aquí no se puede probar con dobles: que el filtro
// `.or(...is.null)` de PostgREST devuelva de verdad los cursos sin el dato, y
// que sin él sigan quedando fuera. La lógica es de la base, no nuestra.
//
// Solo lee del catálogo real: no siembra ni borra nada.
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchCourses } from "../../src/lib/courses/search-courses";
import { parseCourseSearchFilters } from "../../src/lib/courses/search-filters";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const describeIfConfigured = supabaseUrl && anonKey ? describe : describe.skip;

describeIfConfigured("HU-026 — filtros que excluyen por falta de dato", () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = createClient(supabaseUrl!, anonKey!);
  });

  async function buscar(params: Record<string, string>) {
    const { resultados } = await searchCourses(supabase, parseCourseSearchFilters(params), 60);
    return resultados;
  }

  // El fallo que motiva la historia, escrito como test: con precio máximo,
  // Coursera desaparece entera.
  it("con precio máximo y sin pedir nada más, no sale ni un curso de Coursera", async () => {
    const resultados = await buscar({ maxPrice: "20" });

    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados.filter((c) => c.source === "coursera")).toEqual([]);
  }, 30_000);

  it("pidiendo incluir los que no publican precio, Coursera vuelve", async () => {
    const resultados = await buscar({ maxPrice: "20", sinDato: "1" });

    expect(resultados.filter((c) => c.source === "coursera").length).toBeGreaterThan(0);
  }, 30_000);

  // Incluir los que no tienen dato no puede convertirse en «no filtrar»: los
  // que sí tienen precio siguen teniendo que cumplirlo.
  it("los que sí publican precio siguen respetando el máximo", async () => {
    const resultados = await buscar({ maxPrice: "20", sinDato: "1" });
    const conPrecio = resultados.filter((c) => c.priceAmount !== null);

    expect(conPrecio.length).toBeGreaterThan(0);
    expect(conPrecio.every((c) => c.priceAmount! <= 20)).toBe(true);
  }, 30_000);

  it("con valoración mínima pasa lo mismo, porque Coursera tampoco la publica", async () => {
    const sin = await buscar({ minRating: "4" });
    const con = await buscar({ minRating: "4", sinDato: "1" });

    expect(sin.filter((c) => c.source === "coursera")).toEqual([]);
    expect(con.filter((c) => c.source === "coursera").length).toBeGreaterThan(0);
  }, 30_000);

  it("los que sí tienen valoración siguen respetando el mínimo", async () => {
    const resultados = await buscar({ minRating: "4", sinDato: "1" });
    const conValoracion = resultados.filter((c) => c.rating !== null);

    expect(conValoracion.length).toBeGreaterThan(0);
    expect(conValoracion.every((c) => c.rating! >= 4)).toBe(true);
  }, 30_000);

  // Los dos filtros a la vez: el .or() se añade dos veces y PostgREST tiene que
  // combinarlos con Y, no con O. Si los combinara con O, pedir «menos de 20 € y
  // más de 4 estrellas» devolvería cosas que no cumplen ninguna de las dos.
  it("precio y valoración a la vez se exigen los dos, no uno u otro", async () => {
    const resultados = await buscar({ maxPrice: "20", minRating: "4", sinDato: "1" });

    expect(resultados.length).toBeGreaterThan(0);
    for (const curso of resultados) {
      expect(curso.priceAmount === null || curso.priceAmount <= 20).toBe(true);
      expect(curso.rating === null || curso.rating >= 4).toBe(true);
    }
  }, 30_000);

  // HU-048. La duración se comporta igual que el precio, con una diferencia:
  // filtra por el **máximo** del rango, así que un curso de «1 h–20 h» no
  // cumple un techo de 2 horas aunque su extremo bajo sí.
  it("con duración máxima quedan fuera los que no la publican", async () => {
    const resultados = await buscar({ maxDuration: "2" });

    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados.every((c) => c.duration !== null)).toBe(true);
  }, 30_000);

  it("pidiendo incluirlos, vuelven los cursos sin duración publicada", async () => {
    const resultados = await buscar({ maxDuration: "2", sinDato: "1" });

    expect(resultados.filter((c) => c.duration === null).length).toBeGreaterThan(0);
  }, 30_000);

  it("los que sí publican duración respetan el techo, por su extremo alto", async () => {
    const resultados = await buscar({ maxDuration: "2", sinDato: "1" });
    const conDuracion = resultados.filter((c) => c.duration !== null);

    expect(conDuracion.length).toBeGreaterThan(0);
    expect(conDuracion.every((c) => c.duration!.maxMinutes <= 120)).toBe(true);
  }, 30_000);

  // La palabra clave usa su propio .or(); añadir el de precio no puede
  // convertir el filtro de texto en opcional.
  it("la palabra clave se sigue exigiendo junto al precio", async () => {
    const resultados = await buscar({ keyword: "python", maxPrice: "20", sinDato: "1" });

    expect(resultados.length).toBeGreaterThan(0);
    for (const curso of resultados) {
      const texto = `${curso.title} ${curso.description ?? ""}`.toLowerCase();
      expect(texto).toContain("python");
    }
  }, 30_000);
});
