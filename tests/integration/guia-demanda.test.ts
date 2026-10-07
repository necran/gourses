// @vitest-environment node
//
// HU-076. La vista `demanda_por_categoria` (migración 0021) hace la mediana y
// la media en la base, porque PostgREST no agrega. Lo que hay que comprobar
// contra Postgres de verdad es que cuenta lo mismo que una consulta directa,
// leyéndola por el mismo camino que la web (supabase-js con la clave anon).
//
// Solo lee: no siembra ni borra nada.
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { leerDemandaPorCategoria } from "../../src/lib/courses/guia-demanda";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const databaseUrl = process.env.DATABASE_URL;
const describeIfConfigured = supabaseUrl && anonKey && databaseUrl ? describe : describe.skip;

describeIfConfigured("HU-076 — demanda por categoría", () => {
  it("la vista cuenta lo mismo que una consulta directa a courses, solo Udemy en español", async () => {
    const porCategoria = new Map(
      (await leerDemandaPorCategoria(createClient(supabaseUrl!, anonKey!))).map((c) => [c.categoria, c])
    );

    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    let directo;
    try {
      ({ rows: directo } = await pg.query<{ category: string; cursos: number }>(`
        select category, count(*)::int as cursos
          from courses
         where source = 'udemy' and language = 'es' and category is not null and num_subscribers is not null
         group by category`));
    } finally {
      await pg.end();
    }

    expect(porCategoria.size).toBeGreaterThan(0);
    for (const fila of directo) {
      const resumen = porCategoria.get(fila.category as never);
      if (!resumen) continue;
      expect(resumen.cursos, fila.category).toBe(fila.cursos);
    }
  }, 30_000);

  it("la mediana y la media de alumnos coinciden con el cálculo directo, y Coursera queda fuera", async () => {
    const categorias = await leerDemandaPorCategoria(createClient(supabaseUrl!, anonKey!));

    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    try {
      for (const categoria of categorias) {
        const { rows } = await pg.query<{ alumnos: number }>(
          `select num_subscribers::float as alumnos
             from courses
            where source = 'udemy' and language = 'es' and category = $1 and num_subscribers is not null`,
          [categoria.categoria]
        );
        const valores = rows.map((r) => Number(r.alumnos)).sort((a, b) => a - b);
        const mitad = (valores.length - 1) / 2;
        const mediana = (valores[Math.floor(mitad)] + valores[Math.ceil(mitad)]) / 2;
        const media = valores.reduce((suma, v) => suma + v, 0) / valores.length;
        expect(categoria.alumnosMediana, categoria.categoria).toBeCloseTo(mediana, 6);
        expect(categoria.alumnosMedia, categoria.categoria).toBeCloseTo(media, 6);
      }

      const { rows: coursera } = await pg.query<{ n: number }>(
        `select count(*)::int as n from courses where source = 'coursera' and language = 'es' and num_subscribers is not null`
      );
      expect(coursera[0].n).toBe(0);
    } finally {
      await pg.end();
    }
  }, 30_000);
});
