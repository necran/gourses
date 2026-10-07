// @vitest-environment node
//
// HU-075. La vista `duracion_por_nivel` (migración 0020) hace los recuentos y
// la mediana en la base, porque PostgREST no agrega. Lo que hay que comprobar
// contra Postgres de verdad es que cuenta lo mismo que una consulta directa,
// leyéndola por el mismo camino que la web (supabase-js con la clave anon).
//
// Solo lee: no siembra ni borra nada.
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { leerDuracionPorNivel } from "../../src/lib/courses/guia-nivel";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const databaseUrl = process.env.DATABASE_URL;
const describeIfConfigured = supabaseUrl && anonKey && databaseUrl ? describe : describe.skip;

describeIfConfigured("HU-075 — duración por nivel", () => {
  it("la vista cuenta lo mismo que una consulta directa a courses, solo Udemy en español", async () => {
    const porNivel = new Map(
      (await leerDuracionPorNivel(createClient(supabaseUrl!, anonKey!))).map((n) => [n.nivel, n])
    );

    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    let directo;
    try {
      ({ rows: directo } = await pg.query<{
        level: string;
        cursos: number;
        con_respaldo: number;
      }>(`
        select level,
               count(*)::int as cursos,
               count(*) filter (where num_reviews >= 50)::int as con_respaldo
          from courses
         where source = 'udemy' and language = 'es' and level is not null and duration_min_minutes is not null
         group by level`));
    } finally {
      await pg.end();
    }

    expect(porNivel.size).toBeGreaterThan(0);
    for (const fila of directo) {
      const resumen = porNivel.get(fila.level as never);
      if (!resumen) continue;
      expect(resumen.cursos, fila.level).toBe(fila.cursos);
      expect(resumen.conRespaldo, fila.level).toBe(fila.con_respaldo);
    }
  }, 30_000);

  it("la duración mediana parte los cursos de cada nivel en dos, y no incluye Coursera", async () => {
    const niveles = await leerDuracionPorNivel(createClient(supabaseUrl!, anonKey!));

    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    try {
      for (const nivel of niveles) {
        const { rows: duraciones } = await pg.query<{ m: number }>(
          `select (duration_min_minutes + duration_max_minutes) / 2.0 as m
             from courses
            where source = 'udemy' and language = 'es' and level = $1 and duration_min_minutes is not null`,
          [nivel.nivel]
        );
        const valores = duraciones.map((d) => Number(d.m)).sort((a, b) => a - b);
        const mitad = (valores.length - 1) / 2;
        const mediana = (valores[Math.floor(mitad)] + valores[Math.ceil(mitad)]) / 2;
        expect(nivel.duracionMedianaMinutos, nivel.nivel).toBeCloseTo(mediana, 6);
      }

      const { rows: coursera } = await pg.query<{ n: number }>(
        `select count(*)::int as n from courses where source = 'coursera' and language = 'es' and level is not null`
      );
      expect(coursera[0].n).toBe(0);
    } finally {
      await pg.end();
    }
  }, 30_000);
});
