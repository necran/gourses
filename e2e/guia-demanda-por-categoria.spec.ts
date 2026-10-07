import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { RUTA_GUIA_DEMANDA } from "../src/lib/courses/guia-demanda";

// Un test por criterio de aceptación de HU-076.

const cabecera = (page: Page, selector: string, atributo = "content") =>
  page.locator(`head ${selector}`).first().getAttribute(atributo);

async function consultar<T>(sql: string): Promise<T[]> {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    return (await pg.query(sql)).rows as T[];
  } finally {
    await pg.end();
  }
}

test.describe("HU-076 — guía de demanda por categoría", () => {
  test("muestra una tabla con las categorías, sus cursos en español y los alumnos por curso", async ({ page }) => {
    const filas = await consultar<{ category: string }>(`
      select distinct category
        from courses
       where source = 'udemy' and language = 'es' and category is not null and num_subscribers is not null`);
    expect(filas.length).toBeGreaterThan(0);

    await page.goto(RUTA_GUIA_DEMANDA);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Qué categoría tiene más demanda/);

    const tabla = page.getByRole("region", { name: "Alumnos inscritos por categoría" });
    await expect(tabla.getByRole("row")).toHaveCount(filas.length + 1); // +1 por la cabecera
  });

  test("compara el número de cursos con los alumnos por curso, con cifras reales", async ({ page }) => {
    await page.goto(RUTA_GUIA_DEMANDA);
    const main = page.locator("main");
    const texto = (await main.textContent()) ?? "";

    expect(texto).toMatch(/mediana de alumnos por curso más alta/);
    expect(texto).not.toMatch(/mejor|peor|recomend|deberías|merece la pena/i);
  });

  test("dice que usa la mediana, no la media, para no dejarse maquillar por un curso enorme", async ({ page }) => {
    await page.goto(RUTA_GUIA_DEMANDA);
    const main = page.locator("main");
    await expect(main).toContainText(/mediana, no la media/);
  });

  test("tiene metadatos propios, canónica de sí misma y migas de pan", async ({ page }) => {
    await page.goto(RUTA_GUIA_DEMANDA);
    await expect(page).toHaveTitle(/^Qué categoría tiene más demanda/);
    expect((await cabecera(page, 'meta[name="description"]'))?.length).toBeGreaterThan(40);
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(new RegExp(`${RUTA_GUIA_DEMANDA}$`));

    const bloques = await page.locator('script[type="application/ld+json"]').allTextContents();
    const migas = bloques.map((b) => JSON.parse(b)).find((d) => d["@type"] === "BreadcrumbList");
    expect(migas.itemListElement[0].name).toBe("Inicio");
    expect(migas.itemListElement.at(-1).item).toMatch(new RegExp(`${RUTA_GUIA_DEMANDA}$`));
  });

  test("el índice de guías y el sitemap la incluyen", async ({ page, request }) => {
    await page.goto("/guias");
    await expect(page.getByRole("link", { name: /^Qué categoría tiene más demanda/ })).toHaveAttribute(
      "href",
      RUTA_GUIA_DEMANDA
    );

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`${RUTA_GUIA_DEMANDA}</loc>`);
  });
});
