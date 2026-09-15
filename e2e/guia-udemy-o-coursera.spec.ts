import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Un test por criterio de aceptación de HU-063. Las cifras se comparan con la
// base de desarrollo, la misma que sirve la web en local.

const RUTA = "/guias/udemy-o-coursera";

const cabecera = (page: Page, selector: string, atributo = "content") =>
  page.locator(`head ${selector}`).first().getAttribute(atributo);

const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const celdas = async (page: Page, etiqueta: string) =>
  page.getByRole("row", { name: new RegExp(`^${etiqueta}`) }).locator("td").allTextContents();

async function consultar<T>(sql: string): Promise<T[]> {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    return (await pg.query(sql)).rows as T[];
  } finally {
    await pg.end();
  }
}

test.describe("HU-063 — guía «Udemy o Coursera»", () => {
  test("compara las dos plataformas con cifras: cursos, español, idiomas, precio, valoraciones y duración", async ({
    page,
  }) => {
    await page.goto(RUTA);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Udemy o Coursera/);

    const tabla = page.getByRole("region", { name: "Comparación de Udemy y Coursera" });
    await expect(tabla.getByRole("columnheader")).toHaveText(["Dato", "Udemy", "Coursera"]);
    for (const etiqueta of ["Cursos en el catálogo", "En español", "Idiomas", "Precio por curso", "Valoraciones", "Duración"]) {
      const [udemy, coursera] = await celdas(page, etiqueta);
      expect(udemy?.trim(), etiqueta).toBeTruthy();
      expect(coursera?.trim(), etiqueta).toBeTruthy();
    }
  });

  test("las cifras coinciden con la base: se calculan al servir la página", async ({ page }) => {
    const filas = await consultar<{ source: string; cursos: number; en_espanol: number; idiomas: number }>(`
      select source, count(*)::int as cursos, count(*) filter (where language = 'es')::int as en_espanol,
             count(distinct language)::int as idiomas
        from courses group by source`);
    const de = (source: string) => filas.find((f) => f.source === source)!;

    await page.goto(RUTA);
    const [cursosU, cursosC] = await celdas(page, "Cursos en el catálogo");
    expect(cursosU).toBe(miles(de("udemy").cursos));
    expect(cursosC).toBe(miles(de("coursera").cursos));

    const [espU, espC] = await celdas(page, "En español");
    expect(espU).toMatch(new RegExp(`^${miles(de("udemy").en_espanol).replace(".", "\\.")} \\(`));
    expect(espC).toMatch(new RegExp(`^${miles(de("coursera").en_espanol).replace(".", "\\.")} \\(`));

    expect(await celdas(page, "Idiomas")).toEqual([String(de("udemy").idiomas), String(de("coursera").idiomas)]);
  });

  test("lo que una plataforma no publica se dice, nunca como cero", async ({ page }) => {
    await page.goto(RUTA);
    expect((await celdas(page, "Precio por curso"))[1]).toBe("No lo publica");
    expect((await celdas(page, "Valoraciones"))[1]).toBe("No lo publica");

    const coursera = (await page.getByRole("row").locator("td:nth-of-type(2)").allTextContents()).join(" | ");
    expect(coursera).not.toMatch(/(^|\s)0 €|(^|\s)0,00|gratis/i);
    await expect(page.getByText(/^Coursera no publica el precio/)).toBeVisible();
  });

  test("no afirma nada fuera de los datos y enlaza a las categorías y temas de cada plataforma", async ({
    page,
    request,
  }) => {
    await page.goto(RUTA);
    const texto = (await page.locator("main").textContent()) ?? "";
    expect(texto).not.toMatch(/mejor|peor|recomend|certificad|suscrip/i);

    for (const plataforma of ["Udemy", "Coursera"]) {
      const seccion = page.getByRole("region", { name: plataforma, exact: true });
      const categorias = await seccion.locator('a[href^="/categoria/"]').evaluateAll((as) =>
        as.map((a) => a.getAttribute("href")!)
      );
      expect(categorias.length, plataforma).toBeGreaterThan(0);
      const enlaces = [...categorias, ...(await seccion.locator('a[href^="/cursos/"]').evaluateAll((as) =>
        as.map((a) => a.getAttribute("href")!)
      ))];
      for (const href of enlaces) {
        expect((await request.get(href)).status(), href).toBe(200);
      }
    }
    // Udemy tiene temas con cursos en español que superan el umbral.
    expect(await page.getByRole("region", { name: "Udemy", exact: true }).locator('a[href^="/cursos/"]').count()).toBeGreaterThan(0);
  });

  test("tiene título y descripción propios, es canónica de sí misma y declara migas de pan", async ({ page }) => {
    await page.goto(RUTA);
    await expect(page).toHaveTitle(/^Udemy o Coursera/);
    expect(await cabecera(page, 'meta[name="description"]')).toMatch(/de Udemy y .* de Coursera/);
    expect(await cabecera(page, 'link[rel="canonical"]', "href")).toMatch(/\/guias\/udemy-o-coursera$/);

    const bloques = await page.locator('script[type="application/ld+json"]').allTextContents();
    const migas = bloques.map((b) => JSON.parse(b)).find((d) => d["@type"] === "BreadcrumbList");
    expect(migas.itemListElement.map((m: { name: string }) => m.name)).toEqual([
      "Inicio",
      expect.stringMatching(/^Udemy o Coursera/),
    ]);
    expect(migas.itemListElement[1].item).toMatch(/\/guias\/udemy-o-coursera$/);
  });

  test("el sitemap y la portada incluyen la guía", async ({ page, request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toMatch(/<loc>[^<]*\/guias\/udemy-o-coursera<\/loc>/);

    await page.goto("/");
    await page.getByRole("link", { name: /¿Udemy o Coursera\?/ }).click();
    await expect(page).toHaveURL(/\/guias\/udemy-o-coursera$/);
  });
});
