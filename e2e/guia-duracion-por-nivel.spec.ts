import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { RUTA_GUIA_NIVEL } from "../src/lib/courses/guia-nivel";

// Un test por criterio de aceptación de HU-075.

const cabecera = (page: Page, selector: string, atributo = "content") =>
  page.locator(`head ${selector}`).first().getAttribute(atributo);

const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

async function consultar<T>(sql: string): Promise<T[]> {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    return (await pg.query(sql)).rows as T[];
  } finally {
    await pg.end();
  }
}

const celdas = (page: Page, nivel: string) => page.getByRole("row", { name: new RegExp(`^${nivel}`) }).locator("td");

test.describe("HU-075 — guía de duración por nivel", () => {
  test("muestra una tabla con los cuatro niveles, sus cursos en español y su duración mediana", async ({ page }) => {
    const filas = await consultar<{ level: string; cursos: number }>(`
      select level, count(*)::int cursos
        from courses
       where source = 'udemy' and language = 'es' and level is not null and duration_min_minutes is not null
       group by level`);
    expect(filas.length).toBe(4);

    await page.goto(RUTA_GUIA_NIVEL);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Cuánto dura/);

    for (const fila of filas) {
      const suyas = await celdas(page, fila.level);
      expect((await suyas.allTextContents())[0], fila.level).toBe(miles(fila.cursos));
    }
  });

  test("dice explícitamente que es solo de Udemy, porque Coursera no publica nivel", async ({ page }) => {
    await page.goto(RUTA_GUIA_NIVEL);
    const main = page.locator("main");
    await expect(main).toContainText(/Coursera no publica nivel/i);
    await expect(main).toContainText(/Udemy/);
  });

  test("compara los niveles entre sí con cifras reales y no afirma nada fuera de los datos", async ({ page }) => {
    await page.goto(RUTA_GUIA_NIVEL);
    const main = page.locator("main");
    const texto = (await main.textContent()) ?? "";

    // El hallazgo medido: el nivel que más dura frente al que menos, con horas de verdad.
    expect(texto).toMatch(/dura \d+([.,]\d+)? h de mediana/);
    expect(texto).not.toMatch(/mejor|peor|recomend|deberías|merece la pena/i);
  });

  test("tiene metadatos propios, canónica de sí misma y migas de pan", async ({ page }) => {
    await page.goto(RUTA_GUIA_NIVEL);
    await expect(page).toHaveTitle(/^Cuánto dura/);
    expect((await cabecera(page, 'meta[name="description"]'))?.length).toBeGreaterThan(40);
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(new RegExp(`${RUTA_GUIA_NIVEL}$`));

    const bloques = await page.locator('script[type="application/ld+json"]').allTextContents();
    const migas = bloques.map((b) => JSON.parse(b)).find((d) => d["@type"] === "BreadcrumbList");
    expect(migas.itemListElement[0].name).toBe("Inicio");
    expect(migas.itemListElement.at(-1).item).toMatch(new RegExp(`${RUTA_GUIA_NIVEL}$`));
  });

  test("el índice de guías y el sitemap la incluyen", async ({ page, request }) => {
    await page.goto("/guias");
    await expect(page.getByRole("link", { name: /^Cuánto dura un curso según su nivel/ })).toHaveAttribute(
      "href",
      RUTA_GUIA_NIVEL
    );

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`${RUTA_GUIA_NIVEL}</loc>`);
  });
});
