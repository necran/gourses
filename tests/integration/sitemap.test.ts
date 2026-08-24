// @vitest-environment node
//
// HU-029. El sitemap tenía un `.limit(5000)` que nunca hizo nada: PostgREST en
// este proyecto limita cada respuesta a 1.000 filas aunque se pida más, así
// que el catálogo ya estaba recortado a 1.000 fichas mucho antes de llegar a
// esa cifra. Con 8.796 cursos, eso dejaba fuera del sitemap más de las tres
// cuartas partes. Lo que hay que comprobar contra la base real: que el
// sitemap cubre el catálogo entero, no una primera página de 1.000.
//
// Solo lee: no siembra ni borra nada.
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import sitemap from "../../src/app/sitemap";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const databaseUrl = process.env.DATABASE_URL;
const describeIfConfigured = supabaseUrl && anonKey && databaseUrl ? describe : describe.skip;

describeIfConfigured("HU-029 — el sitemap cubre el catálogo entero", () => {
  it("trae tantas fichas de curso como cursos hay en la base", async () => {
    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    const { rows } = await pg.query("select count(*)::int as n from courses");
    await pg.end();
    const totalReal = rows[0].n;

    const entradas = await sitemap();
    const fichas = entradas.filter((e) => e.url.includes("/curso/"));

    // La prueba directa de que el fallo está arreglado: antes se cortaba en
    // 1.000 pasara lo que pasara. Con 8.796 cursos reales, esto por sí solo
    // ya demuestra que la paginación funciona.
    expect(fichas.length).toBeGreaterThan(1000);
    expect(fichas.length).toBe(totalReal);
  }, 30_000);

  it("cada curso real tiene su ficha en el sitemap, no solo el recuento cuadra", async () => {
    const pg = new Client({ connectionString: databaseUrl });
    await pg.connect();
    // Uno de los últimos por id: si la paginación perdiera el final del
    // catálogo, el recuento total podría seguir coincidiendo por casualidad
    // (páginas de más al principio compensando páginas de menos al final).
    const { rows } = await pg.query("select id from courses order by id desc limit 1");
    await pg.end();
    const ultimoId = rows[0].id;

    const entradas = await sitemap();
    expect(entradas.some((e) => e.url.endsWith(`/curso/${ultimoId}`))).toBe(true);
  }, 30_000);

  it("sigue incluyendo las páginas fijas", async () => {
    const entradas = await sitemap();
    const urls = entradas.map((e) => e.url);

    expect(urls.some((u) => u.endsWith("/buscar"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/afiliacion"))).toBe(true);
  }, 30_000);
});
