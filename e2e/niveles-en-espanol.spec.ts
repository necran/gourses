import { expect, test } from "@playwright/test";
import { Client } from "pg";

// Un test por criterio de HU-065 visible desde la web. Que la ingesta guarde en
// español y que la migración no deje niveles en inglés se prueba en unitarios e
// integración.

const INGLES = /All Levels|Beginner|Intermediate|Expert\b/;

// Los cursos de Udemy en inglés son los que llegaban con el nivel en inglés: se
// coge uno en inglés y otro en español con el mismo nivel.
async function parDelMismoNivel(): Promise<{ ingles: string; espanol: string; nivel: string }> {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    const { rows } = await pg.query(
      `select en.id as ingles, es.id as espanol, en.level as nivel
         from (select id, level from courses where source = 'udemy' and language = 'en' and level = 'Principiante' order by id limit 1) en
         join lateral (select id from courses where source = 'udemy' and language = 'es' and level = en.level order by id limit 1) es on true`
    );
    return rows[0];
  } finally {
    await pg.end();
  }
}

test.describe("HU-065 — el nivel siempre en español", () => {
  test("la ficha de un curso de Udemy en inglés muestra el nivel en español", async ({ page }) => {
    const { ingles, nivel } = await parDelMismoNivel();
    await page.goto(`/curso/${ingles}`);
    const main = page.locator("main");
    await expect(main).toContainText(`· ${nivel}`);
    expect(await main.textContent()).not.toMatch(new RegExp(`· (${INGLES.source})`));
  });

  test("comparando dos cursos del mismo nivel, la fila «Nivel» dice lo mismo en los dos", async ({ page }) => {
    const { ingles, espanol, nivel } = await parDelMismoNivel();
    await page.goto(`/comparar?ids=${ingles},${espanol}`);
    const celdas = page.getByRole("row", { name: /^Nivel/ }).locator("td");
    await expect(celdas).toHaveText([nivel, nivel]);
  });
});
