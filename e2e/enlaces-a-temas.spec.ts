import { expect, test, type Page } from "@playwright/test";

// Un test por criterio de aceptación de HU-060 que se puede comprobar con los
// datos reales. «Un tema que baja del umbral no se enlaza» no: en la base de
// desarrollo los 28 temas lo superan (igual que en HU-058). Esa decisión la
// prueban los unitarios de temasEnlazables y temasDeCategoria.

async function destinos(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(`${selector} a[href^="/cursos/"]`)
    .evaluateAll((enlaces) => [...new Set(enlaces.map((a) => a.getAttribute("href")!))]);
}

async function temasDelSitemap(page: Page): Promise<string[]> {
  const xml = await (await page.request.get("/sitemap.xml")).text();
  return [...xml.matchAll(/<loc>[^<]*(\/cursos\/[a-z0-9-]+)<\/loc>/g)].map((m) => m[1]).sort();
}

test.describe("HU-060 — enlaces a las páginas de tema", () => {
  test("la portada enlaza a las páginas de tema que superan el umbral, y solo a esas", async ({ page }) => {
    await page.goto("/");
    const seccion = page.getByRole("region", { name: "Temas populares" });
    await expect(seccion).toBeVisible();

    const enPortada = (await destinos(page, 'section[aria-labelledby="temas-populares"]')).sort();
    // Las que superan el umbral son las que anuncia el sitemap (HU-058).
    expect(enPortada).toEqual(await temasDelSitemap(page));
    expect(enPortada.length).toBeGreaterThan(0);

    await seccion.getByRole("link", { name: "Python", exact: true }).click();
    await expect(page).toHaveURL(/\/cursos\/python$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cursos de Python en español");
  });

  test("una categoría enlaza a los temas de los que tiene la mayoría de cursos en español", async ({ page }) => {
    await page.goto("/categoria/desarrollo");
    const deDesarrollo = await destinos(page, 'nav[aria-label="Temas de esta categoría"]');
    // Python (31 de 54 en desarrollo), SQL (27 de 36), desarrollo web (24 de 43).
    expect(deDesarrollo).toEqual(expect.arrayContaining(["/cursos/python", "/cursos/sql", "/cursos/desarrollo-web"]));
    // Marketing digital es de negocios (95 de 104), no de desarrollo.
    expect(deDesarrollo).not.toContain("/cursos/marketing-digital");

    await page.goto("/categoria/negocios");
    expect(await destinos(page, 'nav[aria-label="Temas de esta categoría"]')).toContain("/cursos/marketing-digital");

    // Un empate enlaza desde las dos: meditación tiene 14 y 14.
    for (const categoria of ["desarrollo-personal", "salud-y-bienestar"]) {
      await page.goto(`/categoria/${categoria}`);
      expect(await destinos(page, 'nav[aria-label="Temas de esta categoría"]'), categoria).toContain(
        "/cursos/meditacion-y-mindfulness"
      );
    }
  });

  test("la ficha de un curso de un tema enlaza a la página de ese tema", async ({ page }) => {
    await page.goto("/cursos/python");
    const ficha = (await page.locator("main ul li h2 a").first().getAttribute("href"))!;

    await page.goto(ficha);
    const nav = page.getByRole("navigation", { name: "Más cursos de este tema" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Python", exact: true }).click();
    await expect(page).toHaveURL(/\/cursos\/python$/);
  });
});
