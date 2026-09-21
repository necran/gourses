import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getCatalogSummary } from "./catalog-summary";
import { COURSE_SOURCES } from "./schema";
import { getCourseById } from "./get-course";

// HU-072. Cada consulta a Supabase desde una función de Netlify es un viaje de ida y
// vuelta Virginia-Irlanda, y las consultas en sí duran menos de 6 ms dentro de la
// base: lo que hacía lenta una página era encadenar viajes que no dependían uno de
// otro. Estos tests fijan que las lecturas que no dependen unas de otras se piden
// **a la vez**, sin medir tiempos (que serían intermitentes): con un cliente falso
// en el que ninguna consulta responde hasta que el test lo decide, se comprueba que
// todas están ya en marcha antes de que responda la primera.

interface Pendiente {
  tabla: string;
  filtro: unknown;
  resolver: () => void;
}

function clienteFalso(respuesta: (tabla: string, filtro: unknown) => unknown) {
  const pendientes: Pendiente[] = [];

  const constructor = (tabla: string) => {
    let filtro: unknown = null;
    const b = {
      select: () => b,
      eq: (_columna: string, valor: unknown) => {
        filtro = valor;
        return b;
      },
      order: () => b,
      maybeSingle: () => b,
      // Como los constructores de consultas de supabase-js: se «esperan» con then.
      then: (ok: (v: unknown) => void) => {
        pendientes.push({ tabla, filtro, resolver: () => ok(respuesta(tabla, filtro)) });
      },
    };
    return b;
  };

  return { client: { from: constructor } as unknown as SupabaseClient, pendientes };
}

// Deja correr los microtareas pendientes: lo que se haya pedido «a la vez» ya está en
// `pendientes`, y lo que se pida después de esperar una respuesta, no.
const dejarCorrer = () => new Promise((r) => setTimeout(r, 0));

describe("getCatalogSummary pide sus recuentos a la vez (HU-072)", () => {
  it("el total y el de cada fuente están en marcha antes de que responda ninguno", async () => {
    const { client, pendientes } = clienteFalso(() => ({ count: 10, error: null }));

    const resumen = getCatalogSummary(client);
    await dejarCorrer();

    expect(pendientes).toHaveLength(1 + COURSE_SOURCES.length);

    pendientes.forEach((p) => p.resolver());
    expect(await resumen).toEqual({ courseCount: 10, sourceCount: COURSE_SOURCES.length });
  });

  it("solo cuenta como plataforma la que aporta cursos", async () => {
    const [primera] = COURSE_SOURCES;
    const { client, pendientes } = clienteFalso((_t, filtro) => ({
      count: filtro === primera ? 40 : filtro === null ? 40 : 0,
      error: null,
    }));

    const resumen = getCatalogSummary(client);
    await dejarCorrer();
    pendientes.forEach((p) => p.resolver());

    expect(await resumen).toEqual({ courseCount: 40, sourceCount: 1 });
  });

  it("si falla el recuento total, no hay resumen", async () => {
    const { client, pendientes } = clienteFalso((_t, filtro) =>
      filtro === null ? { count: null, error: { message: "caído" } } : { count: 5, error: null }
    );

    const resumen = getCatalogSummary(client);
    await dejarCorrer();
    pendientes.forEach((p) => p.resolver());

    expect(await resumen).toBeNull();
  });

  it("si falla el recuento de una fuente, esa no cuenta pero el resumen sale", async () => {
    const [primera] = COURSE_SOURCES;
    const { client, pendientes } = clienteFalso((_t, filtro) =>
      filtro === primera ? { count: null, error: { message: "caído" } } : { count: 7, error: null }
    );

    const resumen = getCatalogSummary(client);
    await dejarCorrer();
    pendientes.forEach((p) => p.resolver());

    expect(await resumen).toEqual({ courseCount: 7, sourceCount: COURSE_SOURCES.length - 1 });
  });
});

describe("getCourseById pide el curso y su histórico a la vez (HU-072)", () => {
  const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  const FILA = {
    id: ID,
    source: "udemy",
    title: "Curso de prueba",
    description: null,
    price_amount: "19.99",
    price_currency: "EUR",
    rating: null,
    level: null,
    language: "es",
    instructor: null,
    image_url: null,
    affiliate_url: null,
    category: null,
    duration_min_minutes: null,
    duration_max_minutes: null,
    num_reviews: null,
    num_subscribers: null,
    what_you_will_learn: null,
    requirements: null,
    resumen_ia: null,
    temas: null,
    publicado_en: null,
    actualizado_en_plataforma: null,
  };
  const HISTORICO = [{ price_amount: "29.99", price_currency: "EUR", captured_at: "2026-09-01T00:00:00Z" }];

  it("las dos lecturas están en marcha antes de que responda ninguna", async () => {
    const { client, pendientes } = clienteFalso((tabla) =>
      tabla === "courses" ? { data: FILA, error: null } : { data: HISTORICO, error: null }
    );

    const curso = getCourseById(client, ID);
    await dejarCorrer();

    expect(pendientes.map((p) => p.tabla).sort()).toEqual(["course_price_history", "courses"]);

    pendientes.forEach((p) => p.resolver());
    const resultado = await curso;
    expect(resultado?.title).toBe("Curso de prueba");
    expect(resultado?.priceAmount).toBe(19.99);
    expect(resultado?.priceHistory).toEqual([
      { priceAmount: 29.99, priceCurrency: "EUR", capturedAt: "2026-09-01T00:00:00Z" },
    ]);
  });

  it("un curso que no existe da null, aunque el histórico ya estuviera pedido", async () => {
    const { client, pendientes } = clienteFalso((tabla) =>
      tabla === "courses" ? { data: null, error: null } : { data: [], error: null }
    );

    const curso = getCourseById(client, ID);
    await dejarCorrer();
    pendientes.forEach((p) => p.resolver());

    expect(await curso).toBeNull();
  });

  it("un id que no es un UUID no llega a consultar nada", async () => {
    const { client, pendientes } = clienteFalso(() => ({ data: null, error: null }));

    expect(await getCourseById(client, "no-soy-un-uuid")).toBeNull();
    expect(pendientes).toHaveLength(0);
  });

  it("si falla la lectura del curso, lo dice, y si falla la del histórico, también", async () => {
    const caido = { message: "caído" };

    const a = clienteFalso((tabla) =>
      tabla === "courses" ? { data: null, error: caido } : { data: [], error: null }
    );
    const errorCurso = getCourseById(a.client, ID);
    await dejarCorrer();
    a.pendientes.forEach((p) => p.resolver());
    await expect(errorCurso).rejects.toThrow("Fallo al leer el curso: caído");

    const b = clienteFalso((tabla) =>
      tabla === "courses" ? { data: FILA, error: null } : { data: null, error: caido }
    );
    const errorHistorico = getCourseById(b.client, ID);
    await dejarCorrer();
    b.pendientes.forEach((p) => p.resolver());
    await expect(errorHistorico).rejects.toThrow("Fallo al leer el histórico de precio: caído");
  });
});
