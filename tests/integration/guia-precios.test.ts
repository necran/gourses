// @vitest-environment node
//
// HU-069. La vista `precios_por_categoria` (migración 0019) hace los recuentos y
// las medianas en la base, porque PostgREST no agrega. Lo que hay que comprobar
// contra Postgres de verdad es que cuenta lo mismo que una consulta directa,
// leyéndola por el mismo camino que la web (supabase-js con la clave anon).
//
// Solo lee: no siembra ni borra nada.
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { leerPreciosPorCategoria } from "../../src/lib/courses/guia-precios";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const databaseUrl = process.env.DATABASE_URL;
const describeIfConfigured = supabaseUrl && anonKey && databaseUrl ? describe : describe.skip;

describeIfConfigured("HU-069 — precios por categoría", () => {
  it("la vista cuenta lo mismo que una consulta directa a courses", async () => {
    const porCategoria = new Map(
      (await leerPreciosPorCategoria(createClient(supabaseUrl!, anonKey!))).map((c) => [c.categoria, c])
    );

    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    let directo;
    try {
      ({ rows: directo } = await pg.query<{
        category: string;
        cursos: number;
        con_precio: number;
        minimo: number | null;
        maximo: number | null;
        con_duracion: number;
        con_respaldo: number;
      }>(`
        select category,
               count(*)::int as cursos,
               count(*) filter (where price_currency = 'EUR')::int as con_precio,
               min(price_amount) filter (where price_currency = 'EUR')::float as minimo,
               max(price_amount) filter (where price_currency = 'EUR')::float as maximo,
               count(duration_min_minutes)::int as con_duracion,
               count(*) filter (where num_reviews >= 50)::int as con_respaldo
          from courses
         where language = 'es' and category is not null
         group by category`));
    } finally {
      await pg.end();
    }

    // Puede haber categorías en la base que ya no estén en la lista del código:
    // la vista las trae y el lector las descarta, así que se comparan las suyas.
    expect(porCategoria.size).toBeGreaterThan(0);
    for (const fila of directo) {
      const resumen = porCategoria.get(fila.category as never);
      if (!resumen) continue;
      expect(resumen.cursos, fila.category).toBe(fila.cursos);
      expect(resumen.conPrecio, fila.category).toBe(fila.con_precio);
      expect(resumen.precioMinimoEur, fila.category).toBe(fila.minimo);
      expect(resumen.precioMaximoEur, fila.category).toBe(fila.maximo);
      expect(resumen.conDuracion, fila.category).toBe(fila.con_duracion);
      expect(resumen.conRespaldo, fila.category).toBe(fila.con_respaldo);
    }
  }, 30_000);

  it("el precio habitual es el más repetido, y la duración mediana parte los cursos en dos", async () => {
    const categorias = await leerPreciosPorCategoria(createClient(supabaseUrl!, anonKey!));

    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    try {
      for (const categoria of categorias.filter((c) => c.cursos >= 20).slice(0, 4)) {
        const { rows: precios } = await pg.query<{ precio: number; n: number }>(
          `select price_amount::float as precio, count(*)::int as n
             from courses
            where language = 'es' and category = $1 and price_currency = 'EUR'
            group by price_amount`,
          [categoria.categoria]
        );
        if (precios.length === 0) {
          expect(categoria.precioHabitualEur, categoria.categoria).toBeNull();
        } else {
          const maximo = Math.max(...precios.map((p) => p.n));
          // En un empate, mode() se queda con el primero en orden: el más barato.
          const habitual = Math.min(...precios.filter((p) => p.n === maximo).map((p) => p.precio));
          expect(categoria.precioHabitualEur, categoria.categoria).toBe(habitual);
        }

        const { rows: duraciones } = await pg.query<{ m: number }>(
          `select (duration_min_minutes + duration_max_minutes) / 2.0 as m
             from courses
            where language = 'es' and category = $1 and duration_min_minutes is not null`,
          [categoria.categoria]
        );
        if (duraciones.length === 0) {
          expect(categoria.duracionMedianaMinutos, categoria.categoria).toBeNull();
        } else {
          const valores = duraciones.map((d) => Number(d.m)).sort((a, b) => a - b);
          const mitad = (valores.length - 1) / 2;
          const mediana = (valores[Math.floor(mitad)] + valores[Math.ceil(mitad)]) / 2;
          expect(categoria.duracionMedianaMinutos, categoria.categoria).toBeCloseTo(mediana, 6);
        }
      }
    } finally {
      await pg.end();
    }
  }, 30_000);
});
