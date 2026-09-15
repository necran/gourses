// @vitest-environment node
//
// HU-063. Las cifras de la guía «Udemy o Coursera» salen de vistas agregadas
// (migración 0015). Lo que hay que comprobar contra la base real: que esas
// vistas, leídas por el mismo camino que la web (supabase-js con la clave anon,
// RLS real), cuentan lo mismo que una consulta directa a `courses`.
//
// Solo lee: no siembra ni borra nada. Si la ingesta escribe a la vez, un
// recuento puede moverse entre las dos lecturas; no se lanza durante la ingesta.
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { leerGuia } from "../../src/lib/courses/guia-plataformas";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const databaseUrl = process.env.DATABASE_URL;
const describeIfConfigured = supabaseUrl && anonKey && databaseUrl ? describe : describe.skip;

async function consultar<T>(sql: string): Promise<T[]> {
  const pg = new Client({ connectionString: databaseUrl });
  await pg.connect();
  try {
    return (await pg.query(sql)).rows as T[];
  } finally {
    await pg.end();
  }
}

describeIfConfigured("HU-063 — las cifras de la guía salen de la base", () => {
  it("el resumen por plataforma cuenta lo mismo que una consulta directa", async () => {
    const { plataformas } = await leerGuia(createClient(supabaseUrl!, anonKey!));

    const directo = await consultar<Record<string, string | number | null>>(`
      select source,
             count(*)::int as cursos,
             count(*) filter (where language = 'es')::int as en_espanol,
             count(distinct language)::int as idiomas,
             count(price_amount)::int as con_precio,
             count(*) filter (where price_currency = 'EUR')::int as con_precio_eur,
             min(price_amount) filter (where price_currency = 'EUR')::float as minimo,
             max(price_amount) filter (where price_currency = 'EUR')::float as maximo,
             count(rating)::int as con_valoracion,
             avg(rating)::float as valoracion_media,
             count(duration_min_minutes)::int as con_duracion,
             count(num_reviews)::int as con_resenas,
             count(level)::int as con_nivel
        from courses group by source`);

    expect(directo.map((f) => f.source).sort()).toEqual([...plataformas.keys()].sort());
    for (const f of directo) {
      const p = plataformas.get(f.source as string)!;
      expect(p.cursos, `${f.source} cursos`).toBe(f.cursos);
      expect(p.enEspanol).toBe(f.en_espanol);
      expect(p.idiomas).toBe(f.idiomas);
      expect(p.conPrecio).toBe(f.con_precio);
      expect(p.conPrecioEur).toBe(f.con_precio_eur);
      expect(p.precioMinimoEur).toBe(f.minimo);
      expect(p.precioMaximoEur).toBe(f.maximo);
      expect(p.conValoracion).toBe(f.con_valoracion);
      if (f.valoracion_media === null) expect(p.valoracionMedia).toBeNull();
      else expect(p.valoracionMedia).toBeCloseTo(f.valoracion_media as number, 6);
      expect(p.conDuracion).toBe(f.con_duracion);
      expect(p.conResenas).toBe(f.con_resenas);
      expect(p.conNivel).toBe(f.con_nivel);
    }
  }, 30_000);

  it("el precio más repetido y la mediana de duración coinciden con calcularlos a mano", async () => {
    const { plataformas } = await leerGuia(createClient(supabaseUrl!, anonKey!));

    const precios = await consultar<{ source: string; precio: number; n: number }>(`
      select source, price_amount::float as precio, count(*)::int as n
        from courses where price_currency = 'EUR'
       group by source, price_amount`);
    const duraciones = await consultar<{ source: string; m: number }>(`
      select source, (duration_min_minutes + duration_max_minutes) / 2.0 as m
        from courses where duration_min_minutes is not null`);

    for (const [source, p] of plataformas) {
      const suyos = precios.filter((f) => f.source === source);
      if (suyos.length === 0) {
        expect(p.precioHabitualEur).toBeNull();
        expect(p.cursosConPrecioHabitual).toBe(0);
      } else {
        const maximo = Math.max(...suyos.map((f) => f.n));
        // En un empate, mode() se queda con el primero en orden: el más barato.
        const habitual = Math.min(...suyos.filter((f) => f.n === maximo).map((f) => f.precio));
        expect(p.precioHabitualEur, source).toBe(habitual);
        expect(p.cursosConPrecioHabitual).toBe(maximo);
      }

      const valores = duraciones.filter((f) => f.source === source).map((f) => Number(f.m)).sort((a, b) => a - b);
      if (valores.length === 0) {
        expect(p.duracionMedianaMinutos).toBeNull();
      } else {
        const mitad = (valores.length - 1) / 2;
        const mediana = (valores[Math.floor(mitad)] + valores[Math.ceil(mitad)]) / 2;
        expect(p.duracionMedianaMinutos, source).toBeCloseTo(mediana, 6);
      }
    }
  }, 30_000);

  it("las categorías y los temas por plataforma cuentan lo mismo que una consulta directa", async () => {
    const { categorias, temas } = await leerGuia(createClient(supabaseUrl!, anonKey!));

    const categoriasDirecto = await consultar<{ clave: string; cursos: number; en_espanol: number }>(`
      select source || '/' || category as clave, count(*)::int as cursos,
             count(*) filter (where language = 'es')::int as en_espanol
        from courses where category is not null group by source, category`);
    const temasDirecto = await consultar<{ clave: string; en_espanol: number }>(`
      select source || '/' || tema as clave, count(*) filter (where language = 'es')::int as en_espanol
        from courses, unnest(temas) as tema group by source, tema`);

    const porClave = <T extends { source: string }>(filas: T[], campo: keyof T) =>
      Object.fromEntries(filas.map((f) => [`${f.source}/${String(f[campo])}`, f]));

    const vistaCategorias = porClave(categorias, "category");
    expect(Object.keys(vistaCategorias).sort()).toEqual(categoriasDirecto.map((f) => f.clave).sort());
    for (const f of categoriasDirecto) {
      expect(Number(vistaCategorias[f.clave].cursos), f.clave).toBe(f.cursos);
      expect(Number(vistaCategorias[f.clave].en_espanol), f.clave).toBe(f.en_espanol);
    }

    const vistaTemas = porClave(temas, "tema");
    expect(Object.keys(vistaTemas).sort()).toEqual(temasDirecto.map((f) => f.clave).sort());
    for (const f of temasDirecto) {
      expect(Number(vistaTemas[f.clave].en_espanol), f.clave).toBe(f.en_espanol);
    }
  }, 30_000);
});
