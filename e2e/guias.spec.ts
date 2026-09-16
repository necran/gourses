import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { GUIAS, RUTA_GUIAS } from "../src/lib/courses/guias";
import { RUTA_GUIA_PRECIOS } from "../src/lib/courses/guia-precios";

// Un test por criterio de aceptación de HU-069.

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

const celdas = (page: Page, materia: string) =>
  page.getByRole("row", { name: new RegExp(`^${materia}`) }).locator("td");

test.describe("HU-069 — índice de guías y guía de precios", () => {
  test("el índice lista las guías publicadas y lleva a cada una", async ({ page, request }) => {
    await page.goto(RUTA_GUIAS);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guías con datos del catálogo");

    for (const guia of GUIAS) {
      const enlace = page.getByRole("link", { name: guia.titulo });
      await expect(enlace).toHaveAttribute("href", guia.ruta);
      expect((await request.get(guia.ruta)).status(), guia.ruta).toBe(200);
      // Cada una dice de qué trata, no solo su título.
      await expect(page.getByText(guia.resumen.slice(0, 40))).toBeVisible();
    }
  });

  test("la guía de precios muestra una fila por materia, con cifras de la base", async ({ page }) => {
    const filas = await consultar<{ category: string; cursos: number; maximo: number | null }>(`
      select category, count(*)::int cursos,
             max(price_amount) filter (where price_currency='EUR')::float maximo
        from courses where language='es' and category is not null group by category`);

    await page.goto(RUTA_GUIA_PRECIOS);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Cuánto cuesta/);

    const negocios = filas.find((f) => f.category === "negocios")!;
    const suyas = await celdas(page, "Negocios");
    expect((await suyas.allTextContents())[0]).toBe(miles(negocios.cursos));
    expect((await suyas.allTextContents())[1]).toContain(
      String(negocios.maximo).replace(".", ",")
    );
  });

  test("con pocos cursos no se dan cifras, y sin precio se dice que no se publica", async ({ page }) => {
    const pocas = await consultar<{ category: string }>(`
      select category from courses where language='es' and category is not null
       group by category having count(*) < 20 limit 1`);
    const sinPrecio = await consultar<{ category: string }>(`
      select category from courses where language='es' and category is not null
       group by category having count(*) >= 20
          and count(*) filter (where price_currency='EUR') = 0 limit 1`);

    await page.goto(RUTA_GUIA_PRECIOS);
    const tabla = page.getByRole("region", { name: "Precios y duración por materia" });

    if (pocas.length > 0) {
      await expect(tabla.getByText("Pocos cursos para decirlo").first()).toBeVisible();
    }
    if (sinPrecio.length > 0) {
      await expect(tabla.getByText("No lo publica").first()).toBeVisible();
    }
    // Ningún hueco se rellena con un cero que se leería como «gratis».
    const texto = (await tabla.textContent()) ?? "";
    expect(texto).not.toMatch(/(^|\s)0,00|(^|\s)0 €|gratis/i);
  });

  test("no afirma nada fuera de los datos y enlaza a las materias y a la otra guía", async ({
    page,
    request,
  }) => {
    await page.goto(RUTA_GUIA_PRECIOS);
    const main = page.locator("main");
    expect(await main.textContent()).not.toMatch(/mejor|peor|recomend|deberías|merece la pena/i);

    const categorias = await main.locator('a[href^="/categoria/"]').evaluateAll((as) =>
      as.map((a) => a.getAttribute("href")!)
    );
    expect(categorias.length).toBeGreaterThan(0);
    for (const href of categorias.slice(0, 3)) {
      expect((await request.get(href)).status(), href).toBe(200);
    }
    await expect(main.locator('a[href="/guias/udemy-o-coursera"]')).toHaveCount(1);
  });

  test("las dos páginas tienen metadatos propios, canónica y migas de pan", async ({ page }) => {
    for (const [ruta, patronTitulo] of [
      [RUTA_GUIAS, /^Guías con datos/],
      [RUTA_GUIA_PRECIOS, /^Cuánto cuesta/],
    ] as const) {
      await page.goto(ruta);
      await expect(page).toHaveTitle(patronTitulo);
      expect((await cabecera(page, 'meta[name="description"]'))?.length, ruta).toBeGreaterThan(40);
      expect(await cabecera(page, 'link[rel="canonical"]', "href"), ruta).toMatch(
        new RegExp(`${ruta}$`)
      );

      const bloques = await page.locator('script[type="application/ld+json"]').allTextContents();
      const migas = bloques.map((b) => JSON.parse(b)).find((d) => d["@type"] === "BreadcrumbList");
      expect(migas.itemListElement[0].name, ruta).toBe("Inicio");
      expect(migas.itemListElement.at(-1).item, ruta).toMatch(new RegExp(`${ruta}$`));
    }
  });

  test("el sitemap y la portada incluyen el índice de guías", async ({ page, request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toMatch(/<loc>[^<]*\/guias<\/loc>/);
    for (const guia of GUIAS) {
      expect(sitemap, guia.ruta).toContain(`${guia.ruta}</loc>`);
    }

    await page.goto("/");
    await page.getByRole("link", { name: /Ver todas las guías/ }).click();
    await expect(page).toHaveURL(new RegExp(`${RUTA_GUIAS}$`));
  });
});
